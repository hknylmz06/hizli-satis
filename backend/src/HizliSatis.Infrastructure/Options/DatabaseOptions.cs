namespace HizliSatis.Infrastructure.Options;

public class DatabaseOptions
{
    /// <summary>
    /// Master (platform) veritabanı connection string.
    /// Örn: Host=...;Port=5432;Database=hizlisatis_master;Username=...;Password=...;SSL Mode=Require
    /// </summary>
    public string MasterConnection { get; set; } = string.Empty;

    /// <summary>
    /// CREATE DATABASE komutu için bağlanılacak yönetim DB adı (genelde postgres).
    /// Neon'da mevcut bir DB adı da kullanılabilir (ör. neondb).
    /// </summary>
    public string AdminDatabase { get; set; } = "postgres";
}
