namespace HizliSatis.Infrastructure.Tenancy;

public interface ITenantContext
{
    int? TenantId { get; }
    string? FirmaKodu { get; }
    string? ConnectionString { get; }
    bool IsResolved { get; }
    void Set(int tenantId, string firmaKodu, string connectionString);
}
