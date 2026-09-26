namespace HizliSatis.Api.Contracts;

public record PlatformLoginRequest(string Username, string Password);

public record TenantLoginRequest(string FirmaKodu, string Username, string Password);

public record AuthResponse(
    string Token,
    string Role,
    string DisplayName,
    string? FirmaKodu,
    string? FirmaName,
    string? TenantRole = null,
    Dictionary<string, bool>? Permissions = null);

public record CreateUserRequest(string Username, string Password, string DisplayName, string Role, Dictionary<string, bool>? Permissions);

public record UpdateUserPermissionsRequest(string? Role, Dictionary<string, bool>? Permissions);

public record ResetPasswordRequest(string NewPassword);

public record CreateTenantRequest(
    string Name,
    string ContactEmail,
    string? ContactPhone,
    bool ProvisionNow = true);

public record ProductRequest(
    string Name,
    string? Barcode,
    decimal PurchasePrice,
    decimal SalePrice,
    decimal VatRate,
    decimal StockQuantity,
    decimal CriticalStockLevel,
    Guid? CategoryId = null,
    Guid? DepartmentId = null,
    string? Unit = null,
    string? OriginCountry = null,
    bool IsDomestic = false,
    decimal UnitQty = 1,
    string? UnitType = null,
    List<ProductVariantLine>? Variants = null);

public record ProductVariantLine(string? Size, string? Color, decimal StockQuantity);

public record CategoryRequest(string Name, string? Color);

public record DepartmentRequest(string Name, string? Color, decimal VatRate);

public record NameRequest(string Name, string? Color);

public record VariantRequest(Guid SizeId, Guid ColorId);

public record CreateCustomerRequest(string Name, string? Phone, string? Email, string? Address, string? Note, decimal? CreditLimit);

public record CustomerPaymentRequest(decimal Amount, string? Note, Guid? AccountId = null);

public record SaveSupplierRequest(string Name, string? Phone, string? Email, string? Address, string? Note);

public record SaleLineRequest(
    Guid? ProductId,
    decimal Quantity,
    Guid? VariantId = null,
    decimal? UnitPrice = null,
    string? Name = null,
    decimal? VatRate = null);

public record CreateSaleRequest(
    List<SaleLineRequest> Items,
    string PaymentMethod,
    Guid? CustomerId,
    decimal? DiscountAmount = null);

public record PurchaseLineRequest(Guid ProductId, Guid? VariantId, decimal Quantity, decimal UnitCost);

public record PurchaseRequest(string? SupplierName, string? InvoiceNo, DateTime? PurchasedAt, List<PurchaseLineRequest> Lines, string? PaymentKind = null, Guid? AccountId = null);
