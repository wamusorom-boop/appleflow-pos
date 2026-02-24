/**
 * AppleFlow POS - Theme Selector Component
 * Allows users to choose from beautiful color themes
 */

import React, { useState } from 'react';
import { useTheme, themes, ThemeName } from '@/context/ThemeContext';
import { Palette, Check, X, Droplets } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const backgroundColors = [
  { name: 'Default', value: null, color: 'transparent' },
  { name: 'Pure White', value: '#ffffff', color: '#ffffff' },
  { name: 'Soft Gray', value: '#f8fafc', color: '#f8fafc' },
  { name: 'Warm Cream', value: '#fefce8', color: '#fefce8' },
  { name: 'Cool Mint', value: '#f0fdf4', color: '#f0fdf4' },
  { name: 'Light Sky', value: '#f0f9ff', color: '#f0f9ff' },
  { name: 'Soft Lavender', value: '#faf5ff', color: '#faf5ff' },
  { name: 'Pale Rose', value: '#fdf2f8', color: '#fdf2f8' },
  { name: 'Light Peach', value: '#fff7ed', color: '#fff7ed' },
  { name: 'Soft Teal', value: '#f0fdfa', color: '#f0fdfa' },
];

export function ThemeSelector() {
  const { currentTheme, themeName, setTheme, customBackground, setCustomBackground, allThemes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'themes' | 'background'>('themes');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          style={{ 
            borderColor: currentTheme.primary,
            color: currentTheme.primary 
          }}
        >
          <Palette className="w-4 h-4" />
          <span className="hidden sm:inline">Theme</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[80vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Palette className="w-5 h-5" style={{ color: currentTheme.primary }} />
            Customize Appearance
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b px-6">
          <button
            onClick={() => setActiveTab('themes')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'themes'
                ? 'border-current'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            style={{ 
              color: activeTab === 'themes' ? currentTheme.primary : undefined,
              borderColor: activeTab === 'themes' ? currentTheme.primary : undefined 
            }}
          >
            Color Themes
          </button>
          <button
            onClick={() => setActiveTab('background')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'background'
                ? 'border-current'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            style={{ 
              color: activeTab === 'background' ? currentTheme.primary : undefined,
              borderColor: activeTab === 'background' ? currentTheme.primary : undefined 
            }}
          >
            Background
          </button>
        </div>

        <ScrollArea className="h-[400px]">
          {activeTab === 'themes' ? (
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-4">
                Choose a color theme that matches your style. All themes are designed for excellent readability.
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {(Object.keys(allThemes) as ThemeName[]).map((key) => {
                  const theme = allThemes[key];
                  const isSelected = themeName === key;
                  
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setTheme(key);
                        setIsOpen(false);
                      }}
                      className={`relative group rounded-xl p-4 transition-all hover:scale-105 ${
                        isSelected ? 'ring-2 ring-offset-2' : 'hover:shadow-lg'
                      }`}
                      style={{ 
                        background: theme.gradient,
                        ringColor: isSelected ? theme.primary : undefined 
                      }}
                    >
                      {/* Selected indicator */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md">
                          <Check className="w-3 h-3" style={{ color: theme.primary }} />
                        </div>
                      )}
                      
                      {/* Theme preview */}
                      <div className="bg-white/90 rounded-lg p-3 mb-3">
                        <div className="flex gap-1 mb-2">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ background: theme.primary }}
                          />
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ background: theme.secondary }}
                          />
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ background: theme.accent }}
                          />
                        </div>
                        <div 
                          className="h-2 rounded-full mb-1" 
                          style={{ background: theme.primary }}
                        />
                        <div 
                          className="h-2 rounded-full w-2/3" 
                          style={{ background: theme.textMuted }}
                        />
                      </div>
                      
                      {/* Theme name */}
                      <p className="text-white text-sm font-medium text-center">
                        {theme.name}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-4">
                Customize the background color of the application.
              </p>
              
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {backgroundColors.map((bg) => {
                  const isSelected = customBackground === bg.value;
                  
                  return (
                    <button
                      key={bg.name}
                      onClick={() => {
                        setCustomBackground(bg.value);
                      }}
                      className={`relative group rounded-xl p-4 border-2 transition-all hover:scale-105 ${
                        isSelected 
                          ? 'border-current shadow-lg' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      style={{ 
                        backgroundColor: bg.color,
                        borderColor: isSelected ? currentTheme.primary : undefined 
                      }}
                    >
                      {/* Selected indicator */}
                      {isSelected && (
                        <div 
                          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center shadow-md"
                          style={{ background: currentTheme.primary }}
                        >
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      
                      {/* Color preview */}
                      <div 
                        className="w-full h-12 rounded-lg border border-gray-200 mb-2"
                        style={{ backgroundColor: bg.color === 'transparent' ? '#f8fafc' : bg.color }}
                      >
                        {bg.color === 'transparent' && (
                          <div className="w-full h-full flex items-center justify-center">
                            <Droplets className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                      </div>
                      
                      {/* Background name */}
                      <p className={`text-sm font-medium text-center ${
                        bg.color === '#ffffff' ? 'text-gray-700' : 'text-gray-600'
                      }`}>
                        {bg.name}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Reset button */}
              {customBackground && (
                <div className="mt-6 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomBackground(null)}
                    className="gap-2"
                  >
                    <X className="w-4 h-4" />
                    Reset to Theme Default
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
