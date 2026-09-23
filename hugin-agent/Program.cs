using System.Diagnostics;
using System.Globalization;
using System.Net;
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
app.UseCors();

app.MapGet("/", () => Results.Ok(new
{
    name = "HizliSatis Hugin Agent",
    status = "ok",
    tip = "Gizli çalışır. Kapatmayın."
}));

app.MapGet("/health", () => Results.Ok(new { status = "ok", pid = Environment.ProcessId }));

app.MapPost("/pair/test", async (PairTestRequest request, IHttpClientFactory httpClientFactory) =>
{
    if (string.IsNullOrWhiteSpace(request.DeviceHost))
        return Results.BadRequest(new { ok = false, message = "DeviceHost zorunlu." });

    var (client, baseUrl) = CreateClient(httpClientFactory, request.DeviceHost, request.DevicePort);
    using var httpRequest = CreateRequest(HttpMethod.Get, $"{baseUrl}/v1/status", request);

    try
    {
        using var response = await client.SendAsync(httpRequest);
        var body = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            return Results.Ok(new
            {
                ok = false,
                message = $"Yazarkasa yanıt verdi ama hata: {(int)response.StatusCode}",
                deviceBaseUrl = baseUrl,
                raw = Truncate(body, 800)
            });
        }

        return Results.Ok(new
        {
            ok = true,
            message = "Eşleşme başarılı — yazarkasa PC Link API erişilebilir.",
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
            deviceBaseUrl = baseUrl
        });
    }
});

app.MapPost("/sale/print", async (SalePrintRequest request, IHttpClientFactory httpClientFactory, ILogger<Program> logger) =>
{
    if (string.IsNullOrWhiteSpace(request.DeviceHost))
        return Results.BadRequest(new { ok = false, message = "DeviceHost zorunlu." });
    if (request.Items is null || request.Items.Count == 0)
        return Results.BadRequest(new { ok = false, message = "Sepet boş." });

    var (client, baseUrl) = CreateClient(httpClientFactory, request.DeviceHost, request.DevicePort);
    client.Timeout = TimeSpan.FromSeconds(120);

    try
    {
        var start = await StartDocumentAsync(client, baseUrl, request, retryAfterCancel: true, logger);
        if (!start.Ok)
            return Results.Ok(start);

        var documentId = start.DocumentId!;
        var paymentType = MapPayment(request.PaymentMethod);
        var items = request.Items.Select(i =>
        {
            var qty = i.Quantity <= 0 ? 1m : i.Quantity;
            var lineTotal = Math.Round(i.UnitPrice * qty, 2);
            return new Dictionary<string, object?>
            {
                ["name"] = string.IsNullOrWhiteSpace(i.Name) ? "Ürün" : i.Name.Trim(),
                ["amount"] = lineTotal.ToString("0.00", CultureInfo.InvariantCulture),
                ["vatRate"] = (int)Math.Round(i.VatRate),
                ["quantity"] = qty.ToString("0.###", CultureInfo.InvariantCulture),
                ["unitPrice"] = i.UnitPrice.ToString("0.00", CultureInfo.InvariantCulture),
                ["unit"] = "AD"
            };
        }).ToList();

        var payAmount = request.GrandTotal > 0
            ? request.GrandTotal
            : items.Sum(x => decimal.Parse((string)x["amount"]!, CultureInfo.InvariantCulture));

        var finalizePayload = new
        {
            items,
            payments = new[]
            {
                new
                {
                    type = paymentType,
                    amount = payAmount.ToString("0.00", CultureInfo.InvariantCulture)
                }
            },
            referenceCode = request.ReferenceCode
        };

        using var finReq = CreateRequest(HttpMethod.Put, $"{baseUrl}/v1/documents/{documentId}", request);
        finReq.Content = JsonContent.Create(finalizePayload);
        using var finRes = await client.SendAsync(finReq);
        var finBody = await finRes.Content.ReadAsStringAsync();
        logger.LogInformation("Finalize HTTP {Code}: {Body}", (int)finRes.StatusCode, Truncate(finBody, 500));

        if ((int)finRes.StatusCode == 206)
        {
            return Results.Ok(new
            {
                ok = false,
                step = "finalize",
                message = "Ödeme alındı ama fiş basılamadı (kağıt/pil?).",
                documentId,
                raw = Truncate(finBody, 1000)
            });
        }

        if (!finRes.IsSuccessStatusCode)
        {
            await TryCancelAsync(client, baseUrl, documentId, request);
            return Results.Ok(new
            {
                ok = false,
                step = "finalize",
                message = ExtractErrorMessage(finBody) ?? $"Fiş basılamadı: {(int)finRes.StatusCode}",
                documentId,
                raw = Truncate(finBody, 1000)
            });
        }

        var receiptNo = ExtractReceiptNo(finBody);
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

app.Run();

static async Task<StartResult> StartDocumentAsync(
    HttpClient client,
    string baseUrl,
    DeviceHeaders headers,
    bool retryAfterCancel,
    ILogger logger)
{
    using var startReq = CreateRequest(HttpMethod.Post, $"{baseUrl}/v1/documents", headers);
    startReq.Content = JsonContent.Create(new { docCategory = "SALE" });
    using var startRes = await client.SendAsync(startReq);
    var startBody = await startRes.Content.ReadAsStringAsync();
    logger.LogInformation("Start HTTP {Code}: {Body}", (int)startRes.StatusCode, Truncate(startBody, 500));

    var documentId = ExtractDocumentId(startBody);
    if (!string.IsNullOrWhiteSpace(documentId) &&
        (startRes.IsSuccessStatusCode || IsSuccessStatus(startBody)))
    {
        return new StartResult(true, documentId, null, Truncate(startBody, 800));
    }

    // Açık belge / state hatası → iptal edip bir kez daha dene
    if (retryAfterCancel &&
        ((int)startRes.StatusCode == 409 ||
         ContainsIgnoreCase(startBody, "ERR_INVALID_STATE") ||
         ContainsIgnoreCase(startBody, "uygun değil")))
    {
        logger.LogWarning("Start conflict, trying cancel+retry");
        // Bazı cihazlarda aktif belge id'si error.metadata.instance içinde olabilir
        var activeId = ExtractDocumentIdFromInstance(startBody);
        if (!string.IsNullOrWhiteSpace(activeId))
            await TryCancelAsync(client, baseUrl, activeId, headers);

        return await StartDocumentAsync(client, baseUrl, headers, retryAfterCancel: false, logger);
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

static async Task TryCancelAsync(HttpClient client, string baseUrl, string documentId, DeviceHeaders headers)
{
    try
    {
        using var cancelReq = CreateRequest(HttpMethod.Post, $"{baseUrl}/v1/documents/{documentId}/cancel", headers);
        await client.SendAsync(cancelReq);
    }
    catch
    {
        // ignore
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

static HttpRequestMessage CreateRequest(HttpMethod method, string url, DeviceHeaders headers)
{
    var req = new HttpRequestMessage(method, url);
    if (!string.IsNullOrWhiteSpace(headers.SoftwareId))
        req.Headers.TryAddWithoutValidation("X-SoftwareId", headers.SoftwareId);
    if (!string.IsNullOrWhiteSpace(headers.SerialNo))
        req.Headers.TryAddWithoutValidation("X-SerialNo", headers.SerialNo);
    if (!string.IsNullOrWhiteSpace(headers.HardwareId))
        req.Headers.TryAddWithoutValidation("X-HardwareId", headers.HardwareId);
    return req;
}

static string MapPayment(string? method) => method?.Trim().ToLowerInvariant() switch
{
    "nakit" or "cash" => "CASH",
    "kredikarti" or "kart" or "eft_pos" or "eftpos" => "EFT_POS",
    "veresiye" or "open_account" or "cari" => "OPEN_ACCOUNT",
    _ => "CASH"
};

static bool IsSuccessStatus(string json)
{
    if (!TryParse(json, out var root)) return false;
    if (TryGetProp(root, "status", out var s) &&
        string.Equals(s.GetString(), "SUCCESS", StringComparison.OrdinalIgnoreCase))
        return true;
    return false;
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
        // /documents/{guid}
        var parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var idx = Array.FindIndex(parts, p => p.Equals("documents", StringComparison.OrdinalIgnoreCase));
        if (idx >= 0 && idx + 1 < parts.Length && Guid.TryParse(parts[idx + 1], out _))
            return parts[idx + 1];
    }
    if (TryGetProp(root, "error", out var err) && TryGetProp(err, "description", out _))
    {
        // fallback none
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

record StartResult(bool Ok, string? DocumentId, string? Message, string? Raw)
{
    public string? message => Message;
    public string? raw => Raw;
    public bool ok => Ok;
    public string? documentId => DocumentId;
    public string step => "start";
}

abstract record DeviceHeaders(string? SerialNo, string? SoftwareId, string? HardwareId);

record PairTestRequest(
    string DeviceHost,
    int DevicePort,
    string? SerialNo,
    string? SoftwareId,
    string? HardwareId) : DeviceHeaders(SerialNo, SoftwareId, HardwareId);

record SalePrintItem(string Name, decimal Quantity, decimal UnitPrice, decimal VatRate);

record SalePrintRequest(
    string DeviceHost,
    int DevicePort,
    string? SerialNo,
    string? SoftwareId,
    string? HardwareId,
    string? PaymentMethod,
    decimal GrandTotal,
    string? ReferenceCode,
    List<SalePrintItem> Items) : DeviceHeaders(SerialNo, SoftwareId, HardwareId);
