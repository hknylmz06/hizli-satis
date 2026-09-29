namespace HizliSatis.Domain.Master;

public class CatalogProduct
{
    public int Id { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? CategoryName { get; set; }
    public string Unit { get; set; } = "Adet";
    public decimal VatRate { get; set; } = 20;
    public decimal SalePrice { get; set; }
    public bool IsDomestic { get; set; } = true;
    public string OriginCountry { get; set; } = "TR";
    public string? Image { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
