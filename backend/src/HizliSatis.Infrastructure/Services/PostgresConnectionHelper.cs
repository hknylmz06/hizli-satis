using Npgsql;

namespace HizliSatis.Infrastructure.Services;

public static class PostgresConnectionHelper
{
    public static string WithDatabase(string connectionString, string database)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString)
        {
            Database = database
        };
        return builder.ToString();
    }

    public static string RequireMasterConnection(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "PostgreSQL bağlantısı yok. ConnectionStrings:Master veya Database:MasterConnection ayarlayın " +
                "(Neon / Azure / DigitalOcean connection string).");
        }

        return connectionString;
    }

    public static void EnsureSafeDatabaseName(string databaseName)
    {
        if (string.IsNullOrWhiteSpace(databaseName) ||
            databaseName.Length > 63 ||
            !databaseName.All(c => char.IsAsciiLetterOrDigit(c) || c == '_'))
        {
            throw new InvalidOperationException($"Geçersiz veritabanı adı: {databaseName}");
        }
    }
}
