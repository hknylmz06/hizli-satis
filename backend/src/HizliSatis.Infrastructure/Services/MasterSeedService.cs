using HizliSatis.Domain.Master;
using HizliSatis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HizliSatis.Infrastructure.Services;

public class MasterSeedService(
    MasterDbContext db,
    ILogger<MasterSeedService> logger)
{
    public async Task InitializeAsync(CancellationToken ct = default)
    {
        await db.Database.EnsureCreatedAsync(ct);
        await IntIdMigration.ApplyAsync(db, ct);
        await EnsureLicenseColumnAsync(ct);
        await EnsureCatalogTableAsync(ct);

        if (!await db.PlatformAdmins.AnyAsync(ct))
        {
            db.PlatformAdmins.Add(new PlatformAdmin
            {
                Username = "admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
                DisplayName = "Platform Yöneticisi"
            });
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Platform admin seeded: admin / Admin123!");
        }
    }

    private async Task EnsureLicenseColumnAsync(CancellationToken ct)
    {
        await db.Database.ExecuteSqlRawAsync(
            """
            IF COL_LENGTH('Tenants', 'LicenseExpiresAt') IS NULL
            BEGIN
                ALTER TABLE Tenants ADD LicenseExpiresAt datetime2 NULL;
                EXEC(N'UPDATE Tenants SET LicenseExpiresAt = DATEADD(year, 1, CreatedAt)');
                EXEC(N'ALTER TABLE Tenants ALTER COLUMN LicenseExpiresAt datetime2 NOT NULL');
            END
            """,
            ct);
    }

    private async Task EnsureCatalogTableAsync(CancellationToken ct)
    {
        await db.Database.ExecuteSqlRawAsync(
            """
            IF OBJECT_ID(N'CatalogProducts', N'U') IS NULL
            BEGIN
                CREATE TABLE CatalogProducts (
                    Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_CatalogProducts PRIMARY KEY,
                    Barcode nvarchar(64) NOT NULL,
                    Name nvarchar(200) NOT NULL,
                    CategoryName nvarchar(120) NULL,
                    Unit nvarchar(32) NOT NULL CONSTRAINT DF_CatalogProducts_Unit DEFAULT N'Adet',
                    VatRate decimal(5,2) NOT NULL CONSTRAINT DF_CatalogProducts_Vat DEFAULT 20,
                    SalePrice decimal(18,2) NOT NULL CONSTRAINT DF_CatalogProducts_Price DEFAULT 0,
                    IsDomestic bit NOT NULL CONSTRAINT DF_CatalogProducts_Domestic DEFAULT 1,
                    OriginCountry nvarchar(8) NOT NULL CONSTRAINT DF_CatalogProducts_Origin DEFAULT N'TR',
                    UpdatedAt datetime2 NOT NULL CONSTRAINT DF_CatalogProducts_Updated DEFAULT SYSUTCDATETIME()
                );
                CREATE UNIQUE INDEX IX_CatalogProducts_Barcode ON CatalogProducts(Barcode);
            END
            IF COL_LENGTH(N'CatalogProducts', N'Image') IS NULL
                ALTER TABLE CatalogProducts ADD Image nvarchar(max) NULL;
            """,
            ct);
    }
}
