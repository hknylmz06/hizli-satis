namespace HizliSatis.Domain.Tenant;

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public int? CategoryId { get; set; }
    public ProductCategory? Category { get; set; }
    public int? DepartmentId { get; set; }
    public Department? Department { get; set; }
    public decimal PurchasePrice { get; set; }
    public decimal SalePrice { get; set; }
    public decimal VatRate { get; set; } = 20;
    public decimal StockQuantity { get; set; }
    public decimal CriticalStockLevel { get; set; } = 5;
    public string? Unit { get; set; } = "Adet";
    public string? OriginCountry { get; set; }
    public bool? IsDomestic { get; set; }
    public decimal? UnitQty { get; set; } = 1;
    public string? UnitType { get; set; } = "Adet";
    public string? Image { get; set; }
    public List<ProductVariant> Variants { get; set; } = [];
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
