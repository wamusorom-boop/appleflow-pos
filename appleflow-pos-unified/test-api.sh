#!/bin/bash
# AppleFlow POS - API Testing Script
# Usage: ./test-api.sh [API_URL]

API_URL="${1:-http://localhost:3000}"
TOKEN=""

echo "🧪 AppleFlow POS API Tests"
echo "=========================="
echo "API URL: $API_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

success_count=0
fail_count=0

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

# ============================================
# TEST 1: Health Check
# ============================================
echo "TEST 1: Health Check"
echo "--------------------"
response=$(curl -s "$API_URL/health")
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
response=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@appleflow.pos","pin":"1234"}')

if echo "$response" | grep -q '"success":true'; then
    TOKEN=$(echo "$response" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    log_success "Login successful"
    log_info "Token: ${TOKEN:0:20}..."
else
    log_fail "Login failed"
    log_info "Response: $response"
    echo ""
    echo "⚠️  Cannot continue without valid token. Make sure to seed the database:"
    echo "   npm run db:seed"
    exit 1
fi
echo ""

# ============================================
# TEST 3: Token Validation
# ============================================
echo "TEST 3: Token Validation"
echo "------------------------"
response=$(curl -s -X POST "$API_URL/api/auth/validate" \
  -H "Authorization: Bearer $TOKEN")

if echo "$response" | grep -q '"valid":true'; then
    log_success "Token validation passed"
else
    log_fail "Token validation failed"
    log_info "Response: $response"
fi
echo ""

# ============================================
# TEST 4: Get Current User
# ============================================
echo "TEST 4: Get Current User"
echo "------------------------"
response=$(curl -s "$API_URL/api/auth/me" \
  -H "Authorization: Bearer $TOKEN")

if echo "$response" | grep -q '"success":true'; then
    log_success "Get user passed"
else
    log_fail "Get user failed"
    log_info "Response: $response"
fi
echo ""

# ============================================
# TEST 5: List Products
# ============================================
echo "TEST 5: List Products"
echo "---------------------"
response=$(curl -s "$API_URL/api/products" \
  -H "Authorization: Bearer $TOKEN")

if echo "$response" | grep -q '"success":true'; then
    log_success "List products passed"
else
    log_fail "List products failed"
    log_info "Response: $response"
fi
echo ""

# ============================================
# TEST 6: List Categories
# ============================================
echo "TEST 6: List Categories"
echo "-----------------------"
response=$(curl -s "$API_URL/api/categories" \
  -H "Authorization: Bearer $TOKEN")

if echo "$response" | grep -q '"success":true'; then
    log_success "List categories passed"
else
    log_fail "List categories failed"
    log_info "Response: $response"
fi
echo ""

# ============================================
# TEST 7: List Customers
# ============================================
echo "TEST 7: List Customers"
echo "----------------------"
response=$(curl -s "$API_URL/api/customers" \
  -H "Authorization: Bearer $TOKEN")

if echo "$response" | grep -q '"success":true'; then
    log_success "List customers passed"
else
    log_fail "List customers failed"
    log_info "Response: $response"
fi
echo ""

# ============================================
# TEST 8: List Sales
# ============================================
echo "TEST 8: List Sales"
echo "------------------"
response=$(curl -s "$API_URL/api/sales" \
  -H "Authorization: Bearer $TOKEN")

if echo "$response" | grep -q '"success":true'; then
    log_success "List sales passed"
else
    log_fail "List sales failed"
    log_info "Response: $response"
fi
echo ""

# ============================================
# TEST 9: Dashboard Stats
# ============================================
echo "TEST 9: Dashboard Stats"
echo "-----------------------"
response=$(curl -s "$API_URL/api/reports/dashboard" \
  -H "Authorization: Bearer $TOKEN")

if echo "$response" | grep -q '"success":true'; then
    log_success "Dashboard stats passed"
else
    log_fail "Dashboard stats failed"
    log_info "Response: $response"
fi
echo ""

# ============================================
# TEST 10: List Users (Admin only)
# ============================================
echo "TEST 10: List Users"
echo "-------------------"
response=$(curl -s "$API_URL/api/users" \
  -H "Authorization: Bearer $TOKEN")

if echo "$response" | grep -q '"success":true'; then
    log_success "List users passed"
else
    log_fail "List users failed"
    log_info "Response: $response"
fi
echo ""

# ============================================
# TEST 11: Logout
# ============================================
echo "TEST 11: Logout"
echo "---------------"
response=$(curl -s -X POST "$API_URL/api/auth/logout" \
  -H "Authorization: Bearer $TOKEN")

if echo "$response" | grep -q '"success":true'; then
    log_success "Logout passed"
else
    log_fail "Logout failed"
    log_info "Response: $response"
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
