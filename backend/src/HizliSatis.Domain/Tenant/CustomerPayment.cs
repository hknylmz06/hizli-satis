namespace HizliSatis.Domain.Tenant;

public class CustomerPayment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public decimal Amount { get; set; }
    public string? Note { get; set; }
    public DateTime PaidAt { get; set; } = DateTime.UtcNow;
}
