using System.Security.Cryptography;
using System.Text;

namespace HizliSatis.Infrastructure.Services;

public static class CodeGenerator
{
    private static readonly char[] Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".ToCharArray();

    public static string FirmaKodu(int length = 6)
    {
        Span<char> buffer = stackalloc char[length];
        var bytes = RandomNumberGenerator.GetBytes(length);
        for (var i = 0; i < length; i++)
            buffer[i] = Alphabet[bytes[i] % Alphabet.Length];
        return new string(buffer);
    }

    public static string Username(string firmaName)
    {
        var slug = new string(firmaName
            .ToLowerInvariant()
            .Where(c => char.IsLetterOrDigit(c))
            .Take(8)
            .ToArray());

        if (string.IsNullOrWhiteSpace(slug))
            slug = "firma";

        return $"{slug}admin";
    }

    public static string TemporaryPassword(int length = 10)
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
        var bytes = RandomNumberGenerator.GetBytes(length);
        var sb = new StringBuilder(length);
        for (var i = 0; i < length; i++)
            sb.Append(chars[bytes[i] % chars.Length]);
        return sb.ToString();
    }

    public static string DatabaseSlug(string firmaKodu) => $"firma_{firmaKodu.ToLowerInvariant()}_db";
}
