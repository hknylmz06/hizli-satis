using System.Collections.Concurrent;
using HizliSatis.Domain.Tenant;
using HizliSatis.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Infrastructure.Services;

public static class TenantSchemaEnsuring
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static readonly ConcurrentDictionary<string, byte> Done = new(StringComparer.OrdinalIgnoreCase);

    private static string Key(TenantDbContext db, string kind)
    {
        var cs = db.Database.GetConnectionString();
        if (string.IsNullOrWhiteSpace(cs)) return "";
        var name = new SqlConnectionStringBuilder(cs).InitialCatalog;
        return string.IsNullOrWhiteSpace(name) ? "" : kind + ":" + name;
    }

    private static bool Already(string key) => key.Length > 0 && Done.ContainsKey(key);

    private static void Mark(string key)
    {
        if (key.Length > 0) Done[key] = 1;
    }

    public static async Task EnsureFiscalTableAsync(TenantDbContext db, CancellationToken ct = default)
    {
        var key = Key(db, "fiscal");
        if (Already(key)) return;
        await Gate.WaitAsync(ct);
        try
        {
        if (Already(key)) return;
        await db.Database.ExecuteSqlRawAsync(
            """
            IF OBJECT_ID(N'FiscalDevices', N'U') IS NULL
            BEGIN
                CREATE TABLE [FiscalDevices] (
                    [Id] int NOT NULL,
                    [Provider] nvarchar(64) NOT NULL,
                    [DeviceHost] nvarchar(200) NOT NULL,
                    [DevicePort] int NOT NULL,
                    [SerialNo] nvarchar(100) NULL,
                    [SoftwareId] nvarchar(100) NULL,
                    [HardwareId] nvarchar(100) NULL,
                    [AgentBaseUrl] nvarchar(300) NOT NULL,
                    [IsEnabled] bit NOT NULL,
                    [IsPaired] bit NOT NULL,
                    [LastStatus] nvarchar(500) NULL,
                    [LastPairedAt] datetime2 NULL,
                    [UpdatedAt] datetime2 NOT NULL,
                    CONSTRAINT [PK_FiscalDevices] PRIMARY KEY ([Id])
                );
            END
            IF OBJECT_ID(N'FiscalRegisters', N'U') IS NULL
            BEGIN
                CREATE TABLE [FiscalRegisters] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [Name] nvarchar(80) NOT NULL,
                    [Model] nvarchar(40) NOT NULL,
                    [ConnectionType] nvarchar(8) NOT NULL,
                    [DeviceHost] nvarchar(200) NOT NULL,
                    [DevicePort] int NOT NULL,
                    [ComPort] nvarchar(16) NULL,
                    [BaudRate] int NOT NULL,
                    [SerialNo] nvarchar(100) NULL,
                    [SoftwareId] nvarchar(100) NULL,
                    [HardwareId] nvarchar(100) NULL,
                    [AgentBaseUrl] nvarchar(300) NOT NULL,
                    [BridgeBaseUrl] nvarchar(300) NOT NULL,
                    [UserId] int NULL,
                    [IsEnabled] bit NOT NULL,
                    [IsPaired] bit NOT NULL,
                    [LastStatus] nvarchar(500) NULL,
                    [LastPairedAt] datetime2 NULL,
                    [UpdatedAt] datetime2 NOT NULL,
                    CONSTRAINT [PK_FiscalRegisters] PRIMARY KEY ([Id])
                );
            END
            IF EXISTS (
                SELECT 1 FROM sys.columns c
                JOIN sys.types t ON c.user_type_id = t.user_type_id
                WHERE c.object_id = OBJECT_ID(N'FiscalRegisters')
                  AND c.name = N'UpdatedAt' AND t.name = N'datetimeoffset')
            BEGIN
                ALTER TABLE [FiscalRegisters] ALTER COLUMN [LastPairedAt] datetime2 NULL;
                ALTER TABLE [FiscalRegisters] ALTER COLUMN [UpdatedAt] datetime2 NOT NULL;
            END
            IF OBJECT_ID(N'FiscalRegisters', N'U') IS NOT NULL
               AND OBJECT_ID(N'FiscalDevices', N'U') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM [FiscalRegisters])
                INSERT INTO [FiscalRegisters] (
                    [Name], [Model], [ConnectionType], [DeviceHost], [DevicePort], [ComPort], [BaudRate],
                    [SerialNo], [SoftwareId], [HardwareId], [AgentBaseUrl], [BridgeBaseUrl], [UserId],
                    [IsEnabled], [IsPaired], [LastStatus], [LastPairedAt], [UpdatedAt])
                SELECT N'Kasa 1', N'HUGIN S1', N'IP', [DeviceHost], [DevicePort], N'COM1', 115200,
                    [SerialNo], [SoftwareId], [HardwareId], [AgentBaseUrl], N'http://127.0.0.1:8989', NULL,
                    [IsEnabled], [IsPaired], [LastStatus], [LastPairedAt], [UpdatedAt]
                FROM [FiscalDevices];
            """,
            ct);
        Mark(key);
        }
        finally
        {
            Gate.Release();
        }
    }

    public static async Task EnsureCategoriesAsync(TenantDbContext db, CancellationToken ct = default)
    {
        var key = Key(db, "cat");
        if (Already(key)) return;
        await Gate.WaitAsync(ct);
        try
        {
        if (Already(key)) return;
        await db.Database.ExecuteSqlRawAsync(
            """
            IF OBJECT_ID(N'Categories', N'U') IS NULL
            BEGIN
                CREATE TABLE [Categories] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [Name] nvarchar(100) NOT NULL,
                    [Color] nvarchar(20) NOT NULL,
                    [CreatedAt] datetime2 NOT NULL,
                    CONSTRAINT [PK_Categories] PRIMARY KEY ([Id])
                );
                CREATE UNIQUE INDEX [IX_Categories_Name] ON [Categories] ([Name]);
            END
            IF COL_LENGTH(N'Products', N'CategoryId') IS NULL
                ALTER TABLE [Products] ADD [CategoryId] int NULL;
            """,
            ct);
        Mark(key);
        }
        finally
        {
            Gate.Release();
        }
    }

    public static async Task EnsureDefinitionsAsync(TenantDbContext db, CancellationToken ct = default)
    {
        var key = Key(db, "def");
        if (Already(key)) return;
        await Gate.WaitAsync(ct);
        try
        {
        if (Already(key)) return;
        await IntIdMigration.ApplyAsync(db, ct);
        await db.Database.ExecuteSqlRawAsync(
            """
            IF OBJECT_ID(N'Departments', N'U') IS NULL
            BEGIN
                CREATE TABLE [Departments] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [Name] nvarchar(100) NOT NULL,
                    [Color] nvarchar(20) NOT NULL,
                    [VatRate] decimal(5,2) NOT NULL,
                    [SortOrder] int NOT NULL,
                    [CreatedAt] datetime2 NOT NULL,
                    CONSTRAINT [PK_Departments] PRIMARY KEY ([Id])
                );
                CREATE UNIQUE INDEX [IX_Departments_Name] ON [Departments] ([Name]);
            END
            IF OBJECT_ID(N'SizeOptions', N'U') IS NULL
            BEGIN
                CREATE TABLE [SizeOptions] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [Name] nvarchar(40) NOT NULL,
                    [SortOrder] int NOT NULL,
                    [CreatedAt] datetime2 NOT NULL,
                    CONSTRAINT [PK_SizeOptions] PRIMARY KEY ([Id])
                );
                CREATE UNIQUE INDEX [IX_SizeOptions_Name] ON [SizeOptions] ([Name]);
            END
            IF OBJECT_ID(N'ColorOptions', N'U') IS NULL
            BEGIN
                CREATE TABLE [ColorOptions] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [Name] nvarchar(40) NOT NULL,
                    [Hex] nvarchar(20) NOT NULL,
                    [SortOrder] int NOT NULL,
                    [CreatedAt] datetime2 NOT NULL,
                    CONSTRAINT [PK_ColorOptions] PRIMARY KEY ([Id])
                );
                CREATE UNIQUE INDEX [IX_ColorOptions_Name] ON [ColorOptions] ([Name]);
            END
            IF OBJECT_ID(N'VariantOptions', N'U') IS NULL
            BEGIN
                CREATE TABLE [VariantOptions] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [SizeOptionId] int NOT NULL,
                    [ColorOptionId] int NOT NULL,
                    [CreatedAt] datetime2 NOT NULL,
                    CONSTRAINT [PK_VariantOptions] PRIMARY KEY ([Id])
                );
                CREATE UNIQUE INDEX [IX_VariantOptions_Size_Color] ON [VariantOptions] ([SizeOptionId], [ColorOptionId]);
            END
            IF COL_LENGTH(N'Products', N'CategoryId') IS NULL
                ALTER TABLE [Products] ADD [CategoryId] int NULL;
            IF COL_LENGTH(N'Products', N'DepartmentId') IS NULL
                ALTER TABLE [Products] ADD [DepartmentId] int NULL;
            IF COL_LENGTH(N'Products', N'Unit') IS NULL
                ALTER TABLE [Products] ADD [Unit] nvarchar(40) NULL;
            IF COL_LENGTH(N'Products', N'OriginCountry') IS NULL
                ALTER TABLE [Products] ADD [OriginCountry] nvarchar(80) NULL;
            IF COL_LENGTH(N'Products', N'IsDomestic') IS NULL
                ALTER TABLE [Products] ADD [IsDomestic] bit NULL;
            IF COL_LENGTH(N'Products', N'UnitQty') IS NULL
                ALTER TABLE [Products] ADD [UnitQty] decimal(18,3) NULL;
            IF COL_LENGTH(N'Products', N'UnitType') IS NULL
                ALTER TABLE [Products] ADD [UnitType] nvarchar(40) NULL;
            IF COL_LENGTH(N'Products', N'Image') IS NULL
                ALTER TABLE [Products] ADD [Image] nvarchar(max) NULL;
            IF OBJECT_ID(N'Users', N'U') IS NOT NULL AND COL_LENGTH(N'Users', N'Permissions') IS NULL
                ALTER TABLE [Users] ADD [Permissions] nvarchar(max) NULL;
            IF OBJECT_ID(N'Customers', N'U') IS NOT NULL AND COL_LENGTH(N'Customers', N'Email') IS NULL
                ALTER TABLE [Customers] ADD [Email] nvarchar(200) NULL;
            IF OBJECT_ID(N'Customers', N'U') IS NOT NULL AND COL_LENGTH(N'Customers', N'Address') IS NULL
                ALTER TABLE [Customers] ADD [Address] nvarchar(400) NULL;
            IF OBJECT_ID(N'Customers', N'U') IS NOT NULL AND COL_LENGTH(N'Customers', N'CreditLimit') IS NULL
                ALTER TABLE [Customers] ADD [CreditLimit] decimal(18,2) NULL;
            IF OBJECT_ID(N'CustomerPayments', N'U') IS NOT NULL AND COL_LENGTH(N'CustomerPayments', N'Kind') IS NULL
                ALTER TABLE [CustomerPayments] ADD [Kind] nvarchar(20) NULL;
            IF OBJECT_ID(N'Suppliers', N'U') IS NULL
            BEGIN
                CREATE TABLE [Suppliers] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [Name] nvarchar(200) NOT NULL,
                    [Phone] nvarchar(40) NULL,
                    [Email] nvarchar(200) NULL,
                    [Address] nvarchar(400) NULL,
                    [Note] nvarchar(400) NULL,
                    [CreatedAt] datetime2 NOT NULL,
                    CONSTRAINT [PK_Suppliers] PRIMARY KEY ([Id])
                );
            END
            IF OBJECT_ID(N'Suppliers', N'U') IS NOT NULL AND COL_LENGTH(N'Suppliers', N'Balance') IS NULL
                ALTER TABLE [Suppliers] ADD [Balance] decimal(18,2) NOT NULL CONSTRAINT [DF_Suppliers_Balance] DEFAULT 0;
            IF OBJECT_ID(N'SupplierPayments', N'U') IS NULL
            BEGIN
                CREATE TABLE [SupplierPayments] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [SupplierId] int NOT NULL,
                    [Amount] decimal(18,2) NOT NULL,
                    [Kind] nvarchar(20) NULL,
                    [Note] nvarchar(400) NULL,
                    [PaidAt] datetime2 NOT NULL,
                    CONSTRAINT [PK_SupplierPayments] PRIMARY KEY ([Id])
                );
            END
            IF OBJECT_ID(N'SupplierPayments', N'U') IS NOT NULL AND COL_LENGTH(N'SupplierPayments', N'AccountId') IS NULL
                ALTER TABLE [SupplierPayments] ADD [AccountId] int NULL;
            IF OBJECT_ID(N'CustomerPayments', N'U') IS NOT NULL AND COL_LENGTH(N'CustomerPayments', N'AccountId') IS NULL
                ALTER TABLE [CustomerPayments] ADD [AccountId] int NULL;
            IF OBJECT_ID(N'CashAccounts', N'U') IS NULL
            BEGIN
                CREATE TABLE [CashAccounts] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [Name] nvarchar(120) NOT NULL,
                    [Type] nvarchar(20) NOT NULL,
                    [Balance] decimal(18,2) NOT NULL,
                    [IsActive] bit NOT NULL,
                    [CreatedAt] datetime2 NOT NULL,
                    CONSTRAINT [PK_CashAccounts] PRIMARY KEY ([Id])
                );
            END
            IF OBJECT_ID(N'CashAccounts', N'U') IS NOT NULL AND COL_LENGTH(N'CashAccounts', N'CommissionRate') IS NULL
                ALTER TABLE [CashAccounts] ADD [CommissionRate] decimal(5,2) NOT NULL CONSTRAINT [DF_CashAccounts_Commission] DEFAULT 0;
            IF OBJECT_ID(N'SaleItems', N'U') IS NOT NULL AND COL_LENGTH(N'SaleItems', N'VariantId') IS NULL
                ALTER TABLE [SaleItems] ADD [VariantId] int NULL;
            IF OBJECT_ID(N'SaleItems', N'U') IS NOT NULL
               AND EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'SaleItems') AND name = N'ProductId' AND is_nullable = 0)
                ALTER TABLE [SaleItems] ALTER COLUMN [ProductId] int NULL;
            IF OBJECT_ID(N'ProductVariants', N'U') IS NULL
            BEGIN
                CREATE TABLE [ProductVariants] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [ProductId] int NOT NULL,
                    [SizeName] nvarchar(40) NOT NULL,
                    [ColorName] nvarchar(40) NOT NULL,
                    [StockQuantity] decimal(18,3) NOT NULL,
                    CONSTRAINT [PK_ProductVariants] PRIMARY KEY ([Id])
                );
            END
            IF OBJECT_ID(N'StockBatches', N'U') IS NULL
            BEGIN
                CREATE TABLE [StockBatches] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [ProductId] int NOT NULL,
                    [VariantId] int NULL,
                    [PurchasedAt] datetime2 NOT NULL,
                    [InitialQuantity] decimal(18,3) NOT NULL,
                    [RemainingQuantity] decimal(18,3) NOT NULL,
                    [UnitCost] decimal(18,4) NOT NULL,
                    [Source] nvarchar(20) NOT NULL,
                    [Note] nvarchar(80) NULL,
                    CONSTRAINT [PK_StockBatches] PRIMARY KEY ([Id])
                );
                CREATE INDEX [IX_StockBatches_Product] ON [StockBatches] ([ProductId], [PurchasedAt]);
            END
            IF OBJECT_ID(N'SaleItemBatchUsages', N'U') IS NULL
            BEGIN
                CREATE TABLE [SaleItemBatchUsages] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [SaleItemId] int NOT NULL,
                    [StockBatchId] int NULL,
                    [Quantity] decimal(18,3) NOT NULL,
                    [UnitCost] decimal(18,4) NOT NULL,
                    CONSTRAINT [PK_SaleItemBatchUsages] PRIMARY KEY ([Id])
                );
                CREATE INDEX [IX_SaleItemBatchUsages_SaleItem] ON [SaleItemBatchUsages] ([SaleItemId]);
            END
            IF OBJECT_ID(N'PurchaseInvoices', N'U') IS NULL
            BEGIN
                CREATE TABLE [PurchaseInvoices] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [InvoiceNo] nvarchar(40) NOT NULL,
                    [SupplierName] nvarchar(200) NULL,
                    [PurchasedAt] datetime2 NOT NULL,
                    [Total] decimal(18,2) NOT NULL,
                    CONSTRAINT [PK_PurchaseInvoices] PRIMARY KEY ([Id])
                );
            END
            IF OBJECT_ID(N'PurchaseInvoices', N'U') IS NOT NULL AND COL_LENGTH(N'PurchaseInvoices', N'PaymentKind') IS NULL
                ALTER TABLE [PurchaseInvoices] ADD [PaymentKind] nvarchar(20) NULL;
            IF OBJECT_ID(N'PurchaseInvoices', N'U') IS NOT NULL AND COL_LENGTH(N'PurchaseInvoices', N'AccountId') IS NULL
                ALTER TABLE [PurchaseInvoices] ADD [AccountId] int NULL;
            IF OBJECT_ID(N'ExpenseCategories', N'U') IS NULL
            BEGIN
                CREATE TABLE [ExpenseCategories] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [Name] nvarchar(80) NOT NULL,
                    [Type] nvarchar(20) NOT NULL,
                    [Color] nvarchar(20) NOT NULL,
                    [IsActive] bit NOT NULL,
                    CONSTRAINT [PK_ExpenseCategories] PRIMARY KEY ([Id])
                );
            END
            IF OBJECT_ID(N'LedgerEntries', N'U') IS NULL
            BEGIN
                CREATE TABLE [LedgerEntries] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [AccountId] int NOT NULL,
                    [CategoryId] int NULL,
                    [Type] nvarchar(20) NOT NULL,
                    [Amount] decimal(18,2) NOT NULL,
                    [Commission] decimal(18,2) NOT NULL,
                    [NetAmount] decimal(18,2) NOT NULL,
                    [Note] nvarchar(400) NULL,
                    [CreatedAt] datetime2 NOT NULL,
                    CONSTRAINT [PK_LedgerEntries] PRIMARY KEY ([Id])
                );
            END
            IF OBJECT_ID(N'PurchaseInvoiceLines', N'U') IS NULL
            BEGIN
                CREATE TABLE [PurchaseInvoiceLines] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [InvoiceId] int NOT NULL,
                    [ProductId] int NOT NULL,
                    [VariantId] int NULL,
                    [ProductName] nvarchar(200) NOT NULL,
                    [Quantity] decimal(18,3) NOT NULL,
                    [UnitCost] decimal(18,4) NOT NULL,
                    [LineTotal] decimal(18,2) NOT NULL,
                    CONSTRAINT [PK_PurchaseInvoiceLines] PRIMARY KEY ([Id])
                );
            END
            IF COL_LENGTH(N'Sales', N'CashAmount') IS NULL
                ALTER TABLE [Sales] ADD [CashAmount] decimal(18,2) NOT NULL CONSTRAINT [DF_Sales_CashAmount] DEFAULT 0;
            IF COL_LENGTH(N'Sales', N'CardAmount') IS NULL
                ALTER TABLE [Sales] ADD [CardAmount] decimal(18,2) NOT NULL CONSTRAINT [DF_Sales_CardAmount] DEFAULT 0;
            IF COL_LENGTH(N'Sales', N'AccountsPosted') IS NULL
                ALTER TABLE [Sales] ADD [AccountsPosted] bit NOT NULL CONSTRAINT [DF_Sales_AccountsPosted] DEFAULT 0;
            IF OBJECT_ID(N'Products', N'U') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Products_Barcode' AND object_id = OBJECT_ID(N'Products'))
                CREATE INDEX [IX_Products_Barcode] ON [Products]([Barcode]);
            IF OBJECT_ID(N'PosShortcuts', N'U') IS NULL
            BEGIN
                CREATE TABLE [PosShortcuts] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [ProductId] int NOT NULL,
                    [SortOrder] int NOT NULL,
                    CONSTRAINT [PK_PosShortcuts] PRIMARY KEY ([Id])
                );
                CREATE UNIQUE INDEX [IX_PosShortcuts_Product] ON [PosShortcuts]([ProductId]);
            END
            """,
            ct);

            await db.Database.ExecuteSqlRawAsync(
                """
                UPDATE [Sales] SET [CashAmount] = [GrandTotal]
                WHERE [PaymentMethod] = 0 AND [CashAmount] = 0 AND [CardAmount] = 0;
                UPDATE [Sales] SET [CardAmount] = [GrandTotal]
                WHERE [PaymentMethod] = 1 AND [CashAmount] = 0 AND [CardAmount] = 0;
                """,
                ct);

            if (!await db.CashAccounts.AnyAsync(ct))
            {
                db.CashAccounts.Add(new CashAccount { Name = "Merkez Kasa", Type = "cash", Balance = 0, IsActive = true });
                await db.SaveChangesAsync(ct);
            }

            if (!await db.CashAccounts.AnyAsync(a => a.Type == "pos", ct))
            {
                db.CashAccounts.Add(new CashAccount { Name = "POS", Type = "pos", Balance = 0, IsActive = true });
                await db.SaveChangesAsync(ct);
            }

            if (!await db.ExpenseCategories.AnyAsync(ct))
            {
                db.ExpenseCategories.AddRange(
                    new ExpenseCategory { Name = "Kira", Type = "expense", Color = "#ef4444" },
                    new ExpenseCategory { Name = "Fatura", Type = "expense", Color = "#f97316" },
                    new ExpenseCategory { Name = "Personel", Type = "expense", Color = "#eab308" },
                    new ExpenseCategory { Name = "Diğer gelir", Type = "income", Color = "#10b981" });
                await db.SaveChangesAsync(ct);
            }

            Mark(key);
        }
        finally
        {
            Gate.Release();
        }
    }
}
