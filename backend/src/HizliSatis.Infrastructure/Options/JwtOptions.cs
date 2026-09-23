namespace HizliSatis.Infrastructure.Options;

public class JwtOptions
{
    public string Key { get; set; } = "HizliSatis-Dev-Secret-Key-Change-In-Production-32+";
    public string Issuer { get; set; } = "HizliSatis";
    public string Audience { get; set; } = "HizliSatisClients";
    public int ExpireHours { get; set; } = 12;
}
