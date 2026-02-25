/**
 * AppleFlow POS - Supabase Client
 * Database and Auth client configuration
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  logger.error('Missing Supabase environment variables');
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

// Create Supabase client with service role (for backend operations)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Create a client for user operations (with JWT)
export function createUserClient(jwt: string) {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  });
}

// Helper to set tenant context for RLS
export async function setTenantContext(tenantId: string) {
  const { error } = await supabase.rpc('set_tenant_context', {
    tenant_id: tenantId,
  });
  
  if (error) {
    logger.error('Failed to set tenant context', { error, tenantId });
    throw error;
  }
}

// Database types (will be generated from schema)
export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          email: string;
          status: string;
          subscription_status: string;
          subscription_tier: string;
          subscription_expires_at: string | null;
          max_users: number;
          max_stores: number;
          max_products: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>;
      };
      user_profiles: {
        Row: {
          id: string;
          tenant_id: string;
          store_id: string | null;
          first_name: string;
          last_name: string;
          full_name: string;
          email: string;
          phone: string | null;
          avatar_url: string | null;
          role: string;
          permissions: Record<string, unknown>;
          pin_hash: string | null;
          is_active: boolean;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'full_name' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>;
      };
      products: {
        Row: {
          id: string;
          tenant_id: string;
          store_id: string | null;
          sku: string;
          name: string;
          description: string | null;
          barcode: string | null;
          cost_price: number;
          selling_price: number;
          tax_rate: number;
          is_active: boolean;
          category_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
      };
      sales: {
        Row: {
          id: string;
          tenant_id: string;
          store_id: string;
          receipt_number: string;
          subtotal: number;
          discount_total: number;
          tax_total: number;
          total: number;
          status: string;
          customer_id: string | null;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['sales']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['sales']['Insert']>;
      };
      customers: {
        Row: {
          id: string;
          tenant_id: string;
          first_name: string | null;
          last_name: string | null;
          full_name: string;
          email: string | null;
          phone: string | null;
          loyalty_points: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'full_name' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
    };
  };
};
