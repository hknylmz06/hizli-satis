namespace HizliSatis.Domain.Tenant;

public class Customer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? Note { get; set; }
    public decimal CreditLimit { get; set; }
    public decimal Balance { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
