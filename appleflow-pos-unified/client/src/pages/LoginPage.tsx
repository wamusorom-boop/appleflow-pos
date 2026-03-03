/**
 * AppleFlow POS - Login Page
 * Clean, simple, no-nonsense login
 */

import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, Loader2, Mail, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Demo users for quick login
const DEMO_USERS = [
  { id: '1', name: 'Admin User', email: 'admin@appleflow.pos', role: 'ADMIN' },
  { id: '2', name: 'Manager', email: 'manager@appleflow.pos', role: 'MANAGER' },
  { id: '3', name: 'Cashier', email: 'cashier@appleflow.pos', role: 'CASHIER' },
];

export function LoginPage() {
  const { login, isLoading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [selectedUser, setSelectedUser] = useState<typeof DEMO_USERS[0] | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'quick' | 'email'>('quick');

  // Clear errors when inputs change
  useEffect(() => {
    if (error) clearError();
    if (localError) setLocalError(null);
  }, [email, pin, error, clearError]);

  const handleSelectUser = (user: typeof DEMO_USERS[0]) => {
    setSelectedUser(user);
    setEmail(user.email);
    setPin('');
    setLocalError(null);
  };

  const handleBack = () => {
    setSelectedUser(null);
    setEmail('');
    setPin('');
    setLocalError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setLocalError(null);
    if (error) clearError();

    const loginEmail = selectedUser ? selectedUser.email : email;

    // Basic validation
    if (!loginEmail?.trim()) {
      setLocalError('Please enter your email address');
      return;
    }
    if (!pin?.trim()) {
      setLocalError('Please enter your PIN');
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setLocalError('PIN must be 4-6 digits');
      return;
    }

    try {
      await login(loginEmail, pin);
      // Login successful - AuthContext handles state update
      // App.tsx will redirect based on isAuthenticated
    } catch (err: any) {
      // Error handled by AuthContext
      setLocalError(err.message || 'Login failed');
    }
  };

  const displayError = error || localError;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-emerald-500/20 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-white rounded-full flex items-center justify-center">
              <span className="text-3xl">🍎</span>
            </div>
            <h1 className="text-2xl font-bold text-white">AppleFlow POS</h1>
            <p className="text-emerald-100 text-sm mt-1">Professional Point of Sale System</p>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Error Display */}
            {displayError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{displayError}</span>
              </div>
            )}

            {/* Login Form */}
            {!selectedUser ? (
              <>
                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => setActiveTab('quick')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === 'quick'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Quick Login
                  </button>
                  <button
                    onClick={() => setActiveTab('email')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === 'email'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Email Login
                  </button>
                </div>

                {activeTab === 'quick' ? (
                  // Quick Login - User Selection
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500 text-center mb-4">
                      Select your account to continue
                    </p>
                    {DEMO_USERS.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        disabled={isLoading}
                        className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all disabled:opacity-50"
                      >
                        <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-medium">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                          {user.role}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  // Email Login Form
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="admin@appleflow.pos"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        PIN
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type={showPin ? 'text' : 'password'}
                          value={pin}
                          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="••••"
                          maxLength={6}
                          className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin(!showPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          tabIndex={-1}
                        >
                          {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          <Lock className="w-5 h-5" />
                          Sign In
                        </>
                      )}
                    </button>
                  </form>
                )}
              </>
            ) : (
              // PIN Entry for Selected User
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8" />
                  </div>
                  <p className="text-xl font-semibold text-gray-900">{selectedUser.name}</p>
                  <p className="text-gray-500">{selectedUser.email}</p>
                  <span className="inline-block mt-2 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                    {selectedUser.role}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 text-center">
                    Enter your PIN
                  </label>
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••"
                    maxLength={6}
                    autoFocus
                    className="w-full max-w-xs mx-auto block text-center text-2xl tracking-[0.5em] py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-center text-gray-400 mt-2">
                    Demo PIN: <span className="font-mono font-semibold text-emerald-600">1234</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    type="submit"
                    disabled={isLoading || pin.length < 4}
                    className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <Lock className="w-5 h-5" />
                        Sign In
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={isLoading}
                    className="w-full py-3 text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Back to users
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/50 text-sm mt-6">
          © 2024 AppleFlow POS. All rights reserved.
        </p>
      </div>
    </div>
  );
}
