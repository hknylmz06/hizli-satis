namespace HizliSatis.Domain.Tenant;

public class ExpenseCategory
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "expense";
    public string Color { get; set; } = "#ef4444";
    public bool IsActive { get; set; } = true;
}
