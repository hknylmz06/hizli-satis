using System.Text;
using HizliSatis.Api.Middleware;
using HizliSatis.Infrastructure;
using HizliSatis.Infrastructure.Options;
using HizliSatis.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddInfrastructure(builder.Configuration, builder.Environment.ContentRootPath);
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
});
builder.Services.AddHostedService<HizliSatis.Api.SqlWarmupService>();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Hızlı Satış API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT: Bearer {token}",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var jwt = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            RoleClaimType = System.Security.Claims.ClaimTypes.Role
        };
    });

builder.Services.AddAuthorization();
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
    ?? ["http://localhost:5173", "http://127.0.0.1:5173"];

var corsFromEnv = builder.Configuration["Cors__Origins"]
    ?? builder.Configuration["CORS_ORIGINS"];
if (!string.IsNullOrWhiteSpace(corsFromEnv))
{
    corsOrigins = corsFromEnv
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
        policy.SetIsOriginAllowed(origin =>
            {
                if (string.IsNullOrWhiteSpace(origin)) return false;
                if (corsOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase)) return true;
                if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
                var host = uri.Host;
                if (host.EndsWith(".vercel.app", StringComparison.OrdinalIgnoreCase)) return true;
                if (host.EndsWith(".onrender.com", StringComparison.OrdinalIgnoreCase)) return true;
                if (host.Equals("inposm530.com", StringComparison.OrdinalIgnoreCase)) return true;
                if (host.Equals("www.inposm530.com", StringComparison.OrdinalIgnoreCase)) return true;
                if (host.Equals("barkod.huginyazarkasa.com", StringComparison.OrdinalIgnoreCase)) return true;
                if (host.Equals("huginyazarkasa.com", StringComparison.OrdinalIgnoreCase)) return true;
                if (host.Equals("www.huginyazarkasa.com", StringComparison.OrdinalIgnoreCase)) return true;
                return false;
            })
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
    try
    {
        var store = scope.ServiceProvider.GetRequiredService<SqlServerSettingsStore>();
        await store.EnsureMasterDatabaseAsync();
        var seeder = scope.ServiceProvider.GetRequiredService<MasterSeedService>();
        await seeder.InitializeAsync();
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "SQL Server bağlantısı kurulamadı. Yayın yerinde SqlServer__Server, SqlServer__User ve SqlServer__Password dolu olmalı.");
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseForwardedHeaders();
app.UseResponseCompression();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.UseCors("frontend");
app.UseAuthentication();
app.UseMiddleware<TenantResolutionMiddleware>();
app.UseAuthorization();
app.MapControllers();

var wwwroot = Path.Combine(app.Environment.ContentRootPath, "wwwroot");
if (Directory.Exists(wwwroot))
{
    var provider = new PhysicalFileProvider(wwwroot);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = provider });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = provider });
    app.MapFallbackToFile("index.html", new StaticFileOptions { FileProvider = provider });
}
else if (app.Environment.IsDevelopment())
{
    app.MapFallback(context =>
    {
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return Task.CompletedTask;
        }

        var target = "http://localhost:5173" + context.Request.PathBase + context.Request.Path + context.Request.QueryString;
        context.Response.Redirect(target);
        return Task.CompletedTask;
    });
}

app.Run();
