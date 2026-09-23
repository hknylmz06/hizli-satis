using HizliSatis.Domain.Enums;

namespace HizliSatis.Domain.Tenant;

public class Sale
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ReceiptNo { get; set; } = string.Empty;
    public DateTime SoldAt { get; set; } = DateTime.UtcNow;
    public PaymentMethod PaymentMethod { get; set; }
    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public decimal SubTotal { get; set; }
    public decimal VatTotal { get; set; }
    public decimal GrandTotal { get; set; }
    public decimal CostTotal { get; set; }
    public string? CashierUsername { get; set; }
    public List<SaleItem> Items { get; set; } = [];
}
