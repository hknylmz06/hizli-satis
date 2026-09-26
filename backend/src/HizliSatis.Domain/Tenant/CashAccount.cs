namespace HizliSatis.Domain.Tenant;

public class CashAccount
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "cash";
    public decimal Balance { get; set; }
    public decimal CommissionRate { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
