namespace HizliSatis.Domain.Tenant;

public class FiscalDeviceSetting
{
    public int Id { get; set; } = 1;
    public string Provider { get; set; } = "HuginPcLink";
    public string DeviceHost { get; set; } = string.Empty;
    public int DevicePort { get; set; } = 4443;
    public string? SerialNo { get; set; }
    public string? SoftwareId { get; set; }
    public string? HardwareId { get; set; }
    public string AgentBaseUrl { get; set; } = "http://127.0.0.1:5055";
    public bool IsEnabled { get; set; }
    public bool IsPaired { get; set; }
    public string? LastStatus { get; set; }
    public DateTime? LastPairedAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
