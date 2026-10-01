namespace HizliSatis.Domain.Tenant;

public class AppSetting
{
    public int Id { get; set; } = 1;
    public string CompanyName { get; set; } = string.Empty;
    public string CompanyAddress { get; set; } = "";
    public string CompanyPhone { get; set; } = "";
    public string CompanyTaxOffice { get; set; } = "";
    public string CompanyTaxNo { get; set; } = "";
    public string ReceiptFooter { get; set; } = "";
    public string Currency { get; set; } = "TRY";
    public decimal DefaultVatRate { get; set; } = 20;
    public bool AutoFiscalReceipt { get; set; } = true;
    public bool AskPosAccount { get; set; }
    public bool ShowInfoReceipt { get; set; }
    public bool AutoPrintInfoReceipt { get; set; }
    public string InfoPrinterName { get; set; } = "";
    public string InfoPaper { get; set; } = "80";
}
