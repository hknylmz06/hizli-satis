using HizliSatis.Infrastructure.Options;
using HizliSatis.Infrastructure.Persistence;
using HizliSatis.Infrastructure.Services;
using HizliSatis.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace HizliSatis.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string contentRoot)
    {
        services.Configure<DatabaseOptions>(configuration.GetSection("Database"));
        services.Configure<JwtOptions>(configuration.GetSection("Jwt"));

        services.AddSingleton(sp => new SqlServerSettingsStore(
            contentRoot,
            sp.GetRequiredService<ILogger<SqlServerSettingsStore>>()));

        services.AddScoped<MasterDbContext>(sp => sp.GetRequiredService<SqlServerSettingsStore>().CreateMasterContext());
        services.AddScoped<ITenantContext, TenantContext>();
        services.AddScoped<TenantDbContextFactory>();
        services.AddScoped<TenantProvisioningService>();
        services.AddScoped<JwtTokenService>();
        services.AddScoped<MasterSeedService>();

        return services;
    }
}
