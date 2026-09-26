namespace HizliSatis.Domain.Tenant;

public class StockBatch
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProductId { get; set; }
    public Guid? VariantId { get; set; }
    public DateTime PurchasedAt { get; set; } = DateTime.UtcNow;
    public decimal InitialQuantity { get; set; }
    public decimal RemainingQuantity { get; set; }
    public decimal UnitCost { get; set; }
    public string Source { get; set; } = "Acilis";
    public string? Note { get; set; }
}

public class SaleItemBatchUsage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SaleItemId { get; set; }
    public Guid? StockBatchId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
}

public class PurchaseInvoice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string InvoiceNo { get; set; } = string.Empty;
    public string? SupplierName { get; set; }
    public DateTime PurchasedAt { get; set; } = DateTime.UtcNow;
    public decimal Total { get; set; }
    public string? PaymentKind { get; set; }
    public Guid? AccountId { get; set; }
    public List<PurchaseInvoiceLine> Lines { get; set; } = [];
}

public class PurchaseInvoiceLine
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid InvoiceId { get; set; }
    public PurchaseInvoice? Invoice { get; set; }
    public Guid ProductId { get; set; }
    public Guid? VariantId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal LineTotal { get; set; }
}
