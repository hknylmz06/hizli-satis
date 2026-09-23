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
        // Yazarkasa genelde self-signed sertifika kullanır
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

    var port = request.DevicePort is > 0 and <= 65535 ? request.DevicePort : 4443;
    var baseUrl = $"https://{request.DeviceHost.Trim()}:{port}";
    var client = httpClientFactory.CreateClient("hugin");
    client.Timeout = TimeSpan.FromSeconds(12);

    using var httpRequest = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/v1/status");
    if (!string.IsNullOrWhiteSpace(request.SoftwareId))
        httpRequest.Headers.TryAddWithoutValidation("X-SoftwareId", request.SoftwareId);
    if (!string.IsNullOrWhiteSpace(request.SerialNo))
        httpRequest.Headers.TryAddWithoutValidation("X-SerialNo", request.SerialNo);
    if (!string.IsNullOrWhiteSpace(request.HardwareId))
        httpRequest.Headers.TryAddWithoutValidation("X-HardwareId", request.HardwareId);

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

app.Run();

static string Truncate(string value, int max) =>
    string.IsNullOrEmpty(value) ? value : (value.Length <= max ? value : value[..max] + "...");

record PairTestRequest(
    string DeviceHost,
    int DevicePort,
    string? SerialNo,
    string? SoftwareId,
    string? HardwareId);
