namespace HizliSatis.Domain.Tenant;

public class StockBatch
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public int? VariantId { get; set; }
    public DateTime PurchasedAt { get; set; } = DateTime.UtcNow;
    public decimal InitialQuantity { get; set; }
    public decimal RemainingQuantity { get; set; }
    public decimal UnitCost { get; set; }
    public string Source { get; set; } = "Acilis";
    public string? Note { get; set; }
}

public class SaleItemBatchUsage
{
    public int Id { get; set; }
    public int SaleItemId { get; set; }
    public int? StockBatchId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
}

public class PurchaseInvoice
{
    public int Id { get; set; }
    public string InvoiceNo { get; set; } = string.Empty;
    public string? SupplierName { get; set; }
    public DateTime PurchasedAt { get; set; } = DateTime.UtcNow;
    public decimal Total { get; set; }
    public string? PaymentKind { get; set; }
    public int? AccountId { get; set; }
    public List<PurchaseInvoiceLine> Lines { get; set; } = [];
}

public class PurchaseInvoiceLine
{
    public int Id { get; set; }
    public int InvoiceId { get; set; }
    public PurchaseInvoice? Invoice { get; set; }
    public int ProductId { get; set; }
    public int? VariantId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal LineTotal { get; set; }
}
