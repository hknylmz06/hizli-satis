using HizliSatis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Infrastructure.Services;

public static class TenantSchemaEnsuring
{
    public static async Task EnsureFiscalTableAsync(TenantDbContext db, CancellationToken ct = default)
    {
        // Mevcut tenant DB'lerde EnsureCreated yeni tabloları eklemez; IF NOT EXISTS ile tamamlarız.
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "FiscalDevices" (
                "Id" integer NOT NULL,
                "Provider" character varying(64) NOT NULL,
                "DeviceHost" character varying(200) NOT NULL,
                "DevicePort" integer NOT NULL,
                "SerialNo" character varying(100) NULL,
                "SoftwareId" character varying(100) NULL,
                "HardwareId" character varying(100) NULL,
                "AgentBaseUrl" character varying(300) NOT NULL,
                "IsEnabled" boolean NOT NULL,
                "IsPaired" boolean NOT NULL,
                "LastStatus" character varying(500) NULL,
                "LastPairedAt" timestamp with time zone NULL,
                "UpdatedAt" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_FiscalDevices" PRIMARY KEY ("Id")
            );
            """,
            ct);
    }
}
