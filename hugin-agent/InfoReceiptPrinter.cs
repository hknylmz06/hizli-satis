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
        // 80 mm yazıcıda taşmayı kesmek için baskı genişliği 78 mm.
        var width = paper switch
        {
            "58" => 220,
            "a4" => 827,
            _ => 307
        };
        var lines = request.Lines?.Count ?? 0;
        var height = paper == "a4" ? 1169 : Math.Clamp(220 + lines * 32, 400, 2200);

        using var doc = new PrintDocument();
        var name = (request.PrinterName ?? "").Trim();
        if (name.Length > 0 && !name.Equals("Varsayılan", StringComparison.OrdinalIgnoreCase))
        {
            doc.PrinterSettings.PrinterName = name;
            if (!doc.PrinterSettings.IsValid)
                throw new InvalidOperationException($"Bu bilgisayarda \"{name}\" yazıcısı yok.");
        }

        doc.PrintController = new StandardPrintController();
        doc.DefaultPageSettings.Margins = new Margins(paper == "a4" ? 40 : 6, paper == "a4" ? 40 : 6, 6, 6);
        doc.DefaultPageSettings.PaperSize = new PaperSize("BilgiFisi", width, height);
        doc.PrintPage += (_, e) => Draw(e, request, paper);
        doc.Print();
    }

    private static void Draw(PrintPageEventArgs e, InfoReceiptRequest request, string paper)
    {
        var g = e.Graphics ?? throw new InvalidOperationException("Yazıcı yüzeyi açılamadı.");
        g.PageUnit = GraphicsUnit.Millimeter;
        var pageWidth = paper switch
        {
            "58" => 54f,
            "a4" => 190f,
            _ => 78f
        };
        var left = paper == "a4" ? 8f : 1.2f;
        var width = pageWidth - (left * 2f);
        float y = 1.5f;
        var size = paper == "58" ? 7.5f : paper == "a4" ? 11f : 8.5f;
        using var font = new Font("Arial", size, FontStyle.Regular, GraphicsUnit.Point);
        using var bold = new Font("Arial", size + 1f, FontStyle.Bold, GraphicsUnit.Point);

        void Line(string text, Font face, StringAlignment align = StringAlignment.Near)
        {
            var height = face.GetHeight(g) + 0.3f;
            var rect = new RectangleF(left, y, width, height + 0.4f);
            using var format = new StringFormat { Alignment = align, Trimming = StringTrimming.EllipsisCharacter, FormatFlags = StringFormatFlags.NoWrap };
            g.DrawString(text, face, Brushes.Black, rect, format);
            y += height;
        }

        void Row(string leftText, string rightText, Font face)
        {
            var height = face.GetHeight(g) + 0.3f;
            var rightSize = g.MeasureString(rightText, face);
            var rightW = Math.Min(width * 0.46f, rightSize.Width + 0.6f);
            var leftRect = new RectangleF(left, y, Math.Max(8f, width - rightW), height + 0.4f);
            var rightRect = new RectangleF(left + width - rightW, y, rightW, height + 0.4f);
            using var leftFmt = new StringFormat { Alignment = StringAlignment.Near, Trimming = StringTrimming.EllipsisCharacter, FormatFlags = StringFormatFlags.NoWrap };
            using var rightFmt = new StringFormat { Alignment = StringAlignment.Far, FormatFlags = StringFormatFlags.NoWrap };
            g.DrawString(leftText, face, Brushes.Black, leftRect, leftFmt);
            g.DrawString(rightText, face, Brushes.Black, rightRect, rightFmt);
            y += height;
        }

        void Rule()
        {
            y += 0.4f;
            g.DrawLine(Pens.Black, left, y, left + width, y);
            y += 1.1f;
        }

        Line("Bilgi Fişi", bold, StringAlignment.Center);
        if (!string.IsNullOrWhiteSpace(request.When)) Line(request.When, font, StringAlignment.Center);
        if (!string.IsNullOrWhiteSpace(request.ReceiptNo)) Line(request.ReceiptNo, font, StringAlignment.Center);
        Rule();
        foreach (var line in request.Lines ?? [])
            Row($"{line.Qty} {line.Name}".Trim(), $"{line.Total} TL", font);
        Rule();
        Row("TOPLAM", $"{request.GrandTotal:0.00} TL", bold);
        if (!string.IsNullOrWhiteSpace(request.Payment)) Line(request.Payment, font);
        if (string.Equals(request.Payment, "Parçalı", StringComparison.OrdinalIgnoreCase))
            Row("Nakit / Kart", $"{request.CashAmount:0.00} / {request.CardAmount:0.00}", font);
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
