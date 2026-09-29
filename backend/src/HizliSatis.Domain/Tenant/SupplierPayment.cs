namespace HizliSatis.Domain.Tenant;

public class SupplierPayment
{
    public int Id { get; set; }
    public int SupplierId { get; set; }
    public int? AccountId { get; set; }
    public Supplier? Supplier { get; set; }
    public decimal Amount { get; set; }
    public string? Kind { get; set; } = "payment";
    public string? Note { get; set; }
    public DateTime PaidAt { get; set; } = DateTime.UtcNow;
}
