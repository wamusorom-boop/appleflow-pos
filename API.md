# AppleFlow POS API Documentation

## Base URL

```
Development: http://localhost:3000/api
Production: https://api.appleflow.pos/api
```

## Authentication

All endpoints (except login) require a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### POST /auth/login

Authenticate a user and receive access tokens.

**Request:**
```json
{
  "email": "cashier@appleflow.pos",
  "pin": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "cashier@appleflow.pos",
      "name": "John Doe",
      "role": "CASHIER"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": 28800
    }
  }
}
```

### POST /auth/refresh

Refresh an expired access token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

## Sales

### GET /sales

List sales with pagination and filtering.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 50)
- `from` (date): Start date filter
- `to` (date): End date filter
- `status` (string): Filter by status
- `customerId` (string): Filter by customer

**Response:**
```json
{
  "sales": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

### POST /sales

Create a new sale transaction.

**Request:**
```json
{
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "unitPrice": 1500
    }
  ],
  "payments": [
    {
      "method": "CASH",
      "amount": 3000
    }
  ],
  "customerId": "uuid",
  "discountAmount": 0,
  "notes": "Optional notes"
}
```

**Response:**
```json
{
  "id": "uuid",
  "receiptNumber": "RCP-20240101120000",
  "subtotal": 3000,
  "taxAmount": 0,
  "discountAmount": 0,
  "total": 3000,
  "status": "COMPLETED",
  "items": [...],
  "payments": [...],
  "createdAt": "2024-01-01T12:00:00Z"
}
```

### POST /sales/:id/void

Void a sale (requires manager permission).

**Request:**
```json
{
  "reason": "Customer changed mind"
}
```

### POST /sales/:id/return

Process a return for a sale.

**Request:**
```json
{
  "items": [
    {
      "saleItemId": "uuid",
      "quantity": 1,
      "reason": "Defective product"
    }
  ],
  "refundMethod": "CASH"
}
```

## Products

### GET /products

List products with search and filtering.

**Query Parameters:**
- `search` (string): Search by name, SKU, or barcode
- `category` (string): Filter by category
- `lowStock` (boolean): Show only low stock items
- `page` (number): Page number
- `limit` (number): Items per page

### POST /products

Create a new product.

**Request:**
```json
{
  "name": "Wireless Mouse",
  "sku": "ELEC-001",
  "barcode": "1234567890123",
  "category": "Electronics",
  "price": 1500,
  "costPrice": 900,
  "quantity": 50,
  "reorderPoint": 10,
  "supplier": "Tech Supplies Ltd"
}
```

### PUT /products/:id

Update a product.

### DELETE /products/:id

Delete a product (soft delete).

## Customers

### GET /customers

List customers with search.

**Query Parameters:**
- `search` (string): Search by name, email, or phone
- `tier` (string): Filter by loyalty tier
- `page` (number): Page number
- `limit` (number): Items per page

### POST /customers

Create a new customer.

**Request:**
```json
{
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "phone": "+254712345678",
  "address": "123 Main St",
  "city": "Nairobi",
  "loyaltyTier": "SILVER"
}
```

### GET /customers/:id

Get customer details with purchase history.

### POST /customers/:id/loyalty

Adjust customer loyalty points.

**Request:**
```json
{
  "points": 100,
  "reason": "Purchase bonus"
}
```

### GET /customers/:id/statement

Get customer account statement.

**Query Parameters:**
- `from` (date): Start date
- `to` (date): End date

## Shifts

### GET /shifts/current

Get the current user's active shift.

### POST /shifts/start

Start a new shift (clock in).

**Request:**
```json
{
  "openingCash": 5000,
  "notes": "Starting shift"
}
```

### POST /shifts/:id/end

End a shift (clock out).

**Request:**
```json
{
  "closingCash": 15000,
  "notes": "Ending shift"
}
```

### GET /shifts/:id/report

Get shift report (X-Report style).

## Reports

### GET /reports/x-report

Generate current X-Report (non-final).

**Query Parameters:**
- `date` (date): Report date (default: today)

**Response:**
```json
{
  "reportType": "X-REPORT",
  "date": "2024-01-01",
  "summary": {
    "totalSales": 50000,
    "transactionCount": 25,
    "averageTransaction": 2000,
    "totalTax": 0,
    "totalDiscounts": 500
  },
  "paymentsByMethod": {
    "CASH": 30000,
    "MPESA": 15000,
    "CARD": 5000
  },
  "byCategory": {...},
  "hourlyBreakdown": [...]
}
```

### POST /reports/z-report

Generate and finalize Z-Report (End of Day).

**Request:**
```json
{
  "date": "2024-01-01",
  "closingCash": 50000,
  "openingCash": 10000
}
```

### GET /reports/sales

Sales report with date range.

**Query Parameters:**
- `from` (date, required): Start date
- `to` (date, required): End date
- `groupBy` (string): Group by hour/day/week/month

### GET /reports/products

Product performance report.

**Query Parameters:**
- `from` (date): Start date
- `to` (date): End date
- `limit` (number): Number of products

### GET /reports/inventory

Inventory valuation report.

## Inventory

### GET /inventory/adjustments

List stock adjustments.

### POST /inventory/adjustments

Create stock adjustment.

**Request:**
```json
{
  "productId": "uuid",
  "quantity": 10,
  "type": "ADD",
  "reason": "Stock count correction",
  "notes": "Found extra items"
}
```

**Types:** ADD, REMOVE, SET, DAMAGE, EXPIRY, THEFT

### GET /inventory/transfers

List stock transfers.

### POST /inventory/transfers

Create stock transfer.

**Request:**
```json
{
  "fromLocation": "Main Store",
  "toLocation": "Branch A",
  "notes": "Restocking",
  "items": [
    {
      "productId": "uuid",
      "quantity": 20
    }
  ]
}
```

### POST /inventory/transfers/:id/receive

Receive a transfer.

### GET /inventory/purchase-orders

List purchase orders.

### POST /inventory/purchase-orders

Create purchase order.

**Request:**
```json
{
  "supplier": "Tech Supplies Ltd",
  "expectedDelivery": "2024-01-15T00:00:00Z",
  "notes": "Monthly restock",
  "items": [
    {
      "productId": "uuid",
      "quantity": 50,
      "unitCost": 800
    }
  ]
}
```

### POST /inventory/purchase-orders/:id/receive

Receive goods (GRN).

**Request:**
```json
{
  "items": [
    {
      "itemId": "uuid",
      "receivedQuantity": 50,
      "unitCost": 800
    }
  ],
  "notes": "All items received in good condition"
}
```

### GET /inventory/alerts/low-stock

Get low stock alerts.

**Query Parameters:**
- `threshold` (number): Stock threshold (default: 10)

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate data)
- `422` - Unprocessable Entity (business logic error)
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

## Rate Limits

- General API: 100 requests per 15 minutes
- Authentication: 10 requests per 15 minutes
- Sales creation: 200 requests per 15 minutes

## Pagination

All list endpoints support pagination:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

## Date Format

All dates are in ISO 8601 format: `YYYY-MM-DDTHH:mm:ssZ`

## Currency

All monetary values are in integer cents to avoid floating-point errors:
- 1500 = KES 15.00
- 10000 = KES 100.00
