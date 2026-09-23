using HizliSatis.Domain.Enums;
using HizliSatis.Domain.Master;
using HizliSatis.Domain.Tenant;
using HizliSatis.Infrastructure.Options;
using HizliSatis.Infrastructure.Persistence;
using HizliSatis.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;

namespace HizliSatis.Infrastructure.Services;

public class TenantProvisioningService(
    MasterDbContext masterDb,
    IOptions<DatabaseOptions> databaseOptions,
    ILogger<TenantProvisioningService> logger)
{
    private readonly DatabaseOptions _dbOptions = databaseOptions.Value;

    public async Task<Tenant> RegisterAsync(
        string name,
        string contactEmail,
        string? contactPhone,
        bool provisionNow,
        CancellationToken ct = default)
    {
        var masterConnection = PostgresConnectionHelper.RequireMasterConnection(
            masterDb.Database.GetConnectionString());

        var firmaKodu = await GenerateUniqueFirmaKoduAsync(ct);
        var dbSlug = CodeGenerator.DatabaseSlug(firmaKodu);
        PostgresConnectionHelper.EnsureSafeDatabaseName(dbSlug);

        var connectionString = PostgresConnectionHelper.WithDatabase(masterConnection, dbSlug);

        var tenant = new Tenant
        {
            Name = name.Trim(),
            FirmaKodu = firmaKodu,
            ContactEmail = contactEmail.Trim(),
            ContactPhone = contactPhone?.Trim(),
            DatabaseName = dbSlug,
            ConnectionString = connectionString,
            Status = TenantStatus.Pending
        };

        masterDb.Tenants.Add(tenant);
        await masterDb.SaveChangesAsync(ct);

        if (provisionNow)
            await ProvisionAsync(tenant.Id, ct);

        return await masterDb.Tenants.AsNoTracking().FirstAsync(t => t.Id == tenant.Id, ct);
    }

    public async Task<Tenant> ProvisionAsync(Guid tenantId, CancellationToken ct = default)
    {
        var tenant = await masterDb.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct)
            ?? throw new InvalidOperationException("Firma bulunamadı.");

        if (tenant.Status == TenantStatus.Ready)
            return tenant;

        tenant.Status = TenantStatus.Provisioning;
        tenant.LastError = null;
        await masterDb.SaveChangesAsync(ct);

        try
        {
            var username = string.IsNullOrWhiteSpace(tenant.InitialUsername)
                ? CodeGenerator.Username(tenant.Name)
                : tenant.InitialUsername;
            var password = string.IsNullOrWhiteSpace(tenant.InitialPasswordPlain)
                ? CodeGenerator.TemporaryPassword()
                : tenant.InitialPasswordPlain;

            var masterConnection = PostgresConnectionHelper.RequireMasterConnection(
                masterDb.Database.GetConnectionString());

            await EnsureDatabaseExistsAsync(masterConnection, tenant.DatabaseName, ct);

            // Connection string'i güncel master host/şifre ile yeniden üret (cloud'da secret rotate edilebilir)
            tenant.ConnectionString = PostgresConnectionHelper.WithDatabase(masterConnection, tenant.DatabaseName);

            await using var tenantDb = TenantDbContextFactory.CreateForConnection(tenant.ConnectionString);
            await tenantDb.Database.EnsureCreatedAsync(ct);

            if (!await tenantDb.Users.AnyAsync(ct))
            {
                tenantDb.Users.Add(new TenantUser
                {
                    Username = username,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                    DisplayName = $"{tenant.Name} Yönetici",
                    Role = "Admin"
                });
            }

            if (!await tenantDb.Settings.AnyAsync(ct))
            {
                tenantDb.Settings.Add(new AppSetting
                {
                    CompanyName = tenant.Name,
                    Currency = "TRY",
                    DefaultVatRate = 20
                });
            }

            if (!await tenantDb.Products.AnyAsync(ct))
            {
                tenantDb.Products.AddRange(
                    new Product
                    {
                        Name = "Su 0.5L",
                        Barcode = "8690000000011",
                        PurchasePrice = 5,
                        SalePrice = 10,
                        VatRate = 10,
                        StockQuantity = 100,
                        CriticalStockLevel = 20
                    },
                    new Product
                    {
                        Name = "Ekmek",
                        Barcode = "8690000000028",
                        PurchasePrice = 8,
                        SalePrice = 12,
                        VatRate = 1,
                        StockQuantity = 50,
                        CriticalStockLevel = 10
                    });
            }

            await tenantDb.SaveChangesAsync(ct);

            tenant.InitialUsername = username;
            tenant.InitialPasswordPlain = password;
            tenant.Status = TenantStatus.Ready;
            tenant.ProvisionedAt = DateTime.UtcNow;
            tenant.LastError = null;

            var body =
                $"Merhaba,\n\n{tenant.Name} hesabınız hazır.\n\n" +
                $"Firma Kodu: {tenant.FirmaKodu}\n" +
                $"Kullanıcı Adı: {username}\n" +
                $"Geçici Şifre: {password}\n\n" +
                "Giriş yaptıktan sonra şifrenizi değiştirmenizi öneririz.\n";

            masterDb.NotificationLogs.Add(new NotificationLog
            {
                TenantId = tenant.Id,
                Channel = "Email",
                Recipient = tenant.ContactEmail,
                Subject = $"{tenant.Name} — giriş bilgileriniz",
                Body = body,
                Sent = true
            });

            if (!string.IsNullOrWhiteSpace(tenant.ContactPhone))
            {
                masterDb.NotificationLogs.Add(new NotificationLog
                {
                    TenantId = tenant.Id,
                    Channel = "SMS",
                    Recipient = tenant.ContactPhone!,
                    Subject = "Giriş bilgileri",
                    Body = $"Firma:{tenant.FirmaKodu} User:{username} Sifre:{password}",
                    Sent = true
                });
            }

            await masterDb.SaveChangesAsync(ct);
            logger.LogInformation("Tenant provisioned on PostgreSQL: {FirmaKodu} -> {Db}", tenant.FirmaKodu, tenant.DatabaseName);
            return tenant;
        }
        catch (Exception ex)
        {
            tenant.Status = TenantStatus.Failed;
            tenant.LastError = ex.Message;
            await masterDb.SaveChangesAsync(ct);
            logger.LogError(ex, "Tenant provisioning failed: {TenantId}", tenantId);
            throw;
        }
    }

    private async Task EnsureDatabaseExistsAsync(string masterConnection, string databaseName, CancellationToken ct)
    {
        PostgresConnectionHelper.EnsureSafeDatabaseName(databaseName);

        var adminDatabase = string.IsNullOrWhiteSpace(_dbOptions.AdminDatabase)
            ? "postgres"
            : _dbOptions.AdminDatabase;

        var adminCs = PostgresConnectionHelper.WithDatabase(masterConnection, adminDatabase);

        await using var conn = new NpgsqlConnection(adminCs);
        await conn.OpenAsync(ct);

        await using (var existsCmd = new NpgsqlCommand(
                         "SELECT 1 FROM pg_database WHERE datname = @name", conn))
        {
            existsCmd.Parameters.AddWithValue("name", databaseName);
            var exists = await existsCmd.ExecuteScalarAsync(ct);
            if (exists is not null)
                return;
        }

        // CREATE DATABASE transaction içinde çalışmaz; Npgsql tek komut olarak gönderir.
        await using var createCmd = new NpgsqlCommand($"CREATE DATABASE \"{databaseName}\"", conn);
        await createCmd.ExecuteNonQueryAsync(ct);
        logger.LogInformation("Created PostgreSQL database {Database}", databaseName);
    }

    private async Task<string> GenerateUniqueFirmaKoduAsync(CancellationToken ct)
    {
        for (var i = 0; i < 20; i++)
        {
            var code = CodeGenerator.FirmaKodu();
            if (!await masterDb.Tenants.AnyAsync(t => t.FirmaKodu == code, ct))
                return code;
        }

        throw new InvalidOperationException("Benzersiz firma kodu üretilemedi.");
    }
}
