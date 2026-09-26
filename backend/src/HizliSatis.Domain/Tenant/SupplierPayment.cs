namespace HizliSatis.Domain.Tenant;

public class SupplierPayment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SupplierId { get; set; }
    public Guid? AccountId { get; set; }
    public Supplier? Supplier { get; set; }
    public decimal Amount { get; set; }
    public string? Kind { get; set; } = "payment";
    public string? Note { get; set; }
    public DateTime PaidAt { get; set; } = DateTime.UtcNow;
}
