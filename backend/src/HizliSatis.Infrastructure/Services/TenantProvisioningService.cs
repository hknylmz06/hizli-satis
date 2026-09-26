using HizliSatis.Domain.Enums;
using HizliSatis.Domain.Master;
using HizliSatis.Domain.Tenant;
using HizliSatis.Infrastructure.Persistence;
using HizliSatis.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace HizliSatis.Infrastructure.Services;

public class TenantProvisioningService(
    MasterDbContext masterDb,
    SqlServerSettingsStore sqlSettings,
    ILogger<TenantProvisioningService> logger)
{

    public async Task<Tenant> RegisterAsync(
        string name,
        string contactEmail,
        string? contactPhone,
        bool provisionNow,
        CancellationToken ct = default)
    {
        var firmaKodu = await GenerateUniqueFirmaKoduAsync(ct);
        var dbSlug = CodeGenerator.DatabaseSlug(firmaKodu);
        SqlServerConnectionHelper.EnsureSafeDatabaseName(dbSlug);

        var connectionString = sqlSettings.ForDatabase(dbSlug);

        var registeredAt = DateTime.UtcNow;
        var tenant = new Tenant
        {
            Name = name.Trim(),
            FirmaKodu = firmaKodu,
            ContactEmail = contactEmail.Trim(),
            ContactPhone = contactPhone?.Trim(),
            DatabaseName = dbSlug,
            ConnectionString = connectionString,
            Status = TenantStatus.Pending,
            CreatedAt = registeredAt,
            LicenseExpiresAt = registeredAt.AddYears(1)
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

            await EnsureDatabaseExistsAsync(tenant.DatabaseName, ct);

            tenant.ConnectionString = sqlSettings.ForDatabase(tenant.DatabaseName);

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
            logger.LogInformation("Tenant provisioned on SQL Server: {FirmaKodu} -> {Db}", tenant.FirmaKodu, tenant.DatabaseName);
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

    private async Task EnsureDatabaseExistsAsync(string databaseName, CancellationToken ct)
    {
        SqlServerConnectionHelper.EnsureSafeDatabaseName(databaseName);
        var adminCs = SqlServerSettingsStore.Build(sqlSettings.Get(), "master");

        await using var conn = new SqlConnection(adminCs);
        await conn.OpenAsync(ct);

        await using (var existsCmd = new SqlCommand("SELECT DB_ID(@name)", conn))
        {
            existsCmd.Parameters.AddWithValue("@name", databaseName);
            var exists = await existsCmd.ExecuteScalarAsync(ct);
            if (exists is not null and not DBNull)
                return;
        }

        await using var createCmd = new SqlCommand($"CREATE DATABASE [{databaseName}]", conn);
        await createCmd.ExecuteNonQueryAsync(ct);
        logger.LogInformation("Created SQL Server database {Database}", databaseName);
    }

    private async Task<string> GenerateUniqueFirmaKoduAsync(CancellationToken ct)
    {
        var codes = await masterDb.Tenants.AsNoTracking().Select(t => t.FirmaKodu).ToListAsync(ct);
        var max = 100000;
        foreach (var code in codes)
        {
            if (int.TryParse(code, out var number) && number > max)
                max = number;
        }

        return (max + 1).ToString();
    }
}
