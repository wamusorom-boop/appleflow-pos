/**
 * AppleFlow POS - Mechanical Splash Screen
 * Beautiful animated splash with mechanical/industrial design
 */

import { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
}

export function SplashScreen({ onComplete, minDuration = 3000 }: SplashScreenProps) {
  const { currentTheme } = useTheme();
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initializing...');
  const [isExiting, setIsExiting] = useState(false);

  const statusMessages = [
    'Initializing core systems...',
    'Loading inventory module...',
    'Connecting to database...',
    'Syncing product catalog...',
    'Loading payment gateways...',
    'Verifying license...',
    'Preparing user interface...',
    'Ready to launch!',
  ];

  useEffect(() => {
    let startTime = Date.now();
    let animationFrame: number;
    let messageIndex = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / minDuration) * 100, 100);
      
      setProgress(newProgress);
      
      // Update status message based on progress
      const newMessageIndex = Math.floor((newProgress / 100) * statusMessages.length);
      if (newMessageIndex !== messageIndex && newMessageIndex < statusMessages.length) {
        messageIndex = newMessageIndex;
        setStatusText(statusMessages[messageIndex]);
      }

      if (newProgress < 100) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setStatusText('Ready!');
        setTimeout(() => {
          setIsExiting(true);
          setTimeout(onComplete, 500);
        }, 300);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [minDuration, onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500 ${
        isExiting ? 'opacity-0 scale-110' : 'opacity-100 scale-100'
      }`}
      style={{ background: currentTheme.gradient }}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white/10 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Main content container */}
      <div className="relative z-10 text-center">
        {/* Logo Container with mechanical styling */}
        <div className="relative mb-8">
          {/* Outer ring - spinning */}
          <div className="absolute inset-0 w-40 h-40 mx-auto">
            <svg className="w-full h-full animate-spin" style={{ animationDuration: '8s' }} viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1"
                strokeDasharray="10 5"
              />
            </svg>
          </div>

          {/* Middle ring - counter spinning */}
          <div className="absolute inset-0 w-32 h-32 mx-auto mt-4">
            <svg className="w-full h-full animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }} viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="2"
                strokeDasharray="20 10"
              />
            </svg>
          </div>

          {/* Inner gear */}
          <div className="relative w-24 h-24 mx-auto">
            <svg className="w-full h-full animate-spin" style={{ animationDuration: '4s' }} viewBox="0 0 100 100">
              {/* Gear teeth */}
              {[...Array(12)].map((_, i) => (
                <rect
                  key={i}
                  x="45"
                  y="5"
                  width="10"
                  height="15"
                  fill="white"
                  transform={`rotate(${i * 30} 50 50)`}
                />
              ))}
              {/* Inner circle */}
              <circle cx="50" cy="50" r="25" fill="white" />
              {/* Apple icon in center */}
              <text x="50" y="58" textAnchor="middle" fontSize="28" fill={currentTheme.primary}>
                🍎
              </text>
            </svg>
          </div>

          {/* Orbiting dots */}
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 bg-white rounded-full"
              style={{
                top: '50%',
                left: '50%',
                transform: `rotate(${i * 120 + (progress * 3.6)}deg) translateX(70px) translateY(-50%)`,
                transition: 'transform 0.1s linear',
              }}
            />
          ))}
        </div>

        {/* Brand name */}
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-wider">
          APPLEFLOW
        </h1>
        <p className="text-white/80 text-lg tracking-widest uppercase mb-8">
          Point of Sale System
        </p>

        {/* Progress bar container */}
        <div className="w-80 mx-auto">
          {/* Progress bar background */}
          <div className="h-3 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
            {/* Progress fill */}
            <div
              className="h-full bg-white rounded-full transition-all duration-100 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
            </div>
          </div>

          {/* Progress text */}
          <div className="flex justify-between items-center mt-3">
            <span className="text-white/70 text-sm font-mono">{statusText}</span>
            <span className="text-white font-mono text-sm">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Version badge */}
        <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-white/70 text-xs font-mono">v2.0.0 ULTIMATE</span>
        </div>

        {/* Loading indicators */}
        <div className="flex justify-center gap-2 mt-6">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 bg-white/40 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>

      {/* Corner decorations */}
      <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-white/20 rounded-tl-lg" />
      <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-white/20 rounded-tr-lg" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-white/20 rounded-bl-lg" />
      <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-white/20 rounded-br-lg" />

      {/* Bottom text */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-white/50 text-xs">
          Powered by AppleFlow Technologies
        </p>
      </div>

      {/* CSS for shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
}
