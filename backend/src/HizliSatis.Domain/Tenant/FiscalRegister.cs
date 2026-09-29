namespace HizliSatis.Domain.Tenant;

public class FiscalRegister
{
    public int Id { get; set; }
    public string Name { get; set; } = "Kasa 1";
    public string Model { get; set; } = "HUGIN S1";
    public string ConnectionType { get; set; } = "IP";
    public string DeviceHost { get; set; } = string.Empty;
    public int DevicePort { get; set; } = 4443;
    public string? ComPort { get; set; } = "COM1";
    public int BaudRate { get; set; } = 115200;
    public string? SerialNo { get; set; }
    public string? SoftwareId { get; set; }
    public string? HardwareId { get; set; } = "ABCD1234";
    public string AgentBaseUrl { get; set; } = "http://127.0.0.1:5055";
    public string BridgeBaseUrl { get; set; } = "http://127.0.0.1:8989";
    public int? UserId { get; set; }
    public bool IsEnabled { get; set; } = true;
    public bool IsPaired { get; set; }
    public string? LastStatus { get; set; }
    public DateTime? LastPairedAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
