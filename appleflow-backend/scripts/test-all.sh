#!/bin/bash
# AppleFlow POS - Complete API Testing Script
# Usage: ./test-all.sh https://your-api-url.com

set -e

API_URL="${1:-http://localhost:3000}"
TOKEN=""

echo "🧪 AppleFlow POS - API Testing Suite"
echo "===================================="
echo "API URL: $API_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

success_count=0
fail_count=0

# Helper functions
log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((success_count++))
}

log_fail() {
    echo -e "${RED}❌ $1${NC}"
    ((fail_count++))
}

log_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local auth=$4
    
    if [ -n "$auth" ] && [ -n "$TOKEN" ]; then
        if [ -n "$data" ]; then
            curl -s -X "$method" "$API_URL$endpoint" \
                -H "Authorization: Bearer $TOKEN" \
                -H "Content-Type: application/json" \
                -d "$data" 2>/dev/null
        else
            curl -s -X "$method" "$API_URL$endpoint" \
                -H "Authorization: Bearer $TOKEN" 2>/dev/null
        fi
    else
        if [ -n "$data" ]; then
            curl -s -X "$method" "$API_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data" 2>/dev/null
        else
            curl -s -X "$method" "$API_URL$endpoint" 2>/dev/null
        fi
    fi
}

# ============================================
# TEST 1: Health Check
# ============================================
echo "TEST 1: Health Check"
echo "--------------------"
response=$(make_request "GET" "/health")
if echo "$response" | grep -q '"status":"healthy"'; then
    log_success "Health check passed"
else
    log_fail "Health check failed"
    log_info "Response: $response"
fi
echo ""

# ============================================
# TEST 2: Login
# ============================================
echo "TEST 2: Login"
echo "-------------"
response=$(make_request "POST" "/api/auth/login" '{"email":"admin@appleflow.pos","pin":"1234"}')
if echo "$response" | grep -q '"success":true'; then
    TOKEN=$(echo "$response" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    log_success "Login successful"
    log_info "Token received: ${TOKEN:0:20}..."
else
    log_fail "Login failed"
    log_info "Response: $response"
    echo ""
    echo "⚠️  Cannot continue without valid token. Make sure to seed the database first:"
    echo "   npx prisma db seed"
    exit 1
fi
echo ""

# ============================================
# TEST 3: List Products
# ============================================
echo "TEST 3: List Products"
echo "---------------------"
response=$(make_request "GET" "/api/products" "" "auth")
if echo "$response" | grep -q '"success":true'; then
    count=$(echo "$response" | grep -o '"products"' | wc -l)
    log_success "Products listed successfully"
else
    log_fail "Failed to list products"
    log_info "Response: $response"
fi
echo ""

# ============================================
# TEST 4: Create Product
# ============================================
echo "TEST 4: Create Product"
echo "----------------------"
response=$(make_request "POST" "/api/products" '{
    "sku": "TEST'$(date +%s)'",
    "name": "Test Product '$(date +%s)'",
    "barcode": "TEST'$(date +%s)'",
    "costPrice": 50,
    "sellingPrice": 75,
    "quantity": 100,
    "minStockLevel": 10,
    "categoryId": ""
}' "auth")
if echo "$response" | grep -q '"success":true'; then
    PRODUCT_ID=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    log_success "Product created: $PRODUCT_ID"
else
    log_fail "Failed to create product"
    log_info "Response: $response"
fi
echo ""

# ============================================
# TEST 5: List Customers
# ============================================
echo "TEST 5: List Customers"
echo "----------------------"
response=$(make_request "GET" "/api/customers" "" "auth")
if echo "$response" | grep -q '"success":true'; then
    log_success "Customers listed successfully"
else
    log_fail "Failed to list customers"
fi
echo ""

# ============================================
# TEST 6: Create Customer
# ============================================
echo "TEST 6: Create Customer"
echo "-----------------------"
response=$(make_request "POST" "/api/customers" '{
    "name": "Test Customer '$(date +%s)'",
    "phone": "2547'$(shuf -i 10000000-99999999 -n 1)'",
    "email": "test'$(date +%s)'@example.com"
}' "auth")
if echo "$response" | grep -q '"success":true'; then
    CUSTOMER_ID=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    log_success "Customer created: $CUSTOMER_ID"
else
    log_fail "Failed to create customer"
    log_info "Response: $response"
fi
echo ""

# ============================================
# TEST 7: List Sales
# ============================================
echo "TEST 7: List Sales"
echo "------------------"
response=$(make_request "GET" "/api/sales" "" "auth")
if echo "$response" | grep -q '"success":true'; then
    log_success "Sales listed successfully"
else
    log_fail "Failed to list sales"
fi
echo ""

# ============================================
# TEST 8: Create Sale
# ============================================
echo "TEST 8: Create Sale"
echo "-------------------"
if [ -n "$PRODUCT_ID" ]; then
    response=$(make_request "POST" "/api/sales" '{
        "items": [
            {
                "productId": "'$PRODUCT_ID'",
                "quantity": 2,
                "unitPrice": 75
            }
        ],
        "payments": [
            {
                "method": "CASH",
                "amount": 150
            }
        ]
    }' "auth")
    if echo "$response" | grep -q '"success":true'; then
        SALE_ID=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        log_success "Sale created: $SALE_ID"
    else
        log_fail "Failed to create sale"
        log_info "Response: $response"
    fi
else
    log_info "Skipping - no product ID available"
fi
echo ""

# ============================================
# TEST 9: Current Shift
# ============================================
echo "TEST 9: Current Shift"
echo "---------------------"
response=$(make_request "GET" "/api/shifts/current" "" "auth")
if echo "$response" | grep -q '"success":true'; then
    log_success "Shift endpoint working"
else
    log_fail "Shift endpoint failed"
fi
echo ""

# ============================================
# TEST 10: Dashboard Stats
# ============================================
echo "TEST 10: Dashboard Stats"
echo "------------------------"
response=$(make_request "GET" "/api/reports/dashboard" "" "auth")
if echo "$response" | grep -q '"success":true'; then
    log_success "Dashboard stats retrieved"
else
    log_fail "Failed to get dashboard stats"
fi
echo ""

# ============================================
# TEST 11: Hardware Status
# ============================================
echo "TEST 11: Hardware Status"
echo "------------------------"
response=$(make_request "GET" "/api/hardware/status" "" "auth")
if echo "$response" | grep -q '"success":true'; then
    log_success "Hardware endpoint working"
else
    log_fail "Hardware endpoint failed"
fi
echo ""

# ============================================
# TEST 12: Sync Status
# ============================================
echo "TEST 12: Sync Status"
echo "--------------------"
response=$(make_request "GET" "/api/sync/status" "" "auth")
if echo "$response" | grep -q '"success":true'; then
    log_success "Sync endpoint working"
else
    log_fail "Sync endpoint failed"
fi
echo ""

# ============================================
# TEST 13: M-Pesa Status
# ============================================
echo "TEST 13: M-Pesa Status"
echo "----------------------"
response=$(make_request "GET" "/api/mpesa/transactions" "" "auth")
if echo "$response" | grep -q '"success":true'; then
    log_success "M-Pesa endpoint working"
else
    log_fail "M-Pesa endpoint failed"
fi
echo ""

# ============================================
# SUMMARY
# ============================================
echo "===================================="
echo "📊 TEST SUMMARY"
echo "===================================="
echo -e "${GREEN}✅ Passed: $success_count${NC}"
echo -e "${RED}❌ Failed: $fail_count${NC}"
echo ""

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Your API is working correctly.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check the logs above.${NC}"
    exit 1
fi
