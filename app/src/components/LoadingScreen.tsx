/**
 * AppleFlow POS - Loading Screen Component
 * Displays during initial load and authentication checks
 */

import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export function LoadingScreen({ 
  message = 'Loading...', 
  subMessage 
}: LoadingScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Logo */}
      <div className="mb-8 relative">
        <div className="w-20 h-20 relative">
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s' }}>
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle 
                cx="50" 
                cy="50" 
                r="45" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="3"
                strokeDasharray="20 10"
                className="text-emerald-500/40"
              />
            </svg>
          </div>
          <div className="absolute inset-2 rounded-full flex items-center justify-center bg-white shadow-lg overflow-hidden">
            <img 
              src="/logo.png" 
              alt="AppleFlow POS" 
              className="w-12 h-12 object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = document.createElement('span');
                fallback.className = 'text-3xl';
                fallback.textContent = '🍎';
                target.parentElement?.appendChild(fallback);
              }}
            />
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      <div className="flex flex-col items-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
        <p className="text-white text-lg font-medium">{message}</p>
        {subMessage && (
          <p className="text-white/60 text-sm mt-2">{subMessage}</p>
        )}
      </div>

      {/* Loading dots */}
      <div className="flex gap-2 mt-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
