namespace HizliSatis.Domain.Tenant;

public class Department
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = "#6366f1";
    public decimal VatRate { get; set; } = 20;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class SizeOption
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ColorOption
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Hex { get; set; } = "#64748b";
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ProductVariant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public string SizeName { get; set; } = string.Empty;
    public string ColorName { get; set; } = string.Empty;
    public decimal StockQuantity { get; set; }
}

public class VariantOption
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SizeOptionId { get; set; }
    public SizeOption? Size { get; set; }
    public Guid ColorOptionId { get; set; }
    public ColorOption? Color { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
