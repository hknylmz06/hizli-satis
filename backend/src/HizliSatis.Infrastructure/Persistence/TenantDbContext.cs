using HizliSatis.Domain.Tenant;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Infrastructure.Persistence;

public class TenantDbContext(DbContextOptions<TenantDbContext> options) : DbContext(options)
{
    public DbSet<TenantUser> Users => Set<TenantUser>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<PosShortcut> PosShortcuts => Set<PosShortcut>();
    public DbSet<ProductCategory> Categories => Set<ProductCategory>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<SizeOption> SizeOptions => Set<SizeOption>();
    public DbSet<ColorOption> ColorOptions => Set<ColorOption>();
    public DbSet<VariantOption> VariantOptions => Set<VariantOption>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<SupplierPayment> SupplierPayments => Set<SupplierPayment>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<StockBatch> StockBatches => Set<StockBatch>();
    public DbSet<SaleItemBatchUsage> SaleItemBatchUsages => Set<SaleItemBatchUsage>();
    public DbSet<PurchaseInvoice> PurchaseInvoices => Set<PurchaseInvoice>();
    public DbSet<PurchaseInvoiceLine> PurchaseInvoiceLines => Set<PurchaseInvoiceLine>();
    public DbSet<CustomerPayment> CustomerPayments => Set<CustomerPayment>();
    public DbSet<CashAccount> CashAccounts => Set<CashAccount>();
    public DbSet<ExpenseCategory> ExpenseCategories => Set<ExpenseCategory>();
    public DbSet<LedgerEntry> LedgerEntries => Set<LedgerEntry>();
    public DbSet<AppSetting> Settings => Set<AppSetting>();
    public DbSet<FiscalDeviceSetting> FiscalDevices => Set<FiscalDeviceSetting>();
    public DbSet<FiscalRegister> FiscalRegisters => Set<FiscalRegister>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TenantUser>(e =>
        {
            e.HasIndex(x => x.Username).IsUnique();
            e.Property(x => x.Username).HasMaxLength(100);
            e.Property(x => x.Permissions).HasColumnType("nvarchar(max)");
        });

        modelBuilder.Entity<ProductCategory>(e =>
        {
            e.ToTable("Categories");
            e.HasIndex(x => x.Name).IsUnique();
            e.Property(x => x.Name).HasMaxLength(100);
            e.Property(x => x.Color).HasMaxLength(20);
        });

        modelBuilder.Entity<Product>(e =>
        {
            e.HasIndex(x => x.Barcode);
            e.Property(x => x.Name).HasMaxLength(200);
            e.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.Department).WithMany().HasForeignKey(x => x.DepartmentId).OnDelete(DeleteBehavior.SetNull);
            e.Property(x => x.Barcode).HasMaxLength(64);
            e.Property(x => x.PurchasePrice).HasPrecision(18, 2);
            e.Property(x => x.SalePrice).HasPrecision(18, 2);
            e.Property(x => x.VatRate).HasPrecision(5, 2);
            e.Property(x => x.StockQuantity).HasPrecision(18, 3);
            e.Property(x => x.CriticalStockLevel).HasPrecision(18, 3);
            e.Property(x => x.Unit).HasMaxLength(40);
            e.Property(x => x.OriginCountry).HasMaxLength(80);
            e.Property(x => x.UnitQty).HasPrecision(18, 3);
            e.Property(x => x.UnitType).HasMaxLength(40);
            e.HasMany(x => x.Variants).WithOne(x => x.Product!).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ProductVariant>(e =>
        {
            e.Property(x => x.SizeName).HasMaxLength(40);
            e.Property(x => x.ColorName).HasMaxLength(40);
            e.Property(x => x.StockQuantity).HasPrecision(18, 3);
        });

        modelBuilder.Entity<Department>(e =>
        {
            e.HasIndex(x => x.Name).IsUnique();
            e.Property(x => x.Name).HasMaxLength(100);
            e.Property(x => x.Color).HasMaxLength(20);
            e.Property(x => x.VatRate).HasPrecision(5, 2);
        });

        modelBuilder.Entity<SizeOption>(e =>
        {
            e.HasIndex(x => x.Name).IsUnique();
            e.Property(x => x.Name).HasMaxLength(40);
        });

        modelBuilder.Entity<ColorOption>(e =>
        {
            e.HasIndex(x => x.Name).IsUnique();
            e.Property(x => x.Name).HasMaxLength(40);
            e.Property(x => x.Hex).HasMaxLength(20);
        });

        modelBuilder.Entity<VariantOption>(e =>
        {
            e.HasIndex(x => new { x.SizeOptionId, x.ColorOptionId }).IsUnique();
            e.HasOne(x => x.Size).WithMany().HasForeignKey(x => x.SizeOptionId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Color).WithMany().HasForeignKey(x => x.ColorOptionId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Customer>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.Address).HasMaxLength(400);
            e.Property(x => x.CreditLimit).HasPrecision(18, 2);
            e.Property(x => x.Balance).HasPrecision(18, 2);
        });

        modelBuilder.Entity<Supplier>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Phone).HasMaxLength(40);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.Address).HasMaxLength(400);
            e.Property(x => x.Note).HasMaxLength(400);
            e.Property(x => x.Balance).HasPrecision(18, 2);
        });

        modelBuilder.Entity<SupplierPayment>(e =>
        {
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.Property(x => x.Kind).HasMaxLength(20);
            e.HasOne(x => x.Supplier).WithMany().HasForeignKey(x => x.SupplierId);
        });

        modelBuilder.Entity<Sale>(e =>
        {
            e.HasIndex(x => x.ReceiptNo).IsUnique();
            e.Property(x => x.SubTotal).HasPrecision(18, 2);
            e.Property(x => x.VatTotal).HasPrecision(18, 2);
            e.Property(x => x.GrandTotal).HasPrecision(18, 2);
            e.Property(x => x.CostTotal).HasPrecision(18, 2);
            e.Property(x => x.CashAmount).HasPrecision(18, 2);
            e.Property(x => x.CardAmount).HasPrecision(18, 2);
            e.HasMany(x => x.Items).WithOne(x => x.Sale!).HasForeignKey(x => x.SaleId);
            e.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId);
        });

        modelBuilder.Entity<SaleItem>(e =>
        {
            e.Property(x => x.Quantity).HasPrecision(18, 3);
            e.Property(x => x.UnitPrice).HasPrecision(18, 2);
            e.Property(x => x.PurchasePrice).HasPrecision(18, 2);
            e.Property(x => x.VatRate).HasPrecision(5, 2);
            e.Property(x => x.LineTotal).HasPrecision(18, 2);
        });

        modelBuilder.Entity<StockBatch>(e =>
        {
            e.Property(x => x.InitialQuantity).HasPrecision(18, 3);
            e.Property(x => x.RemainingQuantity).HasPrecision(18, 3);
            e.Property(x => x.UnitCost).HasPrecision(18, 4);
            e.Property(x => x.Source).HasMaxLength(20);
            e.Property(x => x.Note).HasMaxLength(80);
            e.HasIndex(x => new { x.ProductId, x.PurchasedAt });
        });

        modelBuilder.Entity<SaleItemBatchUsage>(e =>
        {
            e.Property(x => x.Quantity).HasPrecision(18, 3);
            e.Property(x => x.UnitCost).HasPrecision(18, 4);
            e.HasIndex(x => x.SaleItemId);
        });

        modelBuilder.Entity<PurchaseInvoice>(e =>
        {
            e.Property(x => x.InvoiceNo).HasMaxLength(40);
            e.Property(x => x.SupplierName).HasMaxLength(200);
            e.Property(x => x.Total).HasPrecision(18, 2);
            e.Property(x => x.PaymentKind).HasMaxLength(20);
            e.HasMany(x => x.Lines).WithOne(x => x.Invoice!).HasForeignKey(x => x.InvoiceId);
        });

        modelBuilder.Entity<PurchaseInvoiceLine>(e =>
        {
            e.Property(x => x.ProductName).HasMaxLength(200);
            e.Property(x => x.Quantity).HasPrecision(18, 3);
            e.Property(x => x.UnitCost).HasPrecision(18, 4);
            e.Property(x => x.LineTotal).HasPrecision(18, 2);
        });

        modelBuilder.Entity<CustomerPayment>(e =>
        {
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.Property(x => x.Kind).HasMaxLength(20);
            e.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId);
        });

        modelBuilder.Entity<CashAccount>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(120);
            e.Property(x => x.Type).HasMaxLength(20);
            e.Property(x => x.Balance).HasPrecision(18, 2);
            e.Property(x => x.CommissionRate).HasPrecision(5, 2);
        });

        modelBuilder.Entity<ExpenseCategory>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(80);
            e.Property(x => x.Type).HasMaxLength(20);
            e.Property(x => x.Color).HasMaxLength(20);
        });

        modelBuilder.Entity<LedgerEntry>(e =>
        {
            e.Property(x => x.Type).HasMaxLength(20);
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.Property(x => x.Commission).HasPrecision(18, 2);
            e.Property(x => x.NetAmount).HasPrecision(18, 2);
            e.Property(x => x.Note).HasMaxLength(400);
        });

        modelBuilder.Entity<AppSetting>(e =>
        {
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.DefaultVatRate).HasPrecision(5, 2);
        });

        modelBuilder.Entity<FiscalDeviceSetting>(e =>
        {
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Provider).HasMaxLength(64);
            e.Property(x => x.DeviceHost).HasMaxLength(200);
            e.Property(x => x.SerialNo).HasMaxLength(100);
            e.Property(x => x.SoftwareId).HasMaxLength(100);
            e.Property(x => x.HardwareId).HasMaxLength(100);
            e.Property(x => x.AgentBaseUrl).HasMaxLength(300);
            e.Property(x => x.LastStatus).HasMaxLength(500);
        });

        modelBuilder.Entity<FiscalRegister>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(80);
            e.Property(x => x.Model).HasMaxLength(40);
            e.Property(x => x.ConnectionType).HasMaxLength(8);
            e.Property(x => x.DeviceHost).HasMaxLength(200);
            e.Property(x => x.ComPort).HasMaxLength(16);
            e.Property(x => x.SerialNo).HasMaxLength(100);
            e.Property(x => x.SoftwareId).HasMaxLength(100);
            e.Property(x => x.HardwareId).HasMaxLength(100);
            e.Property(x => x.AgentBaseUrl).HasMaxLength(300);
            e.Property(x => x.BridgeBaseUrl).HasMaxLength(300);
            e.Property(x => x.LastStatus).HasMaxLength(500);
        });
    }
}
