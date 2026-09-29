namespace HizliSatis.Domain.Tenant;

public class SaleItem
{
    public int Id { get; set; }
    public int SaleId { get; set; }
    public Sale? Sale { get; set; }
    public int? ProductId { get; set; }
    public Product? Product { get; set; }
    public int? VariantId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal PurchasePrice { get; set; }
    public decimal VatRate { get; set; }
    public decimal LineTotal { get; set; }
}
