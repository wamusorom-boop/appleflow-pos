/**
 * AppleFlow POS - Main Layout
 * Professional POS interface with sidebar navigation
 */

import { useState } from 'react';
import { 
  ShoppingCart, 
  Package, 
  Receipt, 
  Users, 
  BarChart3, 
  Settings,
  LogOut,
  Menu,
  X,
  Clock,
  LayoutDashboard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { POSView } from './POSView';
import { ProductsView } from './ProductsView';
import { SalesView } from './SalesView';
import { CustomersView } from './CustomersView';
import { AnalyticsView } from './AnalyticsView';
import { SettingsView } from './SettingsView';
import { ShiftsView } from './ShiftsView';
import type { ViewType } from '@/App';

interface POSLayoutProps {
  user: any;
  onLogout: () => void;
}

const navigation: { id: ViewType; label: string; icon: React.ElementType }[] = [
  { id: 'pos', label: 'Point of Sale', icon: ShoppingCart },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'sales', label: 'Sales History', icon: Receipt },
  { id: 'shifts', label: 'Shift Mgmt', icon: Clock },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function POSLayout({ user, onLogout }: POSLayoutProps) {
  const [currentView, setCurrentView] = useState<ViewType>('pos');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const renderView = () => {
    switch (currentView) {
      case 'pos':
        return <POSView user={user} />;
      case 'products':
        return <ProductsView />;
      case 'sales':
        return <SalesView />;
      case 'shifts':
        return <ShiftsView user={user} />;
      case 'customers':
        return <CustomersView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <POSView user={user} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-slate-900 border-r border-slate-800 transition-all duration-300",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Logo & Toggle */}
        <div className="h-16 flex items-center px-4 border-b border-slate-800 justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            {sidebarOpen && (
              <span className="ml-3 font-bold text-slate-200 text-lg">AppleFlow</span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all border border-slate-700"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all",
                  isActive 
                    ? "bg-emerald-600 text-white" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && (
                  <span className="font-medium">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User & Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-800">
          <div className={cn(
            "flex items-center gap-3 px-3 py-2 mb-2 rounded-xl bg-slate-800/50",
            !sidebarOpen && "justify-center"
          )}>
            <div className="w-8 h-8 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-slate-300">
                {user.name.charAt(0)}
              </span>
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{user.name}</p>
                <Badge variant="secondary" className="text-xs bg-slate-700 text-slate-400">
                  {user.role}
                </Badge>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={onLogout}
            className={cn(
              "w-full flex items-center gap-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10",
              !sidebarOpen && "justify-center px-2"
            )}
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>Logout</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main 
        className={cn(
          "flex-1 transition-all duration-300",
          sidebarOpen ? "ml-64" : "ml-16"
        )}
      >
        {renderView()}
      </main>
    </div>
  );
}
