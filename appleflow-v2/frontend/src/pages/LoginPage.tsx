/**
 * AppleFlow POS - Login Page
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !pin) {
      toast.error('Please enter email and PIN');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authApi.login(email, pin);
      const { user, tokens } = response.data.data;
      
      login(user, tokens.accessToken, tokens.refreshToken);
      toast.success('Welcome back!');
      navigate('/');
    } catch (error: any) {
      const message = error.response?.data?.error || 'Login failed';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="relative w-24 h-24 mx-auto mb-6">
          {/* Animated rings */}
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '8s' }}>
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="2"
                strokeDasharray="15 10"
              />
            </svg>
          </div>
          
          <div className="absolute inset-2 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }}>
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="2"
                strokeDasharray="10 15"
              />
            </svg>
          </div>
          
          <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center shadow-lg">
            <span className="text-4xl">🍎</span>
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-2">AppleFlow POS</h1>
        <p className="text-white/70">Sign in to your account</p>
      </div>

      {/* Login form */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              disabled={isLoading}
            />
          </div>

          {/* PIN */}
          <div>
            <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-2">
              PIN Code
            </label>
            <div className="relative">
              <input
                id="pin"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g '').slice(0, 4))}
                placeholder="••••"
                maxLength={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-center text-2xl tracking-widest"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPin ? '🙈' : '👁️'}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 text-center">
              Enter your 4-digit PIN
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || pin.length !== 4}
            className="w-full py-3 px-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-lg hover:from-primary-600 hover:to-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Demo hint */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Demo credentials:<br />
            Email: <span className="font-mono font-medium">admin@appleflow.pos</span><br />
            PIN: <span className="font-mono font-medium">1234</span>
          </p>
        </div>
      </div>

      {/* Version */}
      <p className="mt-6 text-center text-white/50 text-sm">
        Version 2.0.0
      </p>
    </div>
  );
}
