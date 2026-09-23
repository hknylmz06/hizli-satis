using HizliSatis.Domain.Master;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Infrastructure.Persistence;

public class MasterDbContext(DbContextOptions<MasterDbContext> options) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<PlatformAdmin> PlatformAdmins => Set<PlatformAdmin>();
    public DbSet<NotificationLog> NotificationLogs => Set<NotificationLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Tenant>(e =>
        {
            e.HasIndex(x => x.FirmaKodu).IsUnique();
            e.HasIndex(x => x.DatabaseName).IsUnique();
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.FirmaKodu).HasMaxLength(32);
            e.Property(x => x.ContactEmail).HasMaxLength(200);
        });

        modelBuilder.Entity<PlatformAdmin>(e =>
        {
            e.HasIndex(x => x.Username).IsUnique();
            e.Property(x => x.Username).HasMaxLength(100);
        });

        modelBuilder.Entity<NotificationLog>(e =>
        {
            e.Property(x => x.Channel).HasMaxLength(32);
            e.Property(x => x.Recipient).HasMaxLength(200);
            e.Property(x => x.Subject).HasMaxLength(300);
        });
    }
}
