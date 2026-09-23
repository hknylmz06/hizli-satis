using HizliSatis.Infrastructure.Options;
using HizliSatis.Infrastructure.Persistence;
using HizliSatis.Infrastructure.Services;
using HizliSatis.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HizliSatis.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<DatabaseOptions>(configuration.GetSection("Database"));
        services.Configure<JwtOptions>(configuration.GetSection("Jwt"));

        var masterConnection =
            configuration.GetConnectionString("Master")
            ?? configuration.GetSection("Database").GetValue<string>("MasterConnection")
            ?? string.Empty;

        masterConnection = PostgresConnectionHelper.RequireMasterConnection(masterConnection);

        services.AddDbContext<MasterDbContext>(opt => opt.UseNpgsql(masterConnection));
        services.AddScoped<ITenantContext, TenantContext>();
        services.AddScoped<TenantDbContextFactory>();
        services.AddScoped<TenantProvisioningService>();
        services.AddScoped<JwtTokenService>();
        services.AddScoped<MasterSeedService>();

        return services;
    }
}
