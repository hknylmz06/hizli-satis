using HizliSatis.Api.Contracts;
using HizliSatis.Domain.Tenant;
using HizliSatis.Infrastructure.Persistence;
using HizliSatis.Infrastructure.Services;
using HizliSatis.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Api.Controllers;

[ApiController]
[Authorize(Roles = "TenantUser")]
[Route("api/users")]
public class UsersController(TenantDbContextFactory tenantDbFactory) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        await using var db = await Open(ct);
        var actor = await Current(db, ct);
        if (!TenantAccess.Allows(actor, "can_manage_users"))
            return StatusCode(403, new { message = "Kullanıcı tanımlama yetkin yok." });

        var users = await db.Users.AsNoTracking().OrderBy(u => u.CreatedAt).ToListAsync(ct);
        return Ok(users.Select(Map));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request, CancellationToken ct)
    {
        await using var db = await Open(ct);
        var actor = await Current(db, ct);
        if (!TenantAccess.Allows(actor, "can_manage_users"))
            return StatusCode(403, new { message = "Kullanıcı tanımlama yetkin yok." });

        var username = request.Username?.Trim() ?? "";
        var displayName = request.DisplayName?.Trim() ?? "";
        var role = TenantAccess.NormalizeRole(request.Role);
        if (username.Length < 2)
            return BadRequest(new { message = "Kullanıcı adı en az 2 karakter olmalı." });
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 4)
            return BadRequest(new { message = "Şifre en az 4 karakter olmalı." });
        if (displayName.Length == 0)
            return BadRequest(new { message = "Ad soyad zorunlu." });
        if (role is null)
            return BadRequest(new { message = "Rol Yönetici veya Kasiyer olmalı." });

        if (await db.Users.AnyAsync(u => u.Username == username, ct))
            return BadRequest(new { message = "Bu kullanıcı adı zaten var." });

        var user = new TenantUser
        {
            Username = username,
            DisplayName = displayName,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = role,
            Permissions = TenantAccess.Serialize(role, request.Permissions),
            IsActive = true
        };
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        return Ok(Map(user));
    }

    [HttpPut("{id:guid}/permissions")]
    public async Task<IActionResult> UpdatePermissions(Guid id, [FromBody] UpdateUserPermissionsRequest request, CancellationToken ct)
    {
        await using var db = await Open(ct);
        var actor = await Current(db, ct);
        if (!TenantAccess.Allows(actor, "can_manage_users"))
            return StatusCode(403, new { message = "Kullanıcı tanımlama yetkin yok." });

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound(new { message = "Kullanıcı bulunamadı." });

        var role = TenantAccess.NormalizeRole(request.Role) ?? user.Role;
        if (TenantAccess.IsAdmin(user.Role) && !TenantAccess.IsAdmin(role))
        {
            var otherAdmins = await db.Users.CountAsync(u => u.Id != user.Id && u.IsActive && u.Role == "Admin", ct);
            if (otherAdmins == 0)
                return BadRequest(new { message = "Son yönetici kasiyer yapılamaz." });
        }

        user.Role = role;
        user.Permissions = TenantAccess.Serialize(role, request.Permissions);
        await db.SaveChangesAsync(ct);
        return Ok(Map(user));
    }

    [HttpPost("{id:guid}/toggle")]
    public async Task<IActionResult> Toggle(Guid id, CancellationToken ct)
    {
        await using var db = await Open(ct);
        var actor = await Current(db, ct);
        if (!TenantAccess.Allows(actor, "can_manage_users"))
            return StatusCode(403, new { message = "Kullanıcı tanımlama yetkin yok." });

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound(new { message = "Kullanıcı bulunamadı." });
        if (actor?.Id == user.Id)
            return BadRequest(new { message = "Kendi hesabını kapatamazsın." });
        if (user.IsActive && TenantAccess.IsAdmin(user.Role))
        {
            var otherAdmins = await db.Users.CountAsync(u => u.Id != user.Id && u.IsActive && u.Role == "Admin", ct);
            if (otherAdmins == 0)
                return BadRequest(new { message = "Son yönetici kapatılamaz." });
        }

        user.IsActive = !user.IsActive;
        await db.SaveChangesAsync(ct);
        return Ok(Map(user));
    }

    [HttpPost("{id:guid}/reset-password")]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetPasswordRequest request, CancellationToken ct)
    {
        await using var db = await Open(ct);
        var actor = await Current(db, ct);
        if (!TenantAccess.Allows(actor, "can_manage_users"))
            return StatusCode(403, new { message = "Kullanıcı tanımlama yetkin yok." });

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 4)
            return BadRequest(new { message = "Şifre en az 4 karakter olmalı." });

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound(new { message = "Kullanıcı bulunamadı." });
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await db.SaveChangesAsync(ct);
        return Ok(new { message = "Şifre güncellendi." });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await using var db = await Open(ct);
        var actor = await Current(db, ct);
        if (!TenantAccess.Allows(actor, "can_manage_users"))
            return StatusCode(403, new { message = "Kullanıcı tanımlama yetkin yok." });

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound(new { message = "Kullanıcı bulunamadı." });
        if (actor?.Id == user.Id)
            return BadRequest(new { message = "Kendi hesabını silemezsin." });
        if (TenantAccess.IsAdmin(user.Role))
        {
            var otherAdmins = await db.Users.CountAsync(u => u.Id != user.Id && u.Role == "Admin", ct);
            if (otherAdmins == 0)
                return BadRequest(new { message = "Son yönetici silinemez." });
        }

        db.Users.Remove(user);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<TenantDbContext> Open(CancellationToken ct)
    {
        var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        return db;
    }

    private async Task<TenantUser?> Current(TenantDbContext db, CancellationToken ct)
    {
        var name = User.Identity?.Name;
        if (string.IsNullOrWhiteSpace(name)) return null;
        return await db.Users.FirstOrDefaultAsync(u => u.Username == name, ct);
    }

    private static object Map(TenantUser user) => new
    {
        user.Id,
        user.Username,
        user.DisplayName,
        user.Role,
        user.IsActive,
        user.CreatedAt,
        permissions = TenantAccess.Resolve(user.Role, user.Permissions)
    };
}
