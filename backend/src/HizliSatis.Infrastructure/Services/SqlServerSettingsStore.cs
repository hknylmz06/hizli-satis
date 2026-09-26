using System.Text.Json;
using System.Text.Json.Serialization;
using HizliSatis.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HizliSatis.Infrastructure.Services;

public sealed class SqlServerSettings
{
    public string Server { get; set; } = @"localhost\SQL";
    public int Port { get; set; } = 1433;
    public string MasterDatabase { get; set; } = "HizliSatisMaster";
    public string User { get; set; } = "";
    public string Password { get; set; } = "";
}

public sealed class SqlServerSettingsStore
{
    private readonly string _filePath;
    private readonly ILogger<SqlServerSettingsStore> _logger;
    private readonly object _gate = new();
    private SqlServerSettings _current;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public SqlServerSettingsStore(string contentRoot, ILogger<SqlServerSettingsStore> logger)
    {
        _logger = logger;
        var dir = Path.Combine(contentRoot, "data");
        Directory.CreateDirectory(dir);
        _filePath = Path.Combine(dir, "sqlserver.json");
        _current = Load();
    }

    public SqlServerSettings Get()
    {
        lock (_gate) return Clone(_current);
    }

    public string MasterConnectionString() => Build(Get(), Get().MasterDatabase);

    public string ForDatabase(string databaseName)
    {
        SqlServerConnectionHelper.EnsureSafeDatabaseName(databaseName);
        return Build(Get(), databaseName);
    }

    public void Save(SqlServerSettings incoming)
    {
        var next = Normalize(incoming);
        var previous = Get();
        if (string.IsNullOrEmpty(next.Password))
            next.Password = previous.Password;

        lock (_gate)
        {
            var json = JsonSerializer.Serialize(next, JsonOpts);
            File.WriteAllText(_filePath, json);
            _current = next;
        }

        _logger.LogInformation("SQL Server ayarı kaydedildi: {Server} / {Db}", next.Server, next.MasterDatabase);
    }

    public async Task<(bool Ok, string Message)> TestAsync(SqlServerSettings incoming, CancellationToken ct = default)
    {
        var settings = Normalize(incoming);
        if (string.IsNullOrEmpty(settings.Password))
            settings.Password = Get().Password;

        try
        {
            var adminCs = Build(settings, "master");
            await using var conn = new SqlConnection(adminCs);
            await conn.OpenAsync(ct);
            await using var cmd = new SqlCommand("SELECT @@VERSION", conn);
            var version = (await cmd.ExecuteScalarAsync(ct))?.ToString() ?? "SQL Server";
            var shortVer = version.Split('\n', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? version;
            return (true, $"Bağlantı tamam. {shortVer.Trim()}");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public async Task EnsureMasterDatabaseAsync(CancellationToken ct = default)
    {
        var settings = Get();
        SqlServerConnectionHelper.EnsureSafeDatabaseName(settings.MasterDatabase);
        var adminCs = Build(settings, "master");
        await using var conn = new SqlConnection(adminCs);
        await conn.OpenAsync(ct);

        await using var exists = new SqlCommand("SELECT DB_ID(@name)", conn);
        exists.Parameters.AddWithValue("@name", settings.MasterDatabase);
        var id = await exists.ExecuteScalarAsync(ct);
        if (id is not null and not DBNull)
            return;

        var sql = $"CREATE DATABASE [{settings.MasterDatabase}]";
        await using var create = new SqlCommand(sql, conn);
        await create.ExecuteNonQueryAsync(ct);
        _logger.LogInformation("SQL Server veritabanı oluşturuldu: {Db}", settings.MasterDatabase);
    }

    public MasterDbContext CreateMasterContext()
    {
        var options = new DbContextOptionsBuilder<MasterDbContext>()
            .UseSqlServer(MasterConnectionString())
            .Options;
        return new MasterDbContext(options);
    }

    private SqlServerSettings Load()
    {
        try
        {
            if (!File.Exists(_filePath))
                return new SqlServerSettings();
            var json = File.ReadAllText(_filePath);
            return Normalize(JsonSerializer.Deserialize<SqlServerSettings>(json, JsonOpts) ?? new SqlServerSettings());
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "sqlserver.json okunamadı, varsayılan localhost kullanılacak.");
            return new SqlServerSettings();
        }
    }

    public static string Build(SqlServerSettings settings, string database)
    {
        var server = settings.Server.Trim();
        string dataSource;
        if (server.Contains('\\') || server.Contains(','))
            dataSource = server;
        else if (settings.Port > 0 && settings.Port != 1433)
            dataSource = $"{server},{settings.Port}";
        else
            dataSource = server;

        var builder = new SqlConnectionStringBuilder
        {
            DataSource = dataSource,
            InitialCatalog = database,
            TrustServerCertificate = true,
            Encrypt = true,
            ConnectTimeout = 8
        };

        if (string.IsNullOrWhiteSpace(settings.User))
            builder.IntegratedSecurity = true;
        else
        {
            builder.UserID = settings.User.Trim();
            builder.Password = settings.Password ?? "";
        }

        return builder.ConnectionString;
    }

    private static SqlServerSettings Normalize(SqlServerSettings s)
    {
        var server = string.IsNullOrWhiteSpace(s.Server) ? @"localhost\SQL" : s.Server.Trim();
        var db = string.IsNullOrWhiteSpace(s.MasterDatabase) ? "HizliSatisMaster" : s.MasterDatabase.Trim();
        SqlServerConnectionHelper.EnsureSafeDatabaseName(db);
        var port = s.Port is < 1 or > 65535 ? 1433 : s.Port;
        return new SqlServerSettings
        {
            Server = server,
            Port = port,
            MasterDatabase = db,
            User = s.User?.Trim() ?? "",
            Password = s.Password ?? ""
        };
    }

    private static SqlServerSettings Clone(SqlServerSettings s) => new()
    {
        Server = s.Server,
        Port = s.Port,
        MasterDatabase = s.MasterDatabase,
        User = s.User,
        Password = s.Password
    };
}

public static class SqlServerConnectionHelper
{
    public static void EnsureSafeDatabaseName(string databaseName)
    {
        if (string.IsNullOrWhiteSpace(databaseName) ||
            databaseName.Length > 120 ||
            !databaseName.All(c => char.IsAsciiLetterOrDigit(c) || c == '_'))
        {
            throw new InvalidOperationException($"Geçersiz veritabanı adı: {databaseName}");
        }
    }
}
