using HizliSatis.Domain.Tenant;
using HizliSatis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Infrastructure.Services;

public static class FifoStock
{
    public static void AddOpening(TenantDbContext db, Product product)
    {
        if (product.Variants.Count > 0)
        {
            foreach (var variant in product.Variants.Where(v => v.StockQuantity > 0))
                db.StockBatches.Add(Batch(product.Id, variant.Id, variant.StockQuantity, product.PurchasePrice, "Acilis", product.CreatedAt, null));
            return;
        }

        if (product.StockQuantity > 0)
            db.StockBatches.Add(Batch(product.Id, null, product.StockQuantity, product.PurchasePrice, "Acilis", product.CreatedAt, null));
    }

    public static async Task AdjustOnHandAsync(
        TenantDbContext db,
        int productId,
        int? variantId,
        decimal previous,
        decimal current,
        decimal unitCost,
        CancellationToken ct)
    {
        if (productId <= 0 || current == previous) return;

        var hasBatch = await db.StockBatches.AnyAsync(
            b => b.ProductId == productId && b.VariantId == variantId && b.RemainingQuantity > 0, ct);
        if (!hasBatch)
        {
            if (current > 0)
                db.StockBatches.Add(Batch(productId, variantId, current, unitCost, "Acilis", DateTime.UtcNow, "Stok duzeltme"));
            return;
        }

        var delta = current - previous;
        if (delta > 0)
        {
            db.StockBatches.Add(Batch(productId, variantId, delta, unitCost, "Acilis", DateTime.UtcNow, "Stok duzeltme"));
            return;
        }

        var left = -delta;
        var batches = await db.StockBatches
            .Where(b => b.ProductId == productId && b.VariantId == variantId && b.RemainingQuantity > 0)
            .OrderByDescending(b => b.PurchasedAt).ThenByDescending(b => b.Id)
            .ToListAsync(ct);
        foreach (var batch in batches)
        {
            if (left <= 0) break;
            var take = Math.Min(batch.RemainingQuantity, left);
            batch.RemainingQuantity -= take;
            left -= take;
        }
    }

    public static async Task<decimal> ConsumeAsync(
        TenantDbContext db,
        SaleItem item,
        int productId,
        decimal purchasePrice,
        DateTime createdAt,
        int? variantId,
        decimal onHand,
        CancellationToken ct,
        List<StockBatch>? pool = null)
    {
        List<StockBatch> batches;
        if (pool is null)
        {
            batches = await db.StockBatches
                .Where(b => b.ProductId == productId && b.VariantId == variantId && b.RemainingQuantity > 0)
                .OrderBy(b => b.PurchasedAt).ThenBy(b => b.Id)
                .ToListAsync(ct);
        }
        else
        {
            batches = pool
                .Where(b => b.ProductId == productId && b.VariantId == variantId && b.RemainingQuantity > 0)
                .OrderBy(b => b.PurchasedAt).ThenBy(b => b.Id)
                .ToList();
        }

        if (batches.Count == 0 && onHand > 0)
        {
            var opening = Batch(productId, variantId, onHand, purchasePrice, "Acilis", createdAt, null);
            db.StockBatches.Add(opening);
            batches.Add(opening);
            pool?.Add(opening);
        }

        decimal left = item.Quantity;
        decimal cost = 0;
        foreach (var batch in batches)
        {
            if (left <= 0) break;
            var take = Math.Min(batch.RemainingQuantity, left);
            if (take <= 0) continue;
            batch.RemainingQuantity -= take;
            cost += take * batch.UnitCost;
            db.SaleItemBatchUsages.Add(new SaleItemBatchUsage
            {
                SaleItemId = item.Id,
                StockBatchId = batch.Id,
                Quantity = take,
                UnitCost = batch.UnitCost
            });
            left -= take;
        }

        if (left > 0)
        {
            var fallback = batches.LastOrDefault()?.UnitCost ?? purchasePrice;
            cost += left * fallback;
            db.SaleItemBatchUsages.Add(new SaleItemBatchUsage
            {
                SaleItemId = item.Id,
                StockBatchId = null,
                Quantity = left,
                UnitCost = fallback
            });
        }

        item.PurchasePrice = item.Quantity == 0 ? 0 : Math.Round(cost / item.Quantity, 2);
        return Math.Round(cost, 2);
    }

    public static async Task RestoreAsync(TenantDbContext db, IEnumerable<int> saleItemIds, CancellationToken ct)
    {
        var ids = saleItemIds.ToList();
        if (ids.Count == 0) return;
        var usages = await db.SaleItemBatchUsages.Where(u => ids.Contains(u.SaleItemId)).ToListAsync(ct);
        var batchIds = usages.Where(u => u.StockBatchId != null).Select(u => u.StockBatchId!.Value).Distinct().ToList();
        var batches = await db.StockBatches.Where(b => batchIds.Contains(b.Id)).ToListAsync(ct);
        foreach (var usage in usages)
        {
            if (usage.StockBatchId is int batchId)
            {
                var batch = batches.FirstOrDefault(b => b.Id == batchId);
                if (batch is not null)
                    batch.RemainingQuantity += usage.Quantity;
            }
        }
        db.SaleItemBatchUsages.RemoveRange(usages);
    }

    public static async Task ReceiveAsync(
        TenantDbContext db,
        StockBatch batch,
        int productId,
        int? variantId,
        CancellationToken ct)
    {
        var uncovered = await (
            from usage in db.SaleItemBatchUsages
            join item in db.SaleItems on usage.SaleItemId equals item.Id
            join sale in db.Sales on item.SaleId equals sale.Id
            where usage.StockBatchId == null
                  && item.ProductId == productId
                  && item.VariantId == variantId
            orderby sale.SoldAt, usage.Id
            select usage).ToListAsync(ct);

        decimal left = batch.InitialQuantity;
        var touchedItems = new HashSet<int>();
        foreach (var usage in uncovered)
        {
            if (left <= 0) break;
            var take = Math.Min(usage.Quantity, left);
            if (take <= 0) continue;
            if (take < usage.Quantity)
            {
                usage.Quantity -= take;
                db.SaleItemBatchUsages.Add(new SaleItemBatchUsage
                {
                    SaleItemId = usage.SaleItemId,
                    StockBatchId = batch.Id,
                    Quantity = take,
                    UnitCost = batch.UnitCost
                });
            }
            else
            {
                usage.StockBatchId = batch.Id;
                usage.UnitCost = batch.UnitCost;
            }
            touchedItems.Add(usage.SaleItemId);
            left -= take;
        }

        batch.RemainingQuantity = left;
        if (touchedItems.Count > 0)
            await RecostAsync(db, touchedItems, ct);
    }

    private static async Task RecostAsync(TenantDbContext db, HashSet<int> saleItemIds, CancellationToken ct)
    {
        var items = await db.SaleItems.Where(i => saleItemIds.Contains(i.Id)).ToListAsync(ct);
        var usages = await db.SaleItemBatchUsages.Where(u => saleItemIds.Contains(u.SaleItemId)).ToListAsync(ct);
        var saleIds = items.Select(i => i.SaleId).Distinct().ToList();
        foreach (var item in items)
        {
            var rows = usages.Where(u => u.SaleItemId == item.Id).ToList();
            var cost = rows.Sum(u => u.Quantity * u.UnitCost);
            item.PurchasePrice = item.Quantity == 0 ? 0 : Math.Round(cost / item.Quantity, 2);
        }

        var sales = await db.Sales.Include(s => s.Items).Where(s => saleIds.Contains(s.Id)).ToListAsync(ct);
        foreach (var sale in sales)
            sale.CostTotal = Math.Round(sale.Items.Sum(i => i.PurchasePrice * i.Quantity), 2);
    }

    private static StockBatch Batch(int productId, int? variantId, decimal quantity, decimal unitCost, string source, DateTime purchasedAt, string? note) =>
        new()
        {
            ProductId = productId,
            VariantId = variantId,
            PurchasedAt = purchasedAt,
            InitialQuantity = quantity,
            RemainingQuantity = quantity,
            UnitCost = unitCost,
            Source = source,
            Note = note
        };
}
