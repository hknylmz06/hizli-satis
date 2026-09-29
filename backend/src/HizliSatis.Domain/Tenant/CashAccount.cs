namespace HizliSatis.Domain.Tenant;

public class CashAccount
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "cash";
    public decimal Balance { get; set; }
    public decimal CommissionRate { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
