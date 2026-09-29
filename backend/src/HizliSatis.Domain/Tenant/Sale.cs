using HizliSatis.Domain.Enums;

namespace HizliSatis.Domain.Tenant;

public class Sale
{
    public int Id { get; set; }
    public string ReceiptNo { get; set; } = string.Empty;
    public DateTime SoldAt { get; set; } = DateTime.UtcNow;
    public PaymentMethod PaymentMethod { get; set; }
    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public decimal SubTotal { get; set; }
    public decimal VatTotal { get; set; }
    public decimal GrandTotal { get; set; }
    public decimal CostTotal { get; set; }
    public decimal CashAmount { get; set; }
    public decimal CardAmount { get; set; }
    public int? PosAccountId { get; set; }
    public bool AccountsPosted { get; set; }
    public string? CashierUsername { get; set; }
    public List<SaleItem> Items { get; set; } = [];
}
