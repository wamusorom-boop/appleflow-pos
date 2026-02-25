/**
 * AppleFlow POS - Main App Component
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';

import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';

// Layouts
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';

// Pages
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { SalesPage } from '@/pages/SalesPage';
import { POSPage } from '@/pages/POSPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { UsersPage } from '@/pages/UsersPage';

// Components
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoadingScreen } from '@/components/LoadingScreen';

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const { isAuthenticated, isLoading, setLoading, login, logout } = useAuthStore();

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = useAuthStore.getState().accessToken;
      
      if (token) {
        try {
          const response = await authApi.me();
          const { user } = response.data.data;
          
          // Update store with fresh user data
          useAuthStore.setState({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          // Token invalid, logout
          logout();
        }
      } else {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={
              isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
            } />
          </Route>

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/pos" element={<POSPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#22c55e',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
