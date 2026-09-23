namespace HizliSatis.Infrastructure.Tenancy;

public interface ITenantContext
{
    Guid? TenantId { get; }
    string? FirmaKodu { get; }
    string? ConnectionString { get; }
    bool IsResolved { get; }
    void Set(Guid tenantId, string firmaKodu, string connectionString);
}
