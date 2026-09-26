namespace HizliSatis.Domain.Tenant;

public class ExpenseCategory
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "expense";
    public string Color { get; set; } = "#ef4444";
    public bool IsActive { get; set; } = true;
}
