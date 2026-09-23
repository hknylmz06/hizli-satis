namespace HizliSatis.Domain.Tenant;

public class AppSetting
{
    public int Id { get; set; } = 1;
    public string CompanyName { get; set; } = string.Empty;
    public string Currency { get; set; } = "TRY";
    public decimal DefaultVatRate { get; set; } = 20;
}
