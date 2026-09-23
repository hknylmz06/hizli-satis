using HizliSatis.Domain.Tenant;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Infrastructure.Persistence;

public class TenantDbContext(DbContextOptions<TenantDbContext> options) : DbContext(options)
{
    public DbSet<TenantUser> Users => Set<TenantUser>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<CustomerPayment> CustomerPayments => Set<CustomerPayment>();
    public DbSet<AppSetting> Settings => Set<AppSetting>();
    public DbSet<FiscalDeviceSetting> FiscalDevices => Set<FiscalDeviceSetting>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TenantUser>(e =>
        {
            e.HasIndex(x => x.Username).IsUnique();
            e.Property(x => x.Username).HasMaxLength(100);
        });

        modelBuilder.Entity<Product>(e =>
        {
            e.HasIndex(x => x.Barcode);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Barcode).HasMaxLength(64);
            e.Property(x => x.PurchasePrice).HasPrecision(18, 2);
            e.Property(x => x.SalePrice).HasPrecision(18, 2);
            e.Property(x => x.VatRate).HasPrecision(5, 2);
            e.Property(x => x.StockQuantity).HasPrecision(18, 3);
            e.Property(x => x.CriticalStockLevel).HasPrecision(18, 3);
        });

        modelBuilder.Entity<Customer>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Balance).HasPrecision(18, 2);
        });

        modelBuilder.Entity<Sale>(e =>
        {
            e.HasIndex(x => x.ReceiptNo).IsUnique();
            e.Property(x => x.SubTotal).HasPrecision(18, 2);
            e.Property(x => x.VatTotal).HasPrecision(18, 2);
            e.Property(x => x.GrandTotal).HasPrecision(18, 2);
            e.Property(x => x.CostTotal).HasPrecision(18, 2);
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

        modelBuilder.Entity<CustomerPayment>(e =>
        {
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId);
        });

        modelBuilder.Entity<AppSetting>(e =>
        {
            e.Property(x => x.DefaultVatRate).HasPrecision(5, 2);
        });

        modelBuilder.Entity<FiscalDeviceSetting>(e =>
        {
            e.Property(x => x.Provider).HasMaxLength(64);
            e.Property(x => x.DeviceHost).HasMaxLength(200);
            e.Property(x => x.SerialNo).HasMaxLength(100);
            e.Property(x => x.SoftwareId).HasMaxLength(100);
            e.Property(x => x.HardwareId).HasMaxLength(100);
            e.Property(x => x.AgentBaseUrl).HasMaxLength(300);
            e.Property(x => x.LastStatus).HasMaxLength(500);
        });
    }
}
