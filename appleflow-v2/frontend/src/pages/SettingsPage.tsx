import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Store,
  Receipt,
  Bell,
  Shield,
  CreditCard,
  Printer,
  Users,
  Save,
  CheckCircle,
  AlertTriangle,
  Building2,
  Mail,
  Phone,
  MapPin,
  Percent,
  DollarSign,
} from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useAuthStore } from '../store/authStore';

interface StoreSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  tax_number: string;
  receipt_header: string;
  receipt_footer: string;
  default_tax_rate: number;
  currency: string;
  timezone: string;
}

interface NotificationSettings {
  low_stock_alert: boolean;
  daily_summary: boolean;
  new_sale_notification: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
}

const currencies = [
  { code: 'KES', name: 'Kenyan Shilling (KES)' },
  { code: 'USD', name: 'US Dollar (USD)' },
  { code: 'EUR', name: 'Euro (EUR)' },
  { code: 'GBP', name: 'British Pound (GBP)' },
  { code: 'UGX', name: 'Ugandan Shilling (UGX)' },
  { code: 'TZS', name: 'Tanzanian Shilling (TZS)' },
];

const timezones = [
  { value: 'Africa/Nairobi', label: 'Nairobi (EAT)' },
  { value: 'Africa/Kampala', label: 'Kampala (EAT)' },
  { value: 'Africa/Dar_es_Salaam', label: 'Dar es Salaam (EAT)' },
  { value: 'UTC', label: 'UTC' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'receipt' | 'notifications' | 'payment'>('general');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data;
    },
  });

  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    name: '',
    address: '',
    phone: '',
    email: '',
    tax_number: '',
    receipt_header: '',
    receipt_footer: '',
    default_tax_rate: 16,
    currency: 'KES',
    timezone: 'Africa/Nairobi',
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    low_stock_alert: true,
    daily_summary: true,
    new_sale_notification: false,
    email_notifications: true,
    sms_notifications: false,
  });

  // Update local state when settings load
  useState(() => {
    if (settings?.store) {
      setStoreSettings(settings.store);
    }
    if (settings?.notifications) {
      setNotificationSettings(settings.notifications);
    }
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.put('/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const handleSaveStore = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ store: storeSettings });
  };

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ notifications: notificationSettings });
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'receipt', label: 'Receipt', icon: Receipt },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'payment', label: 'Payment', icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1">Manage your store preferences</p>
        </div>
        {saveSuccess && (
          <Badge variant="success" className="flex items-center gap-1 w-fit">
            <CheckCircle className="w-3 h-3" />
            Saved successfully
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <Card className="p-6">
          <form onSubmit={handleSaveStore} className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Store className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Store Information</h3>
                <p className="text-sm text-gray-500">Basic details about your business</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Store Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={storeSettings.name}
                  onChange={(e) => setStoreSettings({ ...storeSettings, name: e.target.value })}
                  placeholder="Your store name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <Input
                  type="email"
                  value={storeSettings.email}
                  onChange={(e) => setStoreSettings({ ...storeSettings, email: e.target.value })}
                  placeholder="store@example.com"
                  leftIcon={<Mail className="w-4 h-4" />}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <Input
                  value={storeSettings.phone}
                  onChange={(e) => setStoreSettings({ ...storeSettings, phone: e.target.value })}
                  placeholder="+254 700 000 000"
                  leftIcon={<Phone className="w-4 h-4" />}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax Number</label>
                <Input
                  value={storeSettings.tax_number}
                  onChange={(e) => setStoreSettings({ ...storeSettings, tax_number: e.target.value })}
                  placeholder="PIN/Tax ID"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <Input
                  value={storeSettings.address}
                  onChange={(e) => setStoreSettings({ ...storeSettings, address: e.target.value })}
                  placeholder="Full address"
                  leftIcon={<MapPin className="w-4 h-4" />}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={storeSettings.currency}
                  onChange={(e) => setStoreSettings({ ...storeSettings, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <select
                  value={storeSettings.timezone}
                  onChange={(e) => setStoreSettings({ ...storeSettings, timezone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {timezones.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Tax Rate (%)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={storeSettings.default_tax_rate}
                  onChange={(e) => setStoreSettings({ ...storeSettings, default_tax_rate: parseFloat(e.target.value) })}
                  leftIcon={<Percent className="w-4 h-4" />}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200">
              <Button
                type="submit"
                isLoading={saveMutation.isPending}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Receipt Settings */}
      {activeTab === 'receipt' && (
        <Card className="p-6">
          <form onSubmit={handleSaveStore} className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Receipt className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Receipt Settings</h3>
                <p className="text-sm text-gray-500">Customize your receipt template</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Receipt Header
                </label>
                <textarea
                  value={storeSettings.receipt_header}
                  onChange={(e) => setStoreSettings({ ...storeSettings, receipt_header: e.target.value })}
                  placeholder="Text to appear at the top of receipts"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will appear at the top of every receipt
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Receipt Footer
                </label>
                <textarea
                  value={storeSettings.receipt_footer}
                  onChange={(e) => setStoreSettings({ ...storeSettings, receipt_footer: e.target.value })}
                  placeholder="Text to appear at the bottom of receipts"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Common: Thank you message, return policy, social media
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200">
              <Button
                type="submit"
                isLoading={saveMutation.isPending}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Notification Settings */}
      {activeTab === 'notifications' && (
        <Card className="p-6">
          <form onSubmit={handleSaveNotifications} className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Bell className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Notification Preferences</h3>
                <p className="text-sm text-gray-500">Choose what notifications you receive</p>
              </div>
            </div>

            <div className="space-y-4">
              {[
                { key: 'low_stock_alert', label: 'Low Stock Alerts', description: 'Get notified when products run low' },
                { key: 'daily_summary', label: 'Daily Summary', description: 'Receive daily sales summary' },
                { key: 'new_sale_notification', label: 'New Sale Notifications', description: 'Real-time alerts for each sale' },
                { key: 'email_notifications', label: 'Email Notifications', description: 'Send notifications via email' },
                { key: 'sms_notifications', label: 'SMS Notifications', description: 'Send critical alerts via SMS' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{item.label}</p>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings[item.key as keyof NotificationSettings]}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        [item.key]: e.target.checked,
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200">
              <Button
                type="submit"
                isLoading={saveMutation.isPending}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Payment Settings */}
      {activeTab === 'payment' && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <CreditCard className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Payment Methods</h3>
              <p className="text-sm text-gray-500">Configure accepted payment methods</p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { id: 'cash', name: 'Cash', description: 'Accept cash payments', enabled: true },
              { id: 'card', name: 'Card Payment', description: 'Credit/Debit card payments', enabled: true },
              { id: 'mpesa', name: 'M-Pesa', description: 'Mobile money payments', enabled: true },
              { id: 'bank_transfer', name: 'Bank Transfer', description: 'Direct bank transfers', enabled: false },
            ].map((method) => (
              <div key={method.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${method.enabled ? 'bg-green-100' : 'bg-gray-200'}`}>
                    <DollarSign className={`w-5 h-5 ${method.enabled ? 'text-green-600' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{method.name}</p>
                    <p className="text-sm text-gray-500">{method.description}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={method.enabled}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Payment Integration</p>
                <p className="text-sm text-blue-700 mt-1">
                  To enable M-Pesa or Card payments, you need to configure your payment gateway credentials in the integration settings.
                </p>
                <Button variant="outline" size="sm" className="mt-3">
                  Configure Integrations
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
