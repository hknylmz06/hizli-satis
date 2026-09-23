using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using HizliSatis.Api.Contracts;
using HizliSatis.Domain.Enums;
using HizliSatis.Infrastructure.Persistence;
using HizliSatis.Infrastructure.Services;
using HizliSatis.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    MasterDbContext masterDb,
    JwtTokenService jwt) : ControllerBase
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

        await using var tenantDb = TenantDbContextFactory.CreateForConnection(tenant.ConnectionString);
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

        return Ok(new AuthResponse(
            jwt.CreateToken(claims),
            "TenantUser",
            user.DisplayName,
            tenant.FirmaKodu,
            tenant.Name));
    }
}
