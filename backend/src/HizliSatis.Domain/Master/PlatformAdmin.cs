namespace HizliSatis.Domain.Master;

public class PlatformAdmin
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string DisplayName { get; set; } = "Platform Admin";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
