namespace HizliSatis.Domain.Tenant;

public class Department
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = "#6366f1";
    public decimal VatRate { get; set; } = 20;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class SizeOption
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ColorOption
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Hex { get; set; } = "#64748b";
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ProductVariant
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public string SizeName { get; set; } = string.Empty;
    public string ColorName { get; set; } = string.Empty;
    public decimal StockQuantity { get; set; }
}

public class VariantOption
{
    public int Id { get; set; }
    public int SizeOptionId { get; set; }
    public SizeOption? Size { get; set; }
    public int ColorOptionId { get; set; }
    public ColorOption? Color { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
