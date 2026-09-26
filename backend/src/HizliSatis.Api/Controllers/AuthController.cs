using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using HizliSatis.Api.Contracts;
using HizliSatis.Domain.Enums;
using HizliSatis.Infrastructure.Persistence;
using HizliSatis.Infrastructure.Services;
using HizliSatis.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    MasterDbContext masterDb,
    JwtTokenService jwt,
    TenantDbContextFactory tenants) : ControllerBase
{
    [HttpPost("platform-login")]
    public async Task<ActionResult<AuthResponse>> PlatformLogin([FromBody] PlatformLoginRequest request, CancellationToken ct)
    {
        var admin = await masterDb.PlatformAdmins
            .FirstOrDefaultAsync(a => a.Username == request.Username, ct);

        if (admin is null || !BCrypt.Net.BCrypt.Verify(request.Password, admin.PasswordHash))
            return Unauthorized(new { message = "Geçersiz kullanıcı adı veya şifre." });

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, admin.Id.ToString()),
            new Claim(ClaimTypes.Name, admin.Username),
            new Claim(ClaimTypes.Role, "PlatformAdmin"),
            new Claim("display_name", admin.DisplayName)
        };

        return Ok(new AuthResponse(jwt.CreateToken(claims), "PlatformAdmin", admin.DisplayName, null, null));
    }

    [HttpPost("tenant-login")]
    public async Task<ActionResult<AuthResponse>> TenantLogin([FromBody] TenantLoginRequest request, CancellationToken ct)
    {
        var firmaKodu = request.FirmaKodu.Trim().ToUpperInvariant();
        var tenant = await masterDb.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(t => t.FirmaKodu == firmaKodu, ct);

        if (tenant is null)
            return Unauthorized(new { message = "Firma kodu bulunamadı." });

        if (tenant.Status != TenantStatus.Ready)
            return Unauthorized(new { message = $"Firma henüz hazır değil. Durum: {tenant.Status}" });

        if (!tenant.IsLicenseActive())
            return Unauthorized(new { message = "Lisans süresi doldu. Devam etmek için yıllık ücreti ödemeniz gerekiyor." });

        await using var tenantDb = TenantDbContextFactory.CreateForConnection(tenant.ConnectionString);
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(tenantDb, ct);
        var user = await tenantDb.Users.FirstOrDefaultAsync(u => u.Username == request.Username && u.IsActive, ct);

        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Geçersiz kullanıcı adı veya şifre." });

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, "TenantUser"),
            new Claim("tenant_role", user.Role),
            new Claim("tenant_id", tenant.Id.ToString()),
            new Claim("firma_kodu", tenant.FirmaKodu),
            new Claim("display_name", user.DisplayName)
        };

        var permissions = TenantAccess.Resolve(user.Role, user.Permissions);
        return Ok(new AuthResponse(
            jwt.CreateToken(claims),
            "TenantUser",
            user.DisplayName,
            tenant.FirmaKodu,
            tenant.Name,
            user.Role,
            permissions));
    }

    [HttpGet("me")]
    [Authorize(Roles = "TenantUser")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        await using var db = tenants.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var name = User.Identity?.Name;
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Username == name && u.IsActive, ct);
        if (user is null) return Unauthorized(new { message = "Oturum kullanıcısı bulunamadı." });
        return Ok(new
        {
            user.Username,
            user.DisplayName,
            tenantRole = user.Role,
            permissions = TenantAccess.Resolve(user.Role, user.Permissions)
        });
    }
}
