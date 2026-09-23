namespace HizliSatis.Api.Contracts;

public record PlatformLoginRequest(string Username, string Password);

public record TenantLoginRequest(string FirmaKodu, string Username, string Password);

public record AuthResponse(
    string Token,
    string Role,
    string DisplayName,
    string? FirmaKodu,
    string? FirmaName);

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
    decimal CriticalStockLevel);

public record CreateCustomerRequest(string Name, string? Phone, string? Note);

public record CustomerPaymentRequest(decimal Amount, string? Note);

public record SaleLineRequest(Guid ProductId, decimal Quantity);

public record CreateSaleRequest(
    List<SaleLineRequest> Items,
    string PaymentMethod,
    Guid? CustomerId);
