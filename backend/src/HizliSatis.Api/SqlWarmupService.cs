using HizliSatis.Domain.Enums;
using HizliSatis.Infrastructure.Services;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Api;

public class SqlWarmupService(IServiceProvider services, ILogger<SqlWarmupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PingAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogDebug(ex, "SQL bağlantı havuzu ısıtılamadı.");
            }

            try
            {
                await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }

    private async Task PingAsync(CancellationToken ct)
    {
        using var scope = services.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<SqlServerSettingsStore>();
        await Ping(store.MasterConnectionString(), ct);

        await using var master = store.CreateMasterContext();
        var names = await master.Tenants.AsNoTracking()
            .Where(t => t.Status == TenantStatus.Ready && t.DatabaseName != "")
            .Select(t => t.DatabaseName)
            .ToListAsync(ct);

        foreach (var name in names.Distinct())
        {
            try
            {
                await Ping(store.ForDatabase(name), ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogDebug(ex, "Firma veritabanı ısıtılamadı.");
            }
        }
    }

    private static async Task Ping(string connectionString, CancellationToken ct)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new SqlCommand("SELECT 1", conn);
        await cmd.ExecuteScalarAsync(ct);
    }
}
