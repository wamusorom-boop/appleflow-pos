-- AppleFlow POS v2.0 - Enterprise Multi-Tenant Schema
-- Supabase PostgreSQL Schema with Row Level Security (RLS)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TENANT MANAGEMENT (Multi-tenancy core)
-- ============================================

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Kenya',
    currency VARCHAR(10) DEFAULT 'KES',
    currency_symbol VARCHAR(10) DEFAULT 'KSh',
    tax_id VARCHAR(100),
    vat_number VARCHAR(100),
    
    -- Business settings
    business_type VARCHAR(50) DEFAULT 'retail', -- retail, restaurant, service
    receipt_header TEXT,
    receipt_footer TEXT,
    receipt_show_logo BOOLEAN DEFAULT true,
    receipt_show_tax BOOLEAN DEFAULT true,
    
    -- Feature toggles
    enable_loyalty BOOLEAN DEFAULT true,
    enable_gift_cards BOOLEAN DEFAULT true,
    enable_credit_sales BOOLEAN DEFAULT false,
    enable_tables BOOLEAN DEFAULT false,
    enable_delivery BOOLEAN DEFAULT false,
    enable_reservations BOOLEAN DEFAULT false,
    enable_staff_tracking BOOLEAN DEFAULT false,
    enable_multi_store BOOLEAN DEFAULT false,
    
    -- Loyalty settings
    loyalty_points_per_currency DECIMAL(10,2) DEFAULT 1.00,
    loyalty_redemption_rate DECIMAL(10,2) DEFAULT 100.00,
    
    -- Subscription & Billing
    subscription_status VARCHAR(50) DEFAULT 'trial', -- trial, active, past_due, cancelled, suspended
    subscription_tier VARCHAR(50) DEFAULT 'trial', -- trial, starter, professional, enterprise
    subscription_started_at TIMESTAMPTZ,
    subscription_expires_at TIMESTAMPTZ,
    subscription_cancelled_at TIMESTAMPTZ,
    grace_period_ends_at TIMESTAMPTZ,
    
    -- Limits based on tier
    max_users INTEGER DEFAULT 2,
    max_stores INTEGER DEFAULT 1,
    max_products INTEGER DEFAULT 100,
    
    -- Branding
    logo_url TEXT,
    favicon_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#0ea5e9',
    
    -- Status
    status VARCHAR(50) DEFAULT 'active', -- active, suspended, cancelled
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Stores (for multi-store tenants)
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Kenya',
    phone VARCHAR(50),
    email VARCHAR(255),
    
    -- Manager
    manager_id UUID,
    
    -- Settings
    is_active BOOLEAN DEFAULT true,
    is_headquarters BOOLEAN DEFAULT false,
    opening_time TIME,
    closing_time TIME,
    
    -- Receipt settings override
    receipt_header TEXT,
    receipt_footer TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, code)
);

-- ============================================
-- USER MANAGEMENT (Supabase Auth Integration)
-- ============================================

CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    
    -- Profile
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(200) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    avatar_url TEXT,
    
    -- Role (RBAC)
    role VARCHAR(50) NOT NULL DEFAULT 'cashier', -- super_admin, tenant_admin, manager, supervisor, cashier, staff
    
    -- Custom permissions override (JSON)
    permissions JSONB DEFAULT '{}'::jsonb,
    
    -- PIN for POS login (hashed)
    pin_hash VARCHAR(255),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    
    -- Preferences
    theme VARCHAR(50) DEFAULT 'system',
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'Africa/Nairobi',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, email)
);

-- User sessions for tracking
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Session info
    token VARCHAR(255) NOT NULL,
    refresh_token VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Device info
    device_id VARCHAR(255),
    device_name VARCHAR(255),
    device_type VARCHAR(50), -- pos_terminal, mobile, tablet, desktop
    ip_address INET,
    user_agent TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(255),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_user_sessions_token(token),
    INDEX idx_user_sessions_user_id(user_id)
);

-- Activity logs (audit trail)
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    
    -- Action details
    action VARCHAR(100) NOT NULL, -- LOGIN, LOGOUT, SALE_CREATED, PRODUCT_UPDATED, etc.
    entity_type VARCHAR(100), -- Sale, Product, User, etc.
    entity_id UUID,
    description TEXT,
    
    -- Change tracking
    old_values JSONB,
    new_values JSONB,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    session_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_activity_logs_tenant_user(tenant_id, user_id),
    INDEX idx_activity_logs_created_at(created_at),
    INDEX idx_activity_logs_action(action)
);

-- ============================================
-- PRODUCT & INVENTORY
-- ============================================

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3b82f6',
    icon VARCHAR(100),
    image_url TEXT,
    
    -- Hierarchy
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, name)
);

CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url TEXT,
    website VARCHAR(255),
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, name)
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL, -- NULL = available in all stores
    
    -- Identification
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    barcode VARCHAR(100),
    qr_code VARCHAR(100),
    
    -- Pricing
    cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    selling_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    wholesale_price DECIMAL(12,2),
    member_price DECIMAL(12,2),
    
    -- Tax
    tax_rate DECIMAL(5,2) DEFAULT 0,
    is_tax_inclusive BOOLEAN DEFAULT false,
    
    -- Inventory
    track_inventory BOOLEAN DEFAULT true,
    allow_backorders BOOLEAN DEFAULT false,
    
    -- Product type
    product_type VARCHAR(50) DEFAULT 'standard', -- standard, weighted, serialized, service, combo
    unit_of_measure VARCHAR(50) DEFAULT 'piece', -- piece, kg, g, lb, oz, liter, ml
    
    -- Physical
    weight DECIMAL(10,3),
    dimensions JSONB, -- {length, width, height}
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    
    -- Relations
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    
    -- Metadata
    tags TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    UNIQUE(tenant_id, sku),
    UNIQUE(tenant_id, barcode) WHERE barcode IS NOT NULL
);

-- Product variants (for size/color variations)
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    sku VARCHAR(100) NOT NULL,
    barcode VARCHAR(100),
    
    -- Variant attributes
    attributes JSONB NOT NULL, -- {size: "Large", color: "Red"}
    
    -- Pricing override
    price_override DECIMAL(12,2),
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, sku)
);

-- Inventory (stock levels per store)
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    
    -- Stock levels
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0, -- For pending orders
    available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
    
    -- Alerts
    min_stock_level INTEGER DEFAULT 10,
    max_stock_level INTEGER,
    reorder_point INTEGER DEFAULT 20,
    reorder_quantity INTEGER DEFAULT 50,
    
    -- Location
    location_code VARCHAR(100),
    bin_number VARCHAR(100),
    
    last_counted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, store_id, product_id, variant_id)
);

-- Stock movements (audit trail)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    
    -- Movement details
    movement_type VARCHAR(50) NOT NULL, -- sale, purchase, adjustment, transfer_in, transfer_out, return, damage, count
    quantity INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    
    -- Reference
    reference_type VARCHAR(50), -- sale, purchase_order, adjustment, transfer
    reference_id UUID,
    
    -- Reason
    reason VARCHAR(255),
    notes TEXT,
    
    -- User
    created_by UUID NOT NULL REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Serialized items (for IMEI/serial tracking)
CREATE TABLE serialized_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    serial_number VARCHAR(255) NOT NULL,
    imei VARCHAR(100),
    
    status VARCHAR(50) DEFAULT 'in_stock', -- in_stock, sold, reserved, defective, returned, lost
    
    -- Purchase info
    purchase_cost DECIMAL(12,2),
    purchase_date DATE,
    
    -- Sale info
    sale_id UUID,
    sale_price DECIMAL(12,2),
    sale_date DATE,
    
    -- Warranty
    warranty_start DATE,
    warranty_end DATE,
    
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, serial_number),
    UNIQUE(tenant_id, imei) WHERE imei IS NOT NULL
);

-- ============================================
-- CUSTOMERS
-- ============================================

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(200) GENERATED ALWAYS AS (COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) STORED,
    email VARCHAR(255),
    phone VARCHAR(50),
    phone2 VARCHAR(50),
    
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Kenya',
    
    -- Business
    company_name VARCHAR(255),
    tax_id VARCHAR(100),
    
    -- Loyalty
    loyalty_card_number VARCHAR(100),
    loyalty_points INTEGER DEFAULT 0,
    lifetime_points INTEGER DEFAULT 0,
    loyalty_tier VARCHAR(50) DEFAULT 'bronze',
    
    -- Credit
    credit_limit DECIMAL(12,2) DEFAULT 0,
    current_balance DECIMAL(12,2) DEFAULT 0,
    
    -- Stats
    total_spent DECIMAL(12,2) DEFAULT 0,
    total_visits INTEGER DEFAULT 0,
    last_visit_at TIMESTAMPTZ,
    
    -- Preferences
    preferences JSONB DEFAULT '{}'::jsonb,
    
    -- Birthday for promotions
    birth_date DATE,
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    UNIQUE(tenant_id, loyalty_card_number) WHERE loyalty_card_number IS NOT NULL,
    UNIQUE(tenant_id, phone) WHERE phone IS NOT NULL
);

-- ============================================
-- SALES & TRANSACTIONS
-- ============================================

CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    
    -- Receipt info
    receipt_number VARCHAR(100) NOT NULL,
    
    -- Amounts
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_total DECIMAL(12,2) DEFAULT 0,
    tax_total DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    -- Status
    status VARCHAR(50) DEFAULT 'completed', -- pending, completed, voided, refunded, layaway, quotation
    
    -- Type
    sale_type VARCHAR(50) DEFAULT 'instore', -- instore, online, phone, delivery, pickup
    
    -- Relations
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES user_profiles(id),
    shift_id UUID,
    
    -- For restaurants
    table_id UUID,
    guests INTEGER,
    
    -- Void/Refund info
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES user_profiles(id),
    void_reason TEXT,
    
    refund_amount DECIMAL(12,2),
    refund_reason TEXT,
    
    -- Notes
    notes TEXT,
    internal_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    UNIQUE(tenant_id, receipt_number)
);

CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    
    -- Snapshot at time of sale
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    
    -- Discounts
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    
    -- Tax
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    
    -- Total
    total DECIMAL(12,2) NOT NULL,
    
    -- For serialized products
    serial_number VARCHAR(255),
    
    -- For restaurants
    kitchen_status VARCHAR(50) DEFAULT 'pending', -- pending, preparing, ready, served, cancelled
    kitchen_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    
    method VARCHAR(50) NOT NULL, -- cash, mpesa, card, bank_transfer, cheque, gift_card, store_credit, loyalty_points
    amount DECIMAL(12,2) NOT NULL,
    
    -- M-Pesa specific
    mpesa_code VARCHAR(100),
    mpesa_phone VARCHAR(50),
    mpesa_receipt VARCHAR(100),
    
    -- Card specific
    card_last4 VARCHAR(4),
    card_type VARCHAR(50),
    
    -- Reference
    reference VARCHAR(255),
    
    -- Status
    status VARCHAR(50) DEFAULT 'completed', -- pending, completed, failed, refunded
    
    -- Idempotency
    idempotency_key VARCHAR(255),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL
);

-- ============================================
-- SHIFTS & CASH MANAGEMENT
-- ============================================

CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id),
    
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    
    -- Cash
    opening_cash DECIMAL(12,2) NOT NULL,
    closing_cash DECIMAL(12,2),
    expected_cash DECIMAL(12,2),
    cash_difference DECIMAL(12,2),
    
    -- Sales summary
    cash_sales DECIMAL(12,2) DEFAULT 0,
    mpesa_sales DECIMAL(12,2) DEFAULT 0,
    card_sales DECIMAL(12,2) DEFAULT 0,
    bank_sales DECIMAL(12,2) DEFAULT 0,
    credit_sales DECIMAL(12,2) DEFAULT 0,
    gift_card_sales DECIMAL(12,2) DEFAULT 0,
    
    transaction_count INTEGER DEFAULT 0,
    refund_total DECIMAL(12,2) DEFAULT 0,
    void_count INTEGER DEFAULT 0,
    
    is_closed BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cash_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    
    movement_type VARCHAR(50) NOT NULL, -- paid_in, paid_out, cash_drop, float_add, float_remove
    amount DECIMAL(12,2) NOT NULL,
    reason TEXT NOT NULL,
    
    created_by UUID NOT NULL REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE serialized_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

-- Tenants: Users can only see their own tenant
CREATE POLICY tenant_isolation ON tenants
    FOR ALL USING (id = current_setting('app.current_tenant_id', true)::UUID);

-- Stores: Users can only see stores in their tenant
CREATE POLICY store_isolation ON stores
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- User profiles: Users can only see users in their tenant
CREATE POLICY user_profile_isolation ON user_profiles
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Products: Users can only see products in their tenant
CREATE POLICY product_isolation ON products
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Sales: Users can only see sales in their tenant
CREATE POLICY sale_isolation ON sales
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Customers: Users can only see customers in their tenant
CREATE POLICY customer_isolation ON customers
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to all tables with updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inventory update trigger (from stock movements)
CREATE OR REPLACE FUNCTION update_inventory_from_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Update inventory quantity
    INSERT INTO inventory (tenant_id, store_id, product_id, variant_id, quantity)
    VALUES (NEW.tenant_id, NEW.store_id, NEW.product_id, NEW.variant_id, NEW.new_quantity)
    ON CONFLICT (tenant_id, store_id, product_id, variant_id)
    DO UPDATE SET 
        quantity = EXCLUDED.quantity,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER after_stock_movement_insert
    AFTER INSERT ON stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_from_movement();

-- Receipt number generator
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TRIGGER AS $$
DECLARE
    prefix TEXT;
    next_number INTEGER;
    year TEXT;
BEGIN
    year := TO_CHAR(NOW(), 'YY');
    prefix := 'RCP' || year;
    
    -- Get the next number for this tenant and year
    SELECT COALESCE(MAX(NULLIF(regexp_replace(receipt_number, '^RCP\\d{2}', ''), '')), '0')::INTEGER + 1
    INTO next_number
    FROM sales
    WHERE tenant_id = NEW.tenant_id
    AND receipt_number LIKE prefix || '%';
    
    NEW.receipt_number := prefix || LPAD(next_number::TEXT, 6, '0');
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER before_sale_insert
    BEFORE INSERT ON sales
    FOR EACH ROW
    WHEN (NEW.receipt_number IS NULL)
    EXECUTE FUNCTION generate_receipt_number();

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Products
CREATE INDEX idx_products_tenant_active ON products(tenant_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_barcode ON products(tenant_id, barcode);

-- Sales
CREATE INDEX idx_sales_tenant_created ON sales(tenant_id, created_at);
CREATE INDEX idx_sales_user ON sales(user_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_status ON sales(status);

-- Inventory
CREATE INDEX idx_inventory_tenant_store ON inventory(tenant_id, store_id);
CREATE INDEX idx_inventory_low_stock ON inventory(available_quantity, min_stock_level) 
    WHERE available_quantity <= min_stock_level;

-- Customers
CREATE INDEX idx_customers_tenant_phone ON customers(tenant_id, phone);
CREATE INDEX idx_customers_loyalty ON customers(tenant_id, loyalty_card_number);

-- Activity logs
CREATE INDEX idx_activity_logs_recent ON activity_logs(tenant_id, created_at DESC);
