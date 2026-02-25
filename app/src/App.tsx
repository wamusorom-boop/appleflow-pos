/**
 * AppleFlow POS - Main Application
 * Fixed: Proper routing, protected routes, error handling, loading states
 */

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LoginScreen } from '@/sections/LoginScreen';
import { POSLayout } from '@/sections/POSLayout';
import { useAuth } from '@/context/AuthContext';

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen message="Checking authentication..." />;
  }

  if (!isAuthenticated) {
    // Redirect to login, but save the attempted URL
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// Public Route Component (redirects to dashboard if already logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Loading..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Main App Content
function AppContent() {
  const { isLoading } = useAuth();

  // Show loading screen while checking auth
  if (isLoading) {
    return <LoadingScreen message="Initializing AppleFlow POS..." />;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <LoginScreen />
          </PublicRoute>
        } 
      />

      {/* Protected Routes */}
      <Route 
        path="/*" 
        element={
          <ProtectedRoute>
            <POSLayout />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

// Main App Component
function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppContent />
        <Toaster 
          position="top-right" 
          richColors 
          closeButton
          toastOptions={{
            duration: 4000,
          }}
        />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
