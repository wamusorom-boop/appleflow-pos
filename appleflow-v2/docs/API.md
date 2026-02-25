# AppleFlow POS - API Documentation

Complete REST API reference for AppleFlow POS.

**Base URL**: `https://api.yourdomain.com/api`

---

## Authentication

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "pin": "1234"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "role": "cashier",
      "tenant_id": "uuid"
    },
    "tokens": {
      "accessToken": "eyJhbG...",
      "refreshToken": "eyJhbG..."
    }
  }
}
```

### Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbG..."
}
```

### Logout

```http
POST /auth/logout
Authorization: Bearer {accessToken}
```

### Get Current User

```http
GET /auth/me
Authorization: Bearer {accessToken}
```

---

## Products

### List Products

```http
GET /products?page=1&limit=20&search=iphone&category=phones
Authorization: Bearer {accessToken}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "iPhone 15 Pro",
      "sku": "IPH15P-001",
      "barcode": "123456789",
      "price": 999.99,
      "cost_price": 850.00,
      "stock_quantity": 25,
      "category_name": "Phones",
      "is_active": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Create Product

```http
POST /products
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "iPhone 15 Pro",
  "sku": "IPH15P-001",
  "barcode": "123456789",
  "description": "Latest iPhone",
  "price": 999.99,
  "cost_price": 850.00,
  "category_id": "uuid",
  "tax_rate": 16,
  "track_inventory": true,
  "reorder_point": 5
}
```

### Update Product

```http
PUT /products/{id}
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "iPhone 15 Pro Max",
  "price": 1099.99
}
```

### Delete Product

```http
DELETE /products/{id}
Authorization: Bearer {accessToken}
```

---

## Sales

### Create Sale

```http
POST /sales
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "customer_id": "uuid",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 2,
      "unit_price": 999.99
    }
  ],
  "discount_amount": 50.00,
  "payment_method": "cash",
  "notes": "Customer pickup"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "receipt_number": "RCP-2024-0001",
    "total_amount": 1999.98,
    "discount_amount": 50.00,
    "tax_amount": 311.20,
    "final_amount": 2261.18,
    "payment_method": "cash",
    "status": "completed",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### List Sales

```http
GET /sales?dateFrom=2024-01-01&dateTo=2024-01-31&status=completed
Authorization: Bearer {accessToken}
```

### Get Sale Details

```http
GET /sales/{id}
Authorization: Bearer {accessToken}
```

### Void Sale

```http
POST /sales/{id}/void
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "reason": "Customer cancelled"
}
```

### Print Receipt

```http
GET /sales/{id}/receipt
Authorization: Bearer {accessToken}
```

---

## Customers

### List Customers

```http
GET /customers?search=john&page=1
Authorization: Bearer {accessToken}
```

### Create Customer

```http
POST /customers
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+254700000000",
  "address": "123 Main St",
  "city": "Nairobi"
}
```

### Update Customer

```http
PUT /customers/{id}
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "phone": "+254711111111"
}
```

### Get Customer History

```http
GET /customers/{id}/history
Authorization: Bearer {accessToken}
```

---

## Inventory

### List Inventory

```http
GET /inventory?store=uuid&stock=low
Authorization: Bearer {accessToken}
```

### Adjust Stock

```http
POST /inventory/adjust
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "productId": "uuid",
  "storeId": "uuid",
  "quantity": 10,
  "type": "in",
  "notes": "Initial stock"
}
```

### Get Stock Movements

```http
GET /inventory/movements?productId=uuid
Authorization: Bearer {accessToken}
```

---

## Users

### List Users

```http
GET /users
Authorization: Bearer {accessToken}
```

### Create User

```http
POST /users
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "email": "cashier@store.com",
  "full_name": "Jane Smith",
  "phone": "+254722222222",
  "role": "cashier",
  "store_id": "uuid",
  "pin": "1234"
}
```

### Update User

```http
PUT /users/{id}
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "role": "manager",
  "pin": "5678"
}
```

### Toggle User Status

```http
PATCH /users/{id}/status
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "is_active": false
}
```

---

## Reports

### Sales Report

```http
GET /reports/sales?range=this_month
Authorization: Bearer {accessToken}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "period": "2024-01-01",
      "total_sales": 45,
      "total_revenue": 12500.00,
      "total_discount": 500.00,
      "total_tax": 1920.00,
      "average_order_value": 277.78,
      "unique_customers": 32
    }
  ]
}
```

### Products Report

```http
GET /reports/products?range=this_month
Authorization: Bearer {accessToken}
```

### Payments Report

```http
GET /reports/payments?range=this_month
Authorization: Bearer {accessToken}
```

### Dashboard Stats

```http
GET /reports/dashboard
Authorization: Bearer {accessToken}
```

---

## Stores

### List Stores

```http
GET /stores
Authorization: Bearer {accessToken}
```

### Create Store

```http
POST /stores
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "Downtown Branch",
  "code": "DT",
  "address": "456 Market St",
  "phone": "+254733333333"
}
```

---

## Categories

### List Categories

```http
GET /categories
Authorization: Bearer {accessToken}
```

### Create Category

```http
POST /categories
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "Electronics",
  "description": "Electronic devices"
}
```

---

## Settings

### Get Settings

```http
GET /settings
Authorization: Bearer {accessToken}
```

### Update Settings

```http
PUT /settings
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "store": {
    "name": "My Store",
    "receipt_header": "Thank you for shopping!",
    "default_tax_rate": 16
  }
}
```

---

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

### 403 Forbidden

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions"
  }
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

### 429 Too Many Requests

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests, please try again later"
  }
}
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Authentication | 5 requests / minute |
| API General | 100 requests / 15 minutes |
| Sales Creation | 60 requests / minute |

---

## Pagination

All list endpoints support pagination:

```http
GET /products?page=2&limit=50
```

**Response includes**:
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 50,
    "total": 150,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": true
  }
}
```

---

## Filtering

Common filter parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `search` | Text search | `search=iphone` |
| `dateFrom` | Start date | `dateFrom=2024-01-01` |
| `dateTo` | End date | `dateTo=2024-01-31` |
| `status` | Filter by status | `status=completed` |
| `category` | Filter by category | `category=phones` |

---

## WebSocket (Real-time)

Connect for real-time updates:

```javascript
const ws = new WebSocket('wss://api.yourdomain.com/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'sales'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('New sale:', data);
};
```

---

**Last Updated**: 2024
**API Version**: 2.0
