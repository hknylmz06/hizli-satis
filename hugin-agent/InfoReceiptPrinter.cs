using System.Drawing;
using System.Drawing.Printing;

namespace HizliSatis.HuginAgent;

public static class InfoReceiptPrinter
{
    public static IReadOnlyList<string> Installed()
    {
        if (!OperatingSystem.IsWindows()) return [];
        return PrinterSettings.InstalledPrinters.Cast<string>().ToList();
    }

    public static void Print(InfoReceiptRequest request)
    {
        if (!OperatingSystem.IsWindows())
            throw new InvalidOperationException("Sessiz fiş basımı yalnız kasa bilgisayarında çalışır.");

        var paper = (request.Paper ?? "80").Trim().ToLowerInvariant();
        var width = paper switch
        {
            "58" => 228,
            "a4" => 827,
            _ => 315
        };
        var lines = request.Lines?.Count ?? 0;
        var height = paper == "a4" ? 1169 : Math.Clamp(240 + lines * 36, 420, 2200);

        using var doc = new PrintDocument();
        var name = (request.PrinterName ?? "").Trim();
        if (name.Length > 0 && !name.Equals("Varsayılan", StringComparison.OrdinalIgnoreCase))
        {
            doc.PrinterSettings.PrinterName = name;
            if (!doc.PrinterSettings.IsValid)
                throw new InvalidOperationException($"Bu bilgisayarda \"{name}\" yazıcısı yok.");
        }

        doc.PrintController = new StandardPrintController();
        doc.DefaultPageSettings.Margins = new Margins(8, 8, 8, 8);
        doc.DefaultPageSettings.PaperSize = new PaperSize("BilgiFisi", width, height);
        doc.PrintPage += (_, e) => Draw(e, request, paper);
        doc.Print();
    }

    private static void Draw(PrintPageEventArgs e, InfoReceiptRequest request, string paper)
    {
        var g = e.Graphics ?? throw new InvalidOperationException("Yazıcı yüzeyi açılamadı.");
        var size = paper == "58" ? 8f : paper == "a4" ? 11f : 9f;
        using var font = new Font("Arial", size);
        using var bold = new Font("Arial", size + 1.5f, FontStyle.Bold);
        var left = e.MarginBounds.Width > 20 ? e.MarginBounds.Left : 6;
        var width = e.MarginBounds.Width > 20 ? e.MarginBounds.Width : Math.Max(40, e.PageBounds.Width - 12);
        float y = e.MarginBounds.Width > 20 ? e.MarginBounds.Top : 6;

        void Line(string text, Font face, StringAlignment align = StringAlignment.Near)
        {
            var height = face.GetHeight(g) + 1;
            var rect = new RectangleF(left, y, width, height + 2);
            using var format = new StringFormat { Alignment = align, Trimming = StringTrimming.EllipsisCharacter };
            g.DrawString(text, face, Brushes.Black, rect, format);
            y += height;
        }

        Line("Bilgi Fişi", bold, StringAlignment.Center);
        if (!string.IsNullOrWhiteSpace(request.When)) Line(request.When, font, StringAlignment.Center);
        if (!string.IsNullOrWhiteSpace(request.ReceiptNo)) Line(request.ReceiptNo, font, StringAlignment.Center);
        Line("------------------------------", font);
        foreach (var line in request.Lines ?? [])
        {
            Line(line.Name ?? "", font);
            Line($"{line.Qty}   {line.Total} TL", font, StringAlignment.Far);
        }
        Line("------------------------------", font);
        Line($"TOPLAM   {request.GrandTotal:0.00} TL", bold, StringAlignment.Far);
        if (!string.IsNullOrWhiteSpace(request.Payment)) Line(request.Payment, font);
        if (string.Equals(request.Payment, "Parçalı", StringComparison.OrdinalIgnoreCase))
            Line($"Nakit {request.CashAmount:0.00}   Kart {request.CardAmount:0.00}", font);
        Line("Mali değeri yoktur", font, StringAlignment.Center);
        e.HasMorePages = false;
    }
}

public sealed class InfoReceiptRequest
{
    public string? PrinterName { get; set; }
    public string? Paper { get; set; }
    public string? ReceiptNo { get; set; }
    public string? When { get; set; }
    public string? Payment { get; set; }
    public decimal GrandTotal { get; set; }
    public decimal CashAmount { get; set; }
    public decimal CardAmount { get; set; }
    public List<InfoReceiptLine>? Lines { get; set; }
}

public sealed class InfoReceiptLine
{
    public string? Name { get; set; }
    public string? Qty { get; set; }
    public string? Total { get; set; }
}
