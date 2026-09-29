using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Infrastructure.Services;

public static class IntIdMigration
{
    private static readonly (string Table, string Column, string Parent)[] ForeignKeys =
    [
        ("Products", "CategoryId", "Categories"),
        ("Products", "DepartmentId", "Departments"),
        ("ProductVariants", "ProductId", "Products"),
        ("VariantOptions", "SizeOptionId", "SizeOptions"),
        ("VariantOptions", "ColorOptionId", "ColorOptions"),
        ("Sales", "CustomerId", "Customers"),
        ("SaleItems", "SaleId", "Sales"),
        ("SaleItems", "ProductId", "Products"),
        ("SaleItems", "VariantId", "ProductVariants"),
        ("CustomerPayments", "CustomerId", "Customers"),
        ("CustomerPayments", "AccountId", "CashAccounts"),
        ("SupplierPayments", "SupplierId", "Suppliers"),
        ("SupplierPayments", "AccountId", "CashAccounts"),
        ("StockBatches", "ProductId", "Products"),
        ("StockBatches", "VariantId", "ProductVariants"),
        ("SaleItemBatchUsages", "SaleItemId", "SaleItems"),
        ("SaleItemBatchUsages", "StockBatchId", "StockBatches"),
        ("PurchaseInvoices", "AccountId", "CashAccounts"),
        ("PurchaseInvoiceLines", "InvoiceId", "PurchaseInvoices"),
        ("PurchaseInvoiceLines", "ProductId", "Products"),
        ("PurchaseInvoiceLines", "VariantId", "ProductVariants"),
        ("LedgerEntries", "AccountId", "CashAccounts"),
        ("LedgerEntries", "CategoryId", "ExpenseCategories"),
        ("NotificationLogs", "TenantId", "Tenants")
    ];

    public static async Task ApplyAsync(DbContext db, CancellationToken ct = default)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync(ct);

        var tables = new List<string>();
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = """
                SELECT t.name
                FROM sys.tables t
                JOIN sys.columns c ON c.object_id = t.object_id AND c.name = N'Id'
                JOIN sys.types ty ON ty.user_type_id = c.user_type_id
                WHERE ty.name = N'uniqueidentifier' AND t.is_ms_shipped = 0
                ORDER BY t.name
                """;
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                tables.Add(reader.GetString(0));
        }

        if (tables.Count == 0)
            return;

        await Exec(conn, """
            IF OBJECT_ID(N'__IdMap', N'U') IS NULL
            CREATE TABLE [__IdMap] (
                [Tbl] nvarchar(128) NOT NULL,
                [OldId] uniqueidentifier NOT NULL,
                [NewId] int NOT NULL,
                CONSTRAINT [PK___IdMap] PRIMARY KEY ([Tbl], [OldId])
            );
            """, ct);

        foreach (var table in tables)
        {
            if (!await ColumnExists(conn, table, "IdNew", ct))
                await Exec(conn, $"ALTER TABLE [{table}] ADD [IdNew] int IDENTITY(1,1) NOT NULL;", ct);

            await Exec(conn, $"""
                INSERT INTO [__IdMap] ([Tbl], [OldId], [NewId])
                SELECT N'{table}', src.[Id], src.[IdNew]
                FROM [{table}] src
                WHERE NOT EXISTS (
                    SELECT 1 FROM [__IdMap] m WHERE m.[Tbl] = N'{table}' AND m.[OldId] = src.[Id]
                );
                """, ct);
        }

        foreach (var (table, column, parent) in ForeignKeys)
        {
            if (!tables.Contains(table) && !await TableExists(conn, table, ct))
                continue;
            if (!await IsGuidColumn(conn, table, column, ct))
                continue;
            var neu = column + "New";
            if (!await ColumnExists(conn, table, neu, ct))
                await Exec(conn, $"ALTER TABLE [{table}] ADD [{neu}] int NULL;", ct);
            await Exec(conn, $"""
                UPDATE child
                SET [{neu}] = map.[NewId]
                FROM [{table}] child
                INNER JOIN [__IdMap] map ON map.[Tbl] = N'{parent}' AND map.[OldId] = child.[{column}]
                WHERE child.[{neu}] IS NULL;
                """, ct);
        }

        await Exec(conn, """
            DECLARE @dropFk nvarchar(max) = N'';
            SELECT @dropFk += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + N'.' + QUOTENAME(OBJECT_NAME(parent_object_id)) + N' DROP CONSTRAINT ' + QUOTENAME(name) + N';'
            FROM sys.foreign_keys;
            IF LEN(@dropFk) > 0 EXEC sp_executesql @dropFk;
            """, ct);

        foreach (var table in tables)
        {
            await Exec(conn, $"""
                DECLARE @sql nvarchar(max) = N'';
                SELECT @sql += N'ALTER TABLE [{table}] DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';'
                FROM sys.default_constraints dc
                JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
                WHERE dc.parent_object_id = OBJECT_ID(N'{table}')
                  AND EXISTS (
                    SELECT 1 FROM sys.types ty
                    WHERE ty.user_type_id = c.user_type_id AND ty.name = N'uniqueidentifier'
                  );
                IF LEN(@sql) > 0 EXEC sp_executesql @sql;

                SET @sql = N'';
                SELECT @sql += N'DROP INDEX ' + QUOTENAME(i.name) + N' ON [{table}];'
                FROM sys.indexes i
                WHERE i.object_id = OBJECT_ID(N'{table}') AND i.is_primary_key = 0 AND i.type > 0 AND i.name IS NOT NULL;
                IF LEN(@sql) > 0 EXEC sp_executesql @sql;

                SET @sql = N'';
                SELECT @sql += N'ALTER TABLE [{table}] DROP CONSTRAINT ' + QUOTENAME(kc.name) + N';'
                FROM sys.key_constraints kc
                WHERE kc.parent_object_id = OBJECT_ID(N'{table}') AND kc.type = N'PK';
                IF LEN(@sql) > 0 EXEC sp_executesql @sql;
                """, ct);

            foreach (var (fkTable, column, _) in ForeignKeys.Where(fk => fk.Table == table))
            {
                if (!await ColumnExists(conn, fkTable, column + "New", ct))
                    continue;
                if (await ColumnExists(conn, fkTable, column, ct))
                    await Exec(conn, $"ALTER TABLE [{fkTable}] DROP COLUMN [{column}];", ct);
                await Exec(conn, $"EXEC sp_rename N'{fkTable}.{column}New', N'{column}', N'COLUMN';", ct);
            }

            await Exec(conn, $"ALTER TABLE [{table}] DROP COLUMN [Id];", ct);
            await Exec(conn, $"EXEC sp_rename N'{table}.IdNew', N'Id', N'COLUMN';", ct);
            await Exec(conn, $"ALTER TABLE [{table}] ADD CONSTRAINT [PK_{table}] PRIMARY KEY ([Id]);", ct);
        }

        await Exec(conn, "DROP TABLE [__IdMap];", ct);
    }

    private static async Task<bool> TableExists(System.Data.Common.DbConnection conn, string table, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT CASE WHEN OBJECT_ID(@t, N'U') IS NULL THEN 0 ELSE 1 END";
        var p = cmd.CreateParameter();
        p.ParameterName = "@t";
        p.Value = table;
        cmd.Parameters.Add(p);
        var value = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(value) == 1;
    }

    private static async Task<bool> ColumnExists(System.Data.Common.DbConnection conn, string table, string column, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT CASE WHEN COL_LENGTH(@t, @c) IS NULL THEN 0 ELSE 1 END";
        var t = cmd.CreateParameter();
        t.ParameterName = "@t";
        t.Value = table;
        var c = cmd.CreateParameter();
        c.ParameterName = "@c";
        c.Value = column;
        cmd.Parameters.Add(t);
        cmd.Parameters.Add(c);
        var value = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(value) == 1;
    }

    private static async Task<bool> IsGuidColumn(System.Data.Common.DbConnection conn, string table, string column, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT CASE WHEN EXISTS (
                SELECT 1
                FROM sys.columns c
                JOIN sys.types ty ON ty.user_type_id = c.user_type_id
                WHERE c.object_id = OBJECT_ID(@t) AND c.name = @c AND ty.name = N'uniqueidentifier'
            ) THEN 1 ELSE 0 END
            """;
        var t = cmd.CreateParameter();
        t.ParameterName = "@t";
        t.Value = table;
        var c = cmd.CreateParameter();
        c.ParameterName = "@c";
        c.Value = column;
        cmd.Parameters.Add(t);
        cmd.Parameters.Add(c);
        var value = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(value) == 1;
    }

    private static async Task Exec(System.Data.Common.DbConnection conn, string sql, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandTimeout = 180;
        cmd.CommandText = sql;
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
