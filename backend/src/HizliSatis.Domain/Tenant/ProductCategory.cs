namespace HizliSatis.Domain.Tenant;

public class ProductCategory
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = "#10b981";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
