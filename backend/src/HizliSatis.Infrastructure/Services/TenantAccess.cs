using System.Text.Json;
using HizliSatis.Domain.Tenant;

namespace HizliSatis.Infrastructure.Services;

public static class TenantAccess
{
    public static readonly string[] Keys =
    [
        "can_access_pos",
        "can_access_invoices",
        "can_access_reports",
        "can_access_definitions",
        "can_access_settings",
        "can_manage_users",
        "can_discount",
        "can_clear_cart",
        "can_credit_sale",
        "can_view_cost",
        "can_edit_products",
        "can_delete_records"
    ];

    public static bool IsAdmin(string? role) =>
        string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Yönetici", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Yonetici", StringComparison.OrdinalIgnoreCase);

    public static Dictionary<string, bool> Resolve(string? role, string? json)
    {
        if (IsAdmin(role))
            return Keys.ToDictionary(key => key, _ => true);

        var parsed = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(json))
        {
            try
            {
                var raw = JsonSerializer.Deserialize<Dictionary<string, bool>>(json);
                if (raw is not null)
                {
                    foreach (var pair in raw)
                        parsed[pair.Key] = pair.Value;
                }
            }
            catch (JsonException)
            {
                parsed.Clear();
            }
        }

        bool Value(string key, bool fallback) =>
            parsed.TryGetValue(key, out var value) ? value : fallback;

        return new Dictionary<string, bool>
        {
            ["can_access_pos"] = Value("can_access_pos", true),
            ["can_access_invoices"] = Value("can_access_invoices", false),
            ["can_access_reports"] = Value("can_access_reports", false),
            ["can_access_definitions"] = Value("can_access_definitions", false),
            ["can_access_settings"] = Value("can_access_settings", false),
            ["can_manage_users"] = Value("can_manage_users", false),
            ["can_discount"] = Value("can_discount", false),
            ["can_clear_cart"] = Value("can_clear_cart", true),
            ["can_credit_sale"] = Value("can_credit_sale", false),
            ["can_view_cost"] = Value("can_view_cost", false),
            ["can_edit_products"] = Value("can_edit_products", false),
            ["can_delete_records"] = Value("can_delete_records", false)
        };
    }

    public static bool Allows(TenantUser? user, string key)
    {
        if (user is null || !user.IsActive) return false;
        var map = Resolve(user.Role, user.Permissions);
        return map.TryGetValue(key, out var allowed) && allowed;
    }

    public static string? NormalizeRole(string? role) =>
        IsAdmin(role) ? "Admin" : string.Equals(role, "Kasiyer", StringComparison.OrdinalIgnoreCase) || string.Equals(role, "cashier", StringComparison.OrdinalIgnoreCase)
            ? "Kasiyer"
            : null;

    public static string Serialize(string role, Dictionary<string, bool>? permissions) =>
        JsonSerializer.Serialize(Resolve(role, permissions is null ? null : JsonSerializer.Serialize(permissions)));
}
