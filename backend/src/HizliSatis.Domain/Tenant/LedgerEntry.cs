namespace HizliSatis.Domain.Tenant;

public class LedgerEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AccountId { get; set; }
    public Guid? CategoryId { get; set; }
    public string Type { get; set; } = "expense";
    public decimal Amount { get; set; }
    public decimal Commission { get; set; }
    public decimal NetAmount { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
