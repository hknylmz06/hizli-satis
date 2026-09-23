namespace HizliSatis.Infrastructure.Tenancy;

public class TenantContext : ITenantContext
{
    public Guid? TenantId { get; private set; }
    public string? FirmaKodu { get; private set; }
    public string? ConnectionString { get; private set; }
    public bool IsResolved => !string.IsNullOrWhiteSpace(ConnectionString);

    public void Set(Guid tenantId, string firmaKodu, string connectionString)
    {
        TenantId = tenantId;
        FirmaKodu = firmaKodu;
        ConnectionString = connectionString;
    }
}
