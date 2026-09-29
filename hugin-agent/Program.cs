using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

builder.WebHost.UseUrls("http://127.0.0.1:5055");

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.SetIsOriginAllowed(_ => true)
            .AllowAnyHeader()
            .AllowAnyMethod());
});

builder.Services.AddHttpClient("hugin")
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
    {
        ServerCertificateCustomValidationCallback =
            HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
    });

var app = builder.Build();

app.Use(async (ctx, next) =>
{
    if (HttpMethods.IsOptions(ctx.Request.Method))
    {
        var origin = ctx.Request.Headers.Origin.FirstOrDefault() ?? "*";
        ctx.Response.Headers["Access-Control-Allow-Origin"] = origin;
        ctx.Response.Headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,OPTIONS";
        ctx.Response.Headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization,*";
        ctx.Response.Headers["Access-Control-Allow-Private-Network"] = "true";
        ctx.Response.Headers["Access-Control-Max-Age"] = "86400";
        ctx.Response.StatusCode = StatusCodes.Status204NoContent;
        return;
    }

    ctx.Response.OnStarting(() =>
    {
        if (!ctx.Response.Headers.ContainsKey("Access-Control-Allow-Private-Network"))
            ctx.Response.Headers["Access-Control-Allow-Private-Network"] = "true";
        return Task.CompletedTask;
    });

    await next();
});

app.UseCors();

app.MapGet("/", () => Results.Ok(new
{
    name = "HizliSatis Hugin Agent",
    status = "ok",
    tip = "Gizli çalışır. Kapatmayın."
}));

app.MapGet("/health", () => Results.Ok(new { status = "ok", pid = Environment.ProcessId }));

app.MapGet("/machine/info", () =>
{
    var macs = DetectMacAddresses();
    return Results.Ok(new
    {
        suggestedHardwareId = macs.FirstOrDefault(),
        macAddresses = macs,
        tip = "HardwareId olarak Wi‑Fi/Ethernet MAC kullanın (örn. 84:1B:77:AF:1A:3B). Yazarkasa ekranı 'Eşleşme bekleniyor' iken Eşleşmeyi Test Et."
    });
});

app.MapPost("/pair/test", async (PairTestRequest request, IHttpClientFactory httpClientFactory) =>
{
    if (string.IsNullOrWhiteSpace(request.DeviceHost))
        return Results.BadRequest(new { ok = false, message = "DeviceHost zorunlu." });
    if (string.IsNullOrWhiteSpace(request.SoftwareId))
        return Results.BadRequest(new { ok = false, message = "SoftwareId (firma VKN) zorunlu." });

    var hardwareId = NormalizeHardwareId(request.HardwareId);
    if (string.IsNullOrWhiteSpace(request.SoftwareId))
        request.SoftwareId = "9217033991";
    if (string.IsNullOrWhiteSpace(hardwareId) ||
        string.Equals(hardwareId, request.SoftwareId, StringComparison.OrdinalIgnoreCase) ||
        hardwareId.Contains(':'))
        hardwareId = "ABCD1234";
    request.HardwareId = hardwareId;

    var (client, baseUrl) = CreateClient(httpClientFactory, request.DeviceHost, request.DevicePort);

    // Hugin: ilk eşleşme GET /v1/settings — SerialNo opsiyonel; JSON status SUCCESS şart
    using var httpRequest = CreateRequest(HttpMethod.Get, $"{baseUrl}/v1/settings", request.SoftwareId, request.SerialNo, hardwareId);

    try
    {
        using var response = await client.SendAsync(httpRequest);
        var body = await response.Content.ReadAsStringAsync();
        var apiError = ExtractErrorMessage(body);
        var serialNo = ExtractSerialNo(body) ?? request.SerialNo;

        if (!IsSuccessStatus(body))
        {
            var hint = ContainsIgnoreCase(apiError, "eşleşmiyor")
                ? " Cihaz başka bir PC/MAC ile eşleşmiş olabilir. Yazarkasayı 'Eşleşme bekleniyor' konumuna alıp tekrar deneyin."
                : ContainsIgnoreCase(apiError, "boş")
                    ? " HardwareId ve SoftwareId (VKN) girildiğinden emin olun."
                    : "";

            return Results.Ok(new
            {
                ok = false,
                message = (apiError ?? $"Eşleşme başarısız ({(int)response.StatusCode})") + hint,
                hardwareId,
                serialNo,
                deviceBaseUrl = baseUrl,
                raw = Truncate(body, 800)
            });
        }

        return Results.Ok(new
        {
            ok = true,
            message = "Eşleşme başarılı — yazarkasa hazır.",
            hardwareId,
            serialNo,
            deviceBaseUrl = baseUrl,
            raw = Truncate(body, 800)
        });
    }
    catch (Exception ex)
    {
        return Results.Ok(new
        {
            ok = false,
            message = $"Bağlantı kurulamadı: {ex.Message}",
            hardwareId,
            deviceBaseUrl = baseUrl
        });
    }
});

app.MapPost("/sale/print", async (SalePrintRequest request, IHttpClientFactory httpClientFactory, ILoggerFactory loggerFactory) =>
{
    var logger = loggerFactory.CreateLogger("HuginSalePrint");

    if (string.IsNullOrWhiteSpace(request.DeviceHost))
        return Results.BadRequest(new { ok = false, message = "DeviceHost zorunlu." });
    if (request.Items is null || request.Items.Count == 0)
        return Results.BadRequest(new { ok = false, message = "Sepet boş." });

    if (string.IsNullOrWhiteSpace(request.SoftwareId))
        request.SoftwareId = "9217033991";
    // Masaüstü D:\Hızlı Satış köprüsü ile eşleşen kimlik (MAC değil)
    var hw = NormalizeHardwareId(request.HardwareId);
    if (string.IsNullOrWhiteSpace(hw) ||
        string.Equals(hw, request.SoftwareId, StringComparison.OrdinalIgnoreCase) ||
        hw.Contains(':'))
        hw = "ABCD1234";
    request.HardwareId = hw;

    if (string.IsNullOrWhiteSpace(request.SerialNo))
    {
        return Results.Ok(new
        {
            ok = false,
            message = "Seri no (FU...) eksik. Yazarkasa → Eşleşmeyi Test Et ile otomatik gelsin."
        });
    }

    var (client, baseUrl) = CreateClient(httpClientFactory, request.DeviceHost, request.DevicePort);
    client.Timeout = TimeSpan.FromSeconds(120);

    try
    {
        // Masaüstü köprü gibi: önce açık belge varsa iptal
        await TryCancelActiveFromStatusAsync(client, baseUrl, request, logger);

        var start = await StartDocumentAsync(client, baseUrl, request, retryAfterCancel: true, logger);
        if (!start.Ok)
        {
            return Results.Ok(new
            {
                ok = false,
                step = "start",
                message = start.Message,
                raw = start.Raw
            });
        }

        var documentId = start.DocumentId!;
        var paymentType = MapPayment(request.PaymentMethod);
        var payments = SplitPayments(request);

        // Hugin S1 PUT: sadece name + vatRate + amount (eski köprü formatı)
        var items = request.Items.Select(i =>
        {
            var qty = i.Quantity <= 0 ? 1m : i.Quantity;
            var lineTotal = Math.Round(i.UnitPrice * qty, 2);
            var name = string.IsNullOrWhiteSpace(i.Name) ? "URUN" : i.Name.Trim();
            if (name.Length > 20) name = name[..20];
            return new Dictionary<string, object?>
            {
                ["name"] = name,
                ["vatRate"] = (int)Math.Round(i.VatRate),
                ["amount"] = lineTotal.ToString("0.00", CultureInfo.InvariantCulture)
            };
        }).ToList();

        var payAmount = request.GrandTotal > 0
            ? request.GrandTotal
            : items.Sum(x => decimal.Parse((string)x["amount"]!, CultureInfo.InvariantCulture));

        var finalizePayload = new
        {
            items,
            payments = payments.Count > 0
                ? payments
                : new List<object>
                {
                    new
                    {
                        type = paymentType,
                        amount = payAmount.ToString("0.00", CultureInfo.InvariantCulture)
                    }
                }
        };

        using var finReq = CreateRequest(HttpMethod.Put, $"{baseUrl}/v1/documents/{documentId}", request.SoftwareId, request.SerialNo, request.HardwareId);
        var finJson = JsonSerializer.Serialize(finalizePayload);
        finReq.Content = new StringContent(finJson, Encoding.UTF8, "application/json");
        using var finRes = await client.SendAsync(finReq);
        var finBody = await finRes.Content.ReadAsStringAsync();
        logger.LogInformation("Finalize HTTP {Code}: {Body}", (int)finRes.StatusCode, Truncate(finBody, 500));

        if (IsPaperProblem((int)finRes.StatusCode, finBody))
        {
            return Results.Ok(new
            {
                ok = false,
                paper = true,
                step = "finalize",
                message = "Yazarkasada kağıt bitti veya kapak açık. Kağıdı takıp devam et.",
                documentId,
                raw = Truncate(finBody, 1000)
            });
        }

        if (!finRes.IsSuccessStatusCode || !IsSuccessStatus(finBody))
        {
            await TryCancelAsync(client, baseUrl, documentId, request);
            return Results.Ok(new
            {
                ok = false,
                step = "finalize",
                message = "Ödeme alınamadı. Yazarkasadan onay gelmedi.",
                documentId,
                raw = Truncate(finBody, 1000)
            });
        }

        var receiptNo = ExtractReceiptNo(finBody);
        if (string.IsNullOrWhiteSpace(receiptNo) && !string.IsNullOrWhiteSpace(documentId))
            receiptNo = documentId.Length >= 6 ? documentId[^6..] : documentId;
        return Results.Ok(new
        {
            ok = true,
            message = "Fiş yazarkasadan basıldı.",
            documentId,
            receiptNo,
            paymentType,
            raw = Truncate(finBody, 800)
        });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "sale/print failed");
        return Results.Ok(new
        {
            ok = false,
            message = $"Yazarkasa iletişim hatası: {ex.Message}",
            deviceBaseUrl = baseUrl
        });
    }
});

app.MapPost("/document/resume", async (DeviceActionRequest request, IHttpClientFactory httpClientFactory) =>
{
    var identity = NormalizeIdentity(request);
    var (client, baseUrl) = CreateClient(httpClientFactory, request.DeviceHost, request.DevicePort);
    var documentId = request.DocumentId;
    if (string.IsNullOrWhiteSpace(documentId))
        documentId = await ReadActiveDocumentIdAsync(client, baseUrl, identity);

    if (!string.IsNullOrWhiteSpace(documentId))
    {
        using var resumeReq = CreateRequest(HttpMethod.Post, $"{baseUrl}/v1/documents/{documentId}/resume", identity.SoftwareId, identity.SerialNo, identity.HardwareId);
        resumeReq.Content = new StringContent("", Encoding.UTF8, "application/json");
        try
        {
            using var resumeRes = await client.SendAsync(resumeReq);
            var body = await resumeRes.Content.ReadAsStringAsync();
            if (!resumeRes.IsSuccessStatusCode && !IsSuccessStatus(body))
            {
                return Results.Ok(new
                {
                    ok = false,
                    message = ExtractErrorMessage(body) ?? "Fiş devam ettirilemedi.",
                    documentId
                });
            }
        }
        catch (Exception ex)
        {
            return Results.Ok(new { ok = false, message = $"Fiş devam hatası: {ex.Message}", documentId });
        }
    }

    return Results.Ok(new
    {
        ok = true,
        message = "Yazarkasa bağlantısı tazelendi, kağıt değişimi onaylandı.",
        documentId
    });
});

app.MapPost("/document/cancel", async (DeviceActionRequest request, IHttpClientFactory httpClientFactory) =>
{
    var identity = NormalizeIdentity(request);
    var (client, baseUrl) = CreateClient(httpClientFactory, request.DeviceHost, request.DevicePort);
    var documentId = request.DocumentId;
    if (string.IsNullOrWhiteSpace(documentId))
        documentId = await ReadActiveDocumentIdAsync(client, baseUrl, identity);

    if (!string.IsNullOrWhiteSpace(documentId))
        await TryCancelAsync(client, baseUrl, documentId, identity);

    try
    {
        using var rootCancel = CreateRequest(HttpMethod.Post, $"{baseUrl}/v1/documents/cancel", identity.SoftwareId, identity.SerialNo, identity.HardwareId);
        rootCancel.Content = new StringContent("{}", Encoding.UTF8, "application/json");
        await client.SendAsync(rootCancel);
    }
    catch
    {
        // genel iptal desteklenmeyebilir
    }

    return Results.Ok(new
    {
        ok = true,
        message = "Askıdaki fiş iptal edildi.",
        documentId
    });
});

app.MapPost("/report/x", (DeviceActionRequest request, IHttpClientFactory httpClientFactory) =>
    PrintReportAsync(request, httpClientFactory, "X"));

app.MapPost("/report/z", (DeviceActionRequest request, IHttpClientFactory httpClientFactory) =>
    PrintReportAsync(request, httpClientFactory, "Z"));

app.Run();

static async Task<StartResult> StartDocumentAsync(
    HttpClient client,
    string baseUrl,
    DeviceIdentity identity,
    bool retryAfterCancel,
    ILogger logger)
{
    using var startReq = CreateRequest(HttpMethod.Post, $"{baseUrl}/v1/documents", identity.SoftwareId, identity.SerialNo, identity.HardwareId);
    startReq.Content = new StringContent("""{"docCategory":"SALE"}""", Encoding.UTF8, "application/json");
    using var startRes = await client.SendAsync(startReq);
    var startBody = await startRes.Content.ReadAsStringAsync();
    logger.LogInformation("Start HTTP {Code}: {Body}", (int)startRes.StatusCode, Truncate(startBody, 500));

    var documentId = ExtractDocumentId(startBody);
    if (!string.IsNullOrWhiteSpace(documentId) &&
        (startRes.IsSuccessStatusCode || IsSuccessStatus(startBody)))
    {
        return new StartResult(true, documentId, null, Truncate(startBody, 800));
    }

    if (retryAfterCancel &&
        ((int)startRes.StatusCode == 409 ||
         ContainsIgnoreCase(startBody, "ERR_INVALID_STATE") ||
         ContainsIgnoreCase(startBody, "uygun değil")))
    {
        logger.LogWarning("Start conflict, trying cancel+retry");
        var activeId = ExtractDocumentIdFromInstance(startBody);
        if (!string.IsNullOrWhiteSpace(activeId))
            await TryCancelAsync(client, baseUrl, activeId, identity);

        return await StartDocumentAsync(client, baseUrl, identity, retryAfterCancel: false, logger);
    }

    return new StartResult(
        false,
        null,
        ExtractErrorMessage(startBody) ??
        (startRes.IsSuccessStatusCode
            ? $"Belge başlatma SUCCESS/documentId yok. Cevap: {Truncate(startBody, 200)}"
            : $"Belge başlatılamadı: {(int)startRes.StatusCode}"),
        Truncate(startBody, 1000));
}

static async Task TryCancelAsync(HttpClient client, string baseUrl, string documentId, DeviceIdentity identity)
{
    try
    {
        using var cancelReq = CreateRequest(HttpMethod.Post, $"{baseUrl}/v1/documents/{documentId}/cancel", identity.SoftwareId, identity.SerialNo, identity.HardwareId);
        await client.SendAsync(cancelReq);
    }
    catch
    {
        // ignore
    }
}

static async Task TryCancelActiveFromStatusAsync(HttpClient client, string baseUrl, DeviceIdentity identity, ILogger logger)
{
    try
    {
        using var statusReq = CreateRequest(HttpMethod.Get, $"{baseUrl}/v1/status", identity.SoftwareId, identity.SerialNo, identity.HardwareId);
        using var statusRes = await client.SendAsync(statusReq);
        var body = await statusRes.Content.ReadAsStringAsync();
        var activeId = ExtractDocumentIdFromInstance(body) ?? ExtractDocumentId(body);
        if (!string.IsNullOrWhiteSpace(activeId))
        {
            logger.LogWarning("Cancelling active document {Id} before sale", activeId);
            await TryCancelAsync(client, baseUrl, activeId, identity);
        }
    }
    catch (Exception ex)
    {
        logger.LogDebug(ex, "pre-cancel skipped");
    }
}

static (HttpClient client, string baseUrl) CreateClient(IHttpClientFactory factory, string host, int port)
{
    var p = port is > 0 and <= 65535 ? port : 4443;
    var baseUrl = $"https://{host.Trim()}:{p}";
    var client = factory.CreateClient("hugin");
    client.Timeout = TimeSpan.FromSeconds(30);
    return (client, baseUrl);
}

static HttpRequestMessage CreateRequest(HttpMethod method, string url, string? softwareId, string? serialNo, string? hardwareId)
{
    var req = new HttpRequestMessage(method, url);
    if (!string.IsNullOrWhiteSpace(softwareId))
        req.Headers.TryAddWithoutValidation("X-SoftwareId", softwareId);
    if (!string.IsNullOrWhiteSpace(serialNo))
        req.Headers.TryAddWithoutValidation("X-SerialNo", serialNo);
    if (!string.IsNullOrWhiteSpace(hardwareId))
        req.Headers.TryAddWithoutValidation("X-HardwareId", hardwareId);
    return req;
}

static List<object> SplitPayments(SalePrintRequest request)
{
    var cash = request.CashAmount.GetValueOrDefault();
    var card = request.CardAmount.GetValueOrDefault();
    if (cash <= 0 || card <= 0) return [];
    return
    [
        new { type = "CASH", amount = cash.ToString("0.00", CultureInfo.InvariantCulture) },
        new { type = "EFT_POS", amount = card.ToString("0.00", CultureInfo.InvariantCulture) }
    ];
}

static string MapPayment(string? method) => method?.Trim().ToLowerInvariant() switch
{
    "nakit" or "cash" => "CASH",
    "kredikarti" or "kart" or "eft_pos" or "eftpos" => "EFT_POS",
    "veresiye" or "open_account" or "cari" => "OPEN_ACCOUNT",
    _ => "CASH"
};

static async Task<IResult> PrintReportAsync(DeviceActionRequest request, IHttpClientFactory httpClientFactory, string kind)
{
    if (string.IsNullOrWhiteSpace(request.DeviceHost))
        return Results.Ok(new { ok = false, message = "Yazarkasa adresi yok. Önce eşleştir." });

    var identity = NormalizeIdentity(request);
    var (client, baseUrl) = CreateClient(httpClientFactory, request.DeviceHost, request.DevicePort);
    client.Timeout = TimeSpan.FromSeconds(40);

    var endpoints = kind == "Z"
        ? new[] { "/v1/reports/Z/print", "/v1/reports/z/print", "/v1/reports/Z", "/v1/reports/z" }
        : new[] { "/v1/reports/X/print", "/v1/reports/x/print", "/v1/reports/X", "/v1/reports/x" };
    var methods = kind == "Z"
        ? new[] { HttpMethod.Post, HttpMethod.Get }
        : new[] { HttpMethod.Get, HttpMethod.Post };

    string last = "Yazarkasa rapor komutunu kabul etmedi.";
    foreach (var method in methods)
    {
        foreach (var endpoint in endpoints)
        {
            try
            {
                using var req = CreateRequest(method, baseUrl + endpoint, identity.SoftwareId, identity.SerialNo, identity.HardwareId);
                if (method == HttpMethod.Post)
                    req.Content = new StringContent("{}", Encoding.UTF8, "application/json");
                using var res = await client.SendAsync(req);
                var body = await res.Content.ReadAsStringAsync();
                if (res.IsSuccessStatusCode || IsSuccessStatus(body))
                {
                    var label = kind == "Z" ? "Z raporu alındı." : "X raporu alındı.";
                    return Results.Ok(new { ok = true, message = label });
                }
                last = ExtractErrorMessage(body) ?? $"Rapor alınamadı: {(int)res.StatusCode}";
            }
            catch (Exception ex)
            {
                last = ex.Message;
            }
        }
    }

    return Results.Ok(new { ok = false, message = last });
}

static bool IsPaperProblem(int status, string body) =>
    status == 206 ||
    ContainsIgnoreCase(body, "PAPER") ||
    ContainsIgnoreCase(body, "kagit") ||
    ContainsIgnoreCase(body, "kağıt") ||
    ContainsIgnoreCase(body, "NO_PAPER");

static PairTestRequest NormalizeIdentity(DeviceActionRequest request)
{
    if (string.IsNullOrWhiteSpace(request.SoftwareId))
        request.SoftwareId = "9217033991";
    var hw = NormalizeHardwareId(request.HardwareId);
    if (string.IsNullOrWhiteSpace(hw) || hw.Contains(':'))
        hw = "ABCD1234";
    request.HardwareId = hw;
    return new PairTestRequest
    {
        DeviceHost = request.DeviceHost,
        DevicePort = request.DevicePort,
        SerialNo = request.SerialNo,
        SoftwareId = request.SoftwareId,
        HardwareId = hw
    };
}

static async Task<string?> ReadActiveDocumentIdAsync(HttpClient client, string baseUrl, DeviceIdentity identity)
{
    try
    {
        using var statusReq = CreateRequest(HttpMethod.Get, $"{baseUrl}/v1/status", identity.SoftwareId, identity.SerialNo, identity.HardwareId);
        using var statusRes = await client.SendAsync(statusReq);
        var body = await statusRes.Content.ReadAsStringAsync();
        if (!TryParse(body, out var root)) return ExtractDocumentIdFromInstance(body);
        if (TryGetProp(root, "data", out var data) &&
            TryGetProp(data, "activeDocument", out var active) &&
            TryGetProp(active, "documentId", out var id))
            return id.GetString();
        return ExtractDocumentIdFromInstance(body) ?? ExtractDocumentId(body);
    }
    catch
    {
        return null;
    }
}

static bool IsSuccessStatus(string json)
{
    if (!TryParse(json, out var root)) return false;
    return TryGetProp(root, "status", out var s) &&
           string.Equals(s.GetString(), "SUCCESS", StringComparison.OrdinalIgnoreCase);
}

static string? ExtractDocumentId(string json)
{
    if (!TryParse(json, out var root)) return null;
    if (TryGetProp(root, "data", out var data) && TryGetProp(data, "documentId", out var id))
        return id.GetString();
    if (TryGetProp(root, "documentId", out var id2))
        return id2.GetString();
    return null;
}

static string? ExtractDocumentIdFromInstance(string json)
{
    if (!TryParse(json, out var root)) return null;
    if (TryGetProp(root, "metadata", out var meta) && TryGetProp(meta, "instance", out var inst))
    {
        var path = inst.GetString() ?? "";
        var parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var idx = Array.FindIndex(parts, p => p.Equals("documents", StringComparison.OrdinalIgnoreCase));
        if (idx >= 0 && idx + 1 < parts.Length && Guid.TryParse(parts[idx + 1], out _))
            return parts[idx + 1];
    }
    return ExtractDocumentId(json);
}

static string? ExtractReceiptNo(string json)
{
    if (!TryParse(json, out var root)) return null;
    if (TryGetProp(root, "data", out var data) && TryGetProp(data, "receiptNo", out var rn))
        return rn.GetString();
    if (TryGetProp(root, "receiptNo", out var rn2))
        return rn2.GetString();
    return null;
}

static string? ExtractSerialNo(string json)
{
    if (!TryParse(json, out var root)) return null;
    if (TryGetProp(root, "data", out var data) && TryGetProp(data, "serialNo", out var sn))
        return sn.GetString();
    if (TryGetProp(root, "serialNo", out var sn2))
        return sn2.GetString();
    return null;
}

/// <summary>
/// Hugin: 8–20 karakter. Masaüstü köprü varsayılanı ABCD1234.
/// Sadece gerçek MAC (ayraçlı veya 12 hex) colon formatına çevrilir.
/// </summary>
static string? NormalizeHardwareId(string? raw)
{
    if (string.IsNullOrWhiteSpace(raw)) return null;
    var t = raw.Trim();

    if (t.Contains(':') || t.Contains('-'))
    {
        var hex = new string(t.Where(Uri.IsHexDigit).ToArray());
        if (hex.Length == 12)
        {
            hex = hex.ToUpperInvariant();
            return string.Join(':', Enumerable.Range(0, 6).Select(i => hex.Substring(i * 2, 2)));
        }
    }

    if (t.Length is >= 8 and <= 20)
        return t;

    return null;
}

static List<string> DetectMacAddresses()
{
    var list = new List<string>();
    try
    {
        foreach (var nic in System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces())
        {
            if (nic.OperationalStatus != System.Net.NetworkInformation.OperationalStatus.Up)
                continue;
            if (nic.NetworkInterfaceType is System.Net.NetworkInformation.NetworkInterfaceType.Loopback
                or System.Net.NetworkInformation.NetworkInterfaceType.Tunnel)
                continue;

            var bytes = nic.GetPhysicalAddress().GetAddressBytes();
            if (bytes.Length != 6 || bytes.All(b => b == 0))
                continue;

            var mac = string.Join(':', bytes.Select(b => b.ToString("X2")));
            if (!list.Contains(mac, StringComparer.OrdinalIgnoreCase))
                list.Add(mac);
        }
    }
    catch
    {
        // ignore
    }

    return list;
}

static string? ExtractErrorMessage(string json)
{
    if (!TryParse(json, out var root)) return null;
    if (TryGetProp(root, "error", out var err))
    {
        TryGetProp(err, "title", out var title);
        TryGetProp(err, "description", out var desc);
        var t = title.ValueKind == JsonValueKind.String ? title.GetString() : null;
        var d = desc.ValueKind == JsonValueKind.String ? desc.GetString() : null;
        if (!string.IsNullOrWhiteSpace(t) || !string.IsNullOrWhiteSpace(d))
            return string.Join(" — ", new[] { t, d }.Where(x => !string.IsNullOrWhiteSpace(x)));
    }
    return null;
}

static bool TryParse(string json, out JsonElement root)
{
    root = default;
    try
    {
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
        root = doc.RootElement.Clone();
        return true;
    }
    catch
    {
        return false;
    }
}

static bool TryGetProp(JsonElement el, string name, out JsonElement value)
{
    if (el.ValueKind == JsonValueKind.Object)
    {
        foreach (var p in el.EnumerateObject())
        {
            if (string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase))
            {
                value = p.Value;
                return true;
            }
        }
    }
    value = default;
    return false;
}

static bool ContainsIgnoreCase(string? hay, string needle) =>
    !string.IsNullOrEmpty(hay) && hay.Contains(needle, StringComparison.OrdinalIgnoreCase);

static string Truncate(string value, int max) =>
    string.IsNullOrEmpty(value) ? value : (value.Length <= max ? value : value[..max] + "...");

sealed class StartResult(bool ok, string? documentId, string? message, string? raw)
{
    public bool Ok { get; } = ok;
    public string? DocumentId { get; } = documentId;
    public string? Message { get; } = message;
    public string? Raw { get; } = raw;
}

interface DeviceIdentity
{
    string? SerialNo { get; }
    string? SoftwareId { get; }
    string? HardwareId { get; }
}

sealed class PairTestRequest : DeviceIdentity
{
    public string DeviceHost { get; set; } = "";
    public int DevicePort { get; set; } = 4443;
    public string? SerialNo { get; set; }
    public string? SoftwareId { get; set; }
    public string? HardwareId { get; set; }
}

sealed class SalePrintItem
{
    public string Name { get; set; } = "";
    public decimal Quantity { get; set; } = 1;
    public decimal UnitPrice { get; set; }
    public decimal VatRate { get; set; } = 20;
}

sealed class DeviceActionRequest
{
    public string DeviceHost { get; set; } = "";
    public int DevicePort { get; set; } = 4443;
    public string? SerialNo { get; set; }
    public string? SoftwareId { get; set; }
    public string? HardwareId { get; set; }
    public string? DocumentId { get; set; }
}

sealed class SalePrintRequest : DeviceIdentity
{
    public string DeviceHost { get; set; } = "";
    public int DevicePort { get; set; } = 4443;
    public string? SerialNo { get; set; }
    public string? SoftwareId { get; set; }
    public string? HardwareId { get; set; }
    public string? PaymentMethod { get; set; }
    public decimal? CashAmount { get; set; }
    public decimal? CardAmount { get; set; }
    public decimal GrandTotal { get; set; }
    public string? ReferenceCode { get; set; }
    public List<SalePrintItem> Items { get; set; } = [];
}
