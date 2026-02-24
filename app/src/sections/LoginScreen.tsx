/**
 * AppleFlow POS - Login Screen
 * Beautiful authentication interface with multi-color themes
 */

import { useState, useEffect } from 'react';
import { Store, Lock, Eye, EyeOff, User, AlertCircle, Sparkles, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { ThemeSelector } from '@/components/ThemeSelector';
import { api } from '@/lib/api';

// AppleFlow Logo Component
function AppleFlowLogo({ size = 'large' }: { size?: 'small' | 'large' }) {
  const { currentTheme } = useTheme();
  const isLarge = size === 'large';
  
  return (
    <div className={`relative ${isLarge ? 'w-24 h-24' : 'w-12 h-12'}`}>
      {/* Outer spinning ring */}
      <div className="absolute inset-0 animate-spin" style={{ animationDuration: '8s' }}>
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={currentTheme.primary}
            strokeWidth="2"
            strokeDasharray="15 10"
            opacity="0.5"
          />
        </svg>
      </div>
      
      {/* Inner ring */}
      <div className="absolute inset-2 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }}>
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={currentTheme.secondary}
            strokeWidth="2"
            strokeDasharray="10 15"
            opacity="0.7"
          />
        </svg>
      </div>
      
      {/* Center logo */}
      <div 
        className={`absolute inset-4 rounded-full flex items-center justify-center shadow-lg ${isLarge ? 'text-4xl' : 'text-xl'}`}
        style={{ 
          background: `linear-gradient(135deg, ${currentTheme.primary}, ${currentTheme.secondary})`,
        }}
      >
        <span>🍎</span>
      </div>
    </div>
  );
}

export function LoginScreen() {
  const { login } = useAuth();
  const { currentTheme } = useTheme();
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<any>(null);
  const [showLicenseInput, setShowLicenseInput] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');

  useEffect(() => {
    loadUsers();
    checkLicense();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await api.auth.getUsers?.() || { data: [] };
      setUsers(response.data || []);
    } catch (err) {
      // Fallback to demo users if API fails
      setUsers([
        { id: '1', name: 'Admin User', email: 'admin@appleflow.pos', role: 'ADMIN' },
        { id: '2', name: 'Manager', email: 'manager@appleflow.pos', role: 'MANAGER' },
        { id: '3', name: 'Cashier', email: 'cashier@appleflow.pos', role: 'CASHIER' },
      ]);
    }
  };

  const checkLicense = async () => {
    try {
      const response = await api.license?.verify();
      setLicenseStatus(response?.data);
    } catch (err) {
      // License check failed, will show activation
    }
  };

  const activateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.license?.activate(licenseKey, 'Demo User', 'demo@appleflow.pos');
      setShowLicenseInput(false);
      await checkLicense();
    } catch (err: any) {
      setError(err.message || 'Failed to activate license');
    }
    setIsLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const loginEmail = selectedUser ? selectedUser.email : email;
    
    try {
      await login(loginEmail, pin);
    } catch (err) {
      setError('Invalid PIN. Please try again.');
    }

    setIsLoading(false);
  };

  const handleSelectUser = (user: any) => {
    setSelectedUser(user);
    setEmail(user.email);
    setPin('');
    setError(null);
  };

  const handleBack = () => {
    setSelectedUser(null);
    setEmail('');
    setPin('');
    setError(null);
  };

  // Check if license needs activation
  const needsLicense = !licenseStatus?.valid && !showLicenseInput;

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 transition-colors duration-500"
      style={{ background: currentTheme.gradient }}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: 'rgba(255,255,255,0.15)',
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Theme selector - top right */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeSelector />
      </div>

      <Card 
        className="w-full max-w-md relative z-10 shadow-2xl border-0"
        style={{ 
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <CardHeader className="text-center pb-6">
          {/* Logo */}
          <div className="mx-auto mb-6">
            <AppleFlowLogo size="large" />
          </div>
          
          <CardTitle 
            className="text-3xl font-bold"
            style={{ color: currentTheme.textPrimary }}
          >
            AppleFlow POS
          </CardTitle>
          <CardDescription style={{ color: currentTheme.textSecondary }}>
            Professional Point of Sale System
          </CardDescription>
          
          {/* Version badge */}
          <div className="flex justify-center mt-3">
            <Badge 
              variant="outline" 
              className="text-xs"
              style={{ borderColor: currentTheme.primary, color: currentTheme.primary }}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              v2.0 ULTIMATE
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert 
              variant="destructive" 
              className="mb-4"
              style={{ background: `${currentTheme.error}15`, borderColor: `${currentTheme.error}40` }}
            >
              <AlertCircle className="h-4 w-4" style={{ color: currentTheme.error }} />
              <AlertDescription style={{ color: currentTheme.error }}>{error}</AlertDescription>
            </Alert>
          )}

          {/* License Activation */}
          {showLicenseInput ? (
            <form onSubmit={activateLicense} className="space-y-4">
              <div className="text-center mb-4">
                <Settings className="w-12 h-12 mx-auto mb-2" style={{ color: currentTheme.primary }} />
                <p className="font-medium" style={{ color: currentTheme.textPrimary }}>
                  Activate License
                </p>
                <p className="text-sm" style={{ color: currentTheme.textSecondary }}>
                  Enter your license key to continue
                </p>
              </div>
              
              <div className="space-y-2">
                <Label style={{ color: currentTheme.textPrimary }}>License Key</Label>
                <Input
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                  placeholder="AFP-XXXXXXXX-XXXXXXXX-XXXX"
                  className="text-center font-mono tracking-wider"
                  style={{ 
                    borderColor: currentTheme.border,
                    color: currentTheme.textPrimary 
                  }}
                  required
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading}
                style={{ 
                  background: currentTheme.gradient,
                  color: 'white' 
                }}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Activate'
                )}
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setShowLicenseInput(false)}
              >
                Cancel
              </Button>
            </form>
          ) : needsLicense ? (
            <div className="text-center space-y-4">
              <div 
                className="p-6 rounded-xl"
                style={{ background: currentTheme.background }}
              >
                <Sparkles className="w-12 h-12 mx-auto mb-3" style={{ color: currentTheme.primary }} />
                <p className="font-medium mb-2" style={{ color: currentTheme.textPrimary }}>
                  Welcome to AppleFlow POS
                </p>
                <p className="text-sm mb-4" style={{ color: currentTheme.textSecondary }}>
                  This software requires a valid license key. Please activate to continue.
                </p>
                <Button
                  onClick={() => setShowLicenseInput(true)}
                  style={{ 
                    background: currentTheme.gradient,
                    color: 'white' 
                  }}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Activate License
                </Button>
              </div>
              
              <p className="text-xs" style={{ color: currentTheme.textMuted }}>
                Contact your administrator for a license key
              </p>
            </div>
          ) : !selectedUser ? (
            <Tabs defaultValue="quick" className="w-full">
              <TabsList 
                className="grid w-full grid-cols-2"
                style={{ background: currentTheme.background }}
              >
                <TabsTrigger 
                  value="quick" 
                  className="data-[state=active]:text-white"
                  style={{ 
                    ['--tw-bg-opacity' as string]: '1',
                  }}
                >
                  Quick Login
                </TabsTrigger>
                <TabsTrigger 
                  value="email"
                  className="data-[state=active]:text-white"
                >
                  Email Login
                </TabsTrigger>
              </TabsList>

              <TabsContent value="quick" className="mt-4">
                <p 
                  className="text-sm text-center mb-4"
                  style={{ color: currentTheme.textSecondary }}
                >
                  Select your account to continue
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="flex items-center gap-4 p-4 rounded-xl border-2 transition-all hover:scale-[1.02] group"
                      style={{ 
                        borderColor: currentTheme.border,
                        background: currentTheme.background 
                      }}
                    >
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
                        style={{ background: currentTheme.gradient }}
                      >
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium" style={{ color: currentTheme.textPrimary }}>
                          {user.name}
                        </p>
                        <p className="text-sm" style={{ color: currentTheme.textSecondary }}>
                          {user.email}
                        </p>
                      </div>
                      <Badge 
                        style={{ 
                          background: user.role === 'ADMIN' ? currentTheme.primary : currentTheme.secondary,
                          color: 'white' 
                        }}
                      >
                        {user.role}
                      </Badge>
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="email" className="mt-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label style={{ color: currentTheme.textPrimary }}>Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@appleflow.pos"
                      style={{ 
                        borderColor: currentTheme.border,
                        color: currentTheme.textPrimary,
                        background: currentTheme.background 
                      }}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label style={{ color: currentTheme.textPrimary }}>PIN</Label>
                    <div className="relative">
                      <Input
                        id="pin"
                        type={showPin ? 'text' : 'password'}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••"
                        maxLength={4}
                        className="pr-10"
                        style={{ 
                          borderColor: currentTheme.border,
                          color: currentTheme.textPrimary,
                          background: currentTheme.background 
                        }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: currentTheme.textMuted }}
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full text-white"
                    disabled={isLoading}
                    style={{ background: currentTheme.gradient }}
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Login
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          ) : (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="text-center">
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: currentTheme.gradient }}
                >
                  <User className="w-10 h-10 text-white" />
                </div>
                <p className="text-xl font-semibold" style={{ color: currentTheme.textPrimary }}>
                  {selectedUser.name}
                </p>
                <p style={{ color: currentTheme.textSecondary }}>{selectedUser.email}</p>
                <Badge 
                  className="mt-2"
                  style={{ background: currentTheme.primary, color: 'white' }}
                >
                  {selectedUser.role}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label style={{ color: currentTheme.textPrimary }}>Enter PIN</Label>
                <div className="relative">
                  <Input
                    id="pin"
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    maxLength={4}
                    autoFocus
                    className="text-center text-2xl tracking-widest h-14 pr-10"
                    style={{ 
                      borderColor: currentTheme.border,
                      color: currentTheme.textPrimary,
                      background: currentTheme.background 
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: currentTheme.textMuted }}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Button 
                  type="submit" 
                  className="w-full h-12 text-white"
                  disabled={isLoading || pin.length !== 4}
                  style={{ background: currentTheme.gradient }}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Lock className="w-5 h-5 mr-2" />
                      Login
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={handleBack}
                  style={{ color: currentTheme.textSecondary }}
                >
                  Back to users
                </Button>
              </div>
            </form>
          )}

          {!selectedUser && !showLicenseInput && !needsLicense && (
            <div 
              className="mt-6 pt-4 border-t text-center"
              style={{ borderColor: currentTheme.border }}
            >
              <p className="text-xs" style={{ color: currentTheme.textMuted }}>
                Demo PIN: <span className="font-mono font-bold" style={{ color: currentTheme.primary }}>1234</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-white/60 text-xs">
          © 2024 AppleFlow POS. All rights reserved.
        </p>
      </div>
    </div>
  );
}
