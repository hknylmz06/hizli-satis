var builder = WebApplication.CreateBuilder(args);

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
    tip = "Bu program yazarkasa ile bulut yazılım arasında köprüdür. Kapatmayın."
}));

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

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
                raw = Truncate(body, 500)
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
            message = $"Bağlantı kurulamadı: {ex.Message}. Aynı WiFi'de olduğundan ve port 4443 açık olduğundan emin olun.",
            deviceBaseUrl = baseUrl
        });
    }
});

app.MapPost("/sale/print", async (SalePrintRequest request, IHttpClientFactory httpClientFactory) =>
{
    if (string.IsNullOrWhiteSpace(request.DeviceHost))
        return Results.BadRequest(new { ok = false, message = "DeviceHost zorunlu." });
    if (request.Items is null || request.Items.Count == 0)
        return Results.BadRequest(new { ok = false, message = "Sepet boş." });

    var (client, baseUrl) = CreateClient(httpClientFactory, request.DeviceHost, request.DevicePort);
    client.Timeout = TimeSpan.FromSeconds(120);

    try
    {
        // 1) Belge başlat
        using var startReq = CreateRequest(HttpMethod.Post, $"{baseUrl}/v1/documents", request);
        startReq.Content = JsonContent.Create(new { docCategory = "SALE" });
        using var startRes = await client.SendAsync(startReq);
        var startBody = await startRes.Content.ReadAsStringAsync();
        if (!startRes.IsSuccessStatusCode)
        {
            return Results.Ok(new
            {
                ok = false,
                step = "start",
                message = $"Belge başlatılamadı: {(int)startRes.StatusCode}",
                raw = Truncate(startBody, 800)
            });
        }

        using var startDoc = System.Text.Json.JsonDocument.Parse(startBody);
        var root = startDoc.RootElement;
        if (!root.TryGetProperty("status", out var statusEl) ||
            !string.Equals(statusEl.GetString(), "SUCCESS", StringComparison.OrdinalIgnoreCase))
        {
            return Results.Ok(new
            {
                ok = false,
                step = "start",
                message = "Belge başlatma SUCCESS dönmedi.",
                raw = Truncate(startBody, 800)
            });
        }

        var documentId = root.GetProperty("data").GetProperty("documentId").GetString();
        if (string.IsNullOrWhiteSpace(documentId))
        {
            return Results.Ok(new
            {
                ok = false,
                step = "start",
                message = "documentId alınamadı.",
                raw = Truncate(startBody, 800)
            });
        }

        // 2) Belge sonlandır (fiş bas)
        var paymentType = MapPayment(request.PaymentMethod);
        var items = request.Items.Select(i =>
        {
            var qty = i.Quantity <= 0 ? 1m : i.Quantity;
            var lineTotal = Math.Round(i.UnitPrice * qty, 2);
            return new Dictionary<string, object?>
            {
                ["name"] = string.IsNullOrWhiteSpace(i.Name) ? "Ürün" : i.Name.Trim(),
                ["amount"] = lineTotal.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture),
                ["vatRate"] = (int)Math.Round(i.VatRate),
                ["quantity"] = qty.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture),
                ["unitPrice"] = i.UnitPrice.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture),
                ["unit"] = "AD"
            };
        }).ToList();

        var payAmount = request.GrandTotal > 0
            ? request.GrandTotal
            : items.Sum(x => decimal.Parse((string)x["amount"]!, System.Globalization.CultureInfo.InvariantCulture));

        var finalizePayload = new
        {
            items,
            payments = new[]
            {
                new
                {
                    type = paymentType,
                    amount = payAmount.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture)
                }
            },
            referenceCode = request.ReferenceCode
        };

        using var finReq = CreateRequest(HttpMethod.Put, $"{baseUrl}/v1/documents/{documentId}", request);
        finReq.Content = JsonContent.Create(finalizePayload);
        using var finRes = await client.SendAsync(finReq);
        var finBody = await finRes.Content.ReadAsStringAsync();

        // 206: ödeme alındı ama fiş basılamadı (kağıt vb.) — tekrar denenebilir
        if ((int)finRes.StatusCode == 206)
        {
            return Results.Ok(new
            {
                ok = false,
                step = "finalize",
                message = "Ödeme alındı ama fiş basılamadı (kağıt/pil?). Aynı belgele tekrar deneyin.",
                documentId,
                raw = Truncate(finBody, 1000)
            });
        }

        if (!finRes.IsSuccessStatusCode)
        {
            // Açık belgeyi iptal etmeyi dene
            try
            {
                using var cancelReq = CreateRequest(HttpMethod.Post, $"{baseUrl}/v1/documents/{documentId}/cancel", request);
                await client.SendAsync(cancelReq);
            }
            catch { /* ignore */ }

            return Results.Ok(new
            {
                ok = false,
                step = "finalize",
                message = $"Fiş basılamadı: {(int)finRes.StatusCode}",
                documentId,
                raw = Truncate(finBody, 1000)
            });
        }

        string? receiptNo = null;
        try
        {
            using var finDoc = System.Text.Json.JsonDocument.Parse(finBody);
            if (finDoc.RootElement.TryGetProperty("data", out var data) &&
                data.TryGetProperty("receiptNo", out var rn))
                receiptNo = rn.GetString();
            else if (finDoc.RootElement.TryGetProperty("receiptNo", out var rn2))
                receiptNo = rn2.GetString();
        }
        catch { /* ignore parse */ }

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
        return Results.Ok(new
        {
            ok = false,
            message = $"Yazarkasa iletişim hatası: {ex.Message}",
            deviceBaseUrl = baseUrl
        });
    }
});

app.Run();

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

static string Truncate(string value, int max) =>
    string.IsNullOrEmpty(value) ? value : (value.Length <= max ? value : value[..max] + "...");

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
