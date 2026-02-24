/**
 * AppleFlow POS - Main Application
 * Ultimate Edition with splash screen, themes, and full API integration
 */

import { useState } from 'react';
import { LoginScreen } from './sections/LoginScreen';
import { POSLayout } from './sections/POSLayout';
import { SplashScreen } from './components/SplashScreen';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { useRealtimeSales, useRealtimeInventory, useSystemMessages } from '@/hooks/useWebSocket';

export type ViewType = 'pos' | 'products' | 'sales' | 'shifts' | 'customers' | 'analytics' | 'settings' | 'inventory' | 'reports' | 'license';

function AppContent() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  // Real-time updates
  useRealtimeSales(
    (sale) => {
      toast.success(`New sale: ${sale.receiptNumber}`, {
        description: `KSh ${sale.total.toLocaleString()}`,
      });
    },
    (sale) => {
      toast.info(`Sale voided: ${sale.receiptNumber}`);
    }
  );

  useRealtimeInventory(
    (data) => {
      if (data.lowStock) {
        toast.warning(`Low stock alert: Product ${data.productId}`, {
          description: `Current quantity: ${data.quantity}`,
        });
      }
    },
    (product) => {
      toast.error(`Critical low stock: ${product.productName}`, {
        description: `Only ${product.currentStock} remaining (min: ${product.minStockLevel})`,
      });
    }
  );

  useSystemMessages((message) => {
    switch (message.type) {
      case 'warning':
        toast.warning(message.message);
        break;
      case 'error':
        toast.error(message.message);
        break;
      default:
        toast.info(message.message);
    }
  });

  // Handle logout with confirmation
  const handleLogout = async () => {
    const confirmed = window.confirm('Are you sure you want to logout?');
    if (confirmed) {
      await logout();
      toast.info('Logged out successfully');
    }
  };

  // Show splash screen first
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} minDuration={2500} />;
  }

  if (isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)' }}
      >
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/80">Loading AppleFlow POS...</p>
          <p className="text-white/60 text-sm mt-2">Connecting to server...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen />
        <Toaster position="top-right" richColors />
      </>
    );
  }

  return (
    <>
      <POSLayout user={user} onLogout={handleLogout} />
      <Toaster position="top-right" richColors />
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
