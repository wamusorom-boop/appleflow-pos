/**
 * AppleFlow POS - Loading Screen
 * Full-screen loading indicator
 */

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700">
      <div className="relative">
        {/* Animated rings */}
        <div className="absolute inset-0 w-24 h-24 animate-spin" style={{ animationDuration: '8s' }}>
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
        
        <div className="absolute inset-0 w-20 h-20 m-2 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }}>
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
        
        {/* Center logo */}
        <div className="relative w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
          <span className="text-3xl">🍎</span>
        </div>
      </div>
      
      <h1 className="mt-8 text-2xl font-bold text-white">AppleFlow POS</h1>
      <p className="mt-2 text-white/70">Loading...</p>
      
      {/* Loading dots */}
      <div className="flex gap-2 mt-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-white/60 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
