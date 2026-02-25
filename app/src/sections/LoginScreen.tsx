/**
 * AppleFlow POS - Login Screen
 * Fixed: Proper error handling, loading states, logo integration, form validation
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Sparkles, 
  Loader2,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';

// Demo users for quick login
const DEMO_USERS = [
  { id: '1', name: 'Admin User', email: 'admin@appleflow.pos', role: 'ADMIN' },
  { id: '2', name: 'Manager', email: 'manager@appleflow.pos', role: 'MANAGER' },
  { id: '3', name: 'Cashier', email: 'cashier@appleflow.pos', role: 'CASHIER' },
];

export function LoginScreen() {
  const { login, isLoading, error, clearError } = useAuth();
  
  // Form state
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [selectedUser, setSelectedUser] = useState<typeof DEMO_USERS[0] | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('quick');

  // Clear errors when inputs change
  useEffect(() => {
    if (error) clearError();
    if (localError) setLocalError(null);
  }, [email, pin, error, clearError]);

  // Handle user selection for quick login
  const handleSelectUser = useCallback((user: typeof DEMO_USERS[0]) => {
    setSelectedUser(user);
    setEmail(user.email);
    setPin('');
    setLocalError(null);
  }, []);

  // Handle back button
  const handleBack = useCallback(() => {
    setSelectedUser(null);
    setEmail('');
    setPin('');
    setLocalError(null);
  }, []);

  // Validate form inputs
  const validateInputs = useCallback((): string | null => {
    const loginEmail = selectedUser ? selectedUser.email : email;
    
    if (!loginEmail?.trim()) {
      return 'Please enter your email address';
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) {
      return 'Please enter a valid email address';
    }
    
    if (!pin?.trim()) {
      return 'Please enter your PIN';
    }
    
    if (!/^\d{4,6}$/.test(pin)) {
      return 'PIN must be 4-6 digits';
    }
    
    return null;
  }, [email, pin, selectedUser]);

  // Handle login submission
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setLocalError(null);
    if (error) clearError();
    
    // Validate inputs
    const validationError = validateInputs();
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    
    const loginEmail = selectedUser ? selectedUser.email : email;
    
    try {
      await login(loginEmail, pin);
      // Login successful - AuthContext will handle state update
      // App.tsx will redirect based on isAuthenticated
    } catch (err: any) {
      // Error is already handled by AuthContext
      // Just ensure local state reflects it
      setLocalError(err.message || 'Login failed');
    }
  }, [login, email, pin, selectedUser, validateInputs, error, clearError]);

  // Display error (priority: auth error > local error)
  const displayError = error || localError;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: 'rgba(16, 185, 129, 0.15)',
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Main Card */}
      <Card className="w-full max-w-md relative z-10 shadow-2xl border-0 bg-white/95 backdrop-blur-xl">
        <CardHeader className="text-center pb-6">
          {/* Logo */}
          <div className="mx-auto mb-6">
            <div className="w-28 h-28 relative">
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '8s' }}>
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" 
                    strokeDasharray="15 10" className="text-emerald-500/30" />
                </svg>
              </div>
              <div className="absolute inset-2 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }}>
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="2" 
                    strokeDasharray="10 15" className="text-emerald-500/50" />
                </svg>
              </div>
              <div className="absolute inset-4 rounded-full flex items-center justify-center shadow-lg overflow-hidden bg-white">
                <img 
                  src="/logo.png" 
                  alt="AppleFlow POS" 
                  className="w-16 h-16 object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = document.createElement('span');
                    fallback.className = 'text-4xl';
                    fallback.textContent = '🍎';
                    target.parentElement?.appendChild(fallback);
                  }}
                />
              </div>
            </div>
          </div>
          
          <CardTitle className="text-3xl font-bold text-slate-900">
            AppleFlow POS
          </CardTitle>
          <CardDescription className="text-slate-500 mt-1">
            Professional Point of Sale System
          </CardDescription>
          
          <div className="flex justify-center mt-3">
            <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-600">
              <Sparkles className="w-3 h-3 mr-1" />
              v2.0 ENTERPRISE
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          {/* Error Display */}
          {displayError && (
            <Alert variant="destructive" className="mb-4 animate-fade-in">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{displayError}</AlertDescription>
            </Alert>
          )}

          {/* Login Tabs */}
          {!selectedUser ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-100">
                <TabsTrigger value="quick" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                  Quick Login
                </TabsTrigger>
                <TabsTrigger value="email" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                  Email Login
                </TabsTrigger>
              </TabsList>

              {/* Quick Login Tab */}
              <TabsContent value="quick" className="mt-4">
                <p className="text-sm text-slate-500 text-center mb-4">
                  Select your account to continue
                </p>
                <div className="space-y-2">
                  {DEMO_USERS.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      disabled={isLoading}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 transition-all hover:scale-[1.02] hover:border-emerald-500 hover:shadow-md bg-white disabled:opacity-50"
                    >
                      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-medium">
                        {user.name.charAt(0)}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-slate-900">{user.name}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700">
                        {user.role}
                      </Badge>
                    </button>
                  ))}
                </div>
              </TabsContent>

              {/* Email Login Tab */}
              <TabsContent value="email" className="mt-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-700">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@appleflow.pos"
                        className="pl-10"
                        disabled={isLoading}
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pin" className="text-slate-700">PIN</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="pin"
                        type={showPin ? 'text' : 'password'}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="••••"
                        maxLength={6}
                        className="pl-10 pr-10"
                        disabled={isLoading}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Sign In
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          ) : (
            /* PIN Entry for Selected User */
            <form onSubmit={handleLogin} className="space-y-6 animate-fade-in">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-2xl font-bold">
                  {selectedUser.name.charAt(0)}
                </div>
                <p className="text-xl font-semibold text-slate-900">{selectedUser.name}</p>
                <p className="text-slate-500">{selectedUser.email}</p>
                <Badge className="mt-2 bg-emerald-100 text-emerald-700">
                  {selectedUser.role}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin-selected" className="text-slate-700 text-center block">
                  Enter your PIN
                </Label>
                <div className="relative max-w-xs mx-auto">
                  <Input
                    id="pin-selected"
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••"
                    maxLength={6}
                    autoFocus
                    className="text-center text-2xl tracking-[0.5em] h-14"
                    disabled={isLoading}
                  />
                </div>
                <p className="text-xs text-center text-slate-400">
                  Demo PIN: <span className="font-mono font-semibold text-emerald-600">1234</span>
                </p>
              </div>

              <div className="space-y-2">
                <Button 
                  type="submit" 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12"
                  disabled={isLoading || pin.length < 4}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5 mr-2" />
                      Sign In
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  disabled={isLoading}
                  className="w-full text-slate-500"
                >
                  Back to users
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-white/50 text-xs">
          © 2024 AppleFlow POS. All rights reserved.
        </p>
      </div>
    </div>
  );
}
