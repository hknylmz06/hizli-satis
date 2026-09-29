namespace HizliSatis.Domain.Tenant;

public class ProductCategory
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = "#10b981";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
