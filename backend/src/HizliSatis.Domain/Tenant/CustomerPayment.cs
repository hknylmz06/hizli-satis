namespace HizliSatis.Domain.Tenant;

public class CustomerPayment
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public int? AccountId { get; set; }
    public Customer? Customer { get; set; }
    public decimal Amount { get; set; }
    public string? Kind { get; set; } = "payment";
    public string? Note { get; set; }
    public DateTime PaidAt { get; set; } = DateTime.UtcNow;
}
