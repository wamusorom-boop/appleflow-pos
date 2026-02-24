/**
 * AppleFlow POS - Advanced Settings View
 * Business settings, backup/restore, audit logs, and configuration
 */

import { useState, useEffect } from 'react';
import { 
  Store, Save, User, Download, Upload, Database, 
  Shield, History, Trash2, AlertTriangle, FileText, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  getBusiness, saveSettings, getSettings, getAuditLogs, 
  downloadBackup, importData, formatDateTime, DEMO_BUSINESS, addAuditLog
} from '@/lib/data';

export function SettingsView() {
  const [business, setBusiness] = useState<any>(DEMO_BUSINESS);
  const [settings, setSettings] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('business');
  const [importText, setImportText] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

  useEffect(() => {
    const saved = getBusiness();
    if (saved) setBusiness(saved);
    setSettings(getSettings());
    setAuditLogs(getAuditLogs().slice(0, 100));
  }, []);

  const handleSaveBusiness = () => {
    localStorage.setItem('appleflow-business', JSON.stringify(business));
    addAuditLog('product_updated', 'business', 'settings', 'Business settings updated');
    toast.success('Business settings saved');
  };

  const handleSaveSettings = () => {
    saveSettings(settings);
    addAuditLog('product_updated', 'settings', 'app', 'App settings updated');
    toast.success('App settings saved');
  };

  const handleBackup = () => {
    downloadBackup();
    toast.success('Backup downloaded');
  };

  const handleImport = () => {
    if (!importText.trim()) {
      toast.error('Please paste backup data');
      return;
    }
    
    if (importData(importText)) {
      toast.success('Data imported successfully');
      setShowImportDialog(false);
      setImportText('');
      window.location.reload();
    } else {
      toast.error('Invalid backup data');
    }
  };

  const handleClearAll = () => {
    localStorage.clear();
    toast.success('All data cleared');
    setShowClearDialog(false);
    window.location.reload();
  };

  const getActionIcon = (action: string) => {
    if (action.includes('sale')) return <FileText className="w-4 h-4" />;
    if (action.includes('product')) return <Database className="w-4 h-4" />;
    if (action.includes('user')) return <User className="w-4 h-4" />;
    if (action.includes('shift')) return <History className="w-4 h-4" />;
    return <RefreshCw className="w-4 h-4" />;
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-auto">
      {/* Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center px-6">
        <h1 className="text-xl font-bold text-slate-200">Settings</h1>
      </header>

      <div className="p-6 max-w-5xl mx-auto w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-900 border border-slate-800 mb-6 flex-wrap h-auto">
            <TabsTrigger value="business" className="data-[state=active]:bg-emerald-600">
              <Store className="w-4 h-4 mr-2" />
              Business
            </TabsTrigger>
            <TabsTrigger value="system" className="data-[state=active]:bg-emerald-600">
              <Shield className="w-4 h-4 mr-2" />
              System
            </TabsTrigger>
            <TabsTrigger value="backup" className="data-[state=active]:bg-emerald-600">
              <Database className="w-4 h-4 mr-2" />
              Backup
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-emerald-600">
              <History className="w-4 h-4 mr-2" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          {/* Business Settings */}
          <TabsContent value="business" className="space-y-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                  <Store className="w-5 h-5 text-emerald-400" />
                  Business Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">Business Name</label>
                    <Input
                      value={business.name}
                      onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">Legal Name</label>
                    <Input
                      value={business.legalName}
                      onChange={(e) => setBusiness({ ...business, legalName: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-slate-400 mb-1 block">KRA PIN</label>
                  <Input
                    value={business.kraPin}
                    onChange={(e) => setBusiness({ ...business, kraPin: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-slate-200"
                  />
                  <p className="text-xs text-slate-500 mt-1">Required for tax-compliant receipts</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">Phone</label>
                    <Input
                      value={business.phone}
                      onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">Email</label>
                    <Input
                      value={business.email}
                      onChange={(e) => setBusiness({ ...business, email: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Address</label>
                  <Input
                    value={business.address}
                    onChange={(e) => setBusiness({ ...business, address: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-slate-200"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-400 mb-1 block">City</label>
                  <Input
                    value={business.city}
                    onChange={(e) => setBusiness({ ...business, city: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-slate-200"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Receipt Footer</label>
                  <textarea
                    value={business.receiptFooter}
                    onChange={(e) => setBusiness({ ...business, receiptFooter: e.target.value })}
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm"
                  />
                </div>

                <Button onClick={handleSaveBusiness} className="bg-emerald-600 hover:bg-emerald-700">
                  <Save className="w-4 h-4 mr-2" />
                  Save Business Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Settings */}
          <TabsContent value="system" className="space-y-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-400" />
                  System Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings && (
                  <>
                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-200">Require Shift to Sell</p>
                        <p className="text-xs text-slate-500">Cashiers must open a shift before making sales</p>
                      </div>
                      <button
                        onClick={() => setSettings({ ...settings, requireShiftToSell: !settings.requireShiftToSell })}
                        className={`w-12 h-6 rounded-full transition-colors ${settings.requireShiftToSell ? 'bg-emerald-600' : 'bg-slate-700'}`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings.requireShiftToSell ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-200">Allow Negative Inventory</p>
                        <p className="text-xs text-slate-500">Allow selling products with zero or negative stock</p>
                      </div>
                      <button
                        onClick={() => setSettings({ ...settings, allowNegativeInventory: !settings.allowNegativeInventory })}
                        className={`w-12 h-6 rounded-full transition-colors ${settings.allowNegativeInventory ? 'bg-emerald-600' : 'bg-slate-700'}`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings.allowNegativeInventory ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-200">Auto-Print Receipt</p>
                        <p className="text-xs text-slate-500">Automatically print receipt after each sale</p>
                      </div>
                      <button
                        onClick={() => setSettings({ ...settings, autoPrintReceipt: !settings.autoPrintReceipt })}
                        className={`w-12 h-6 rounded-full transition-colors ${settings.autoPrintReceipt ? 'bg-emerald-600' : 'bg-slate-700'}`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings.autoPrintReceipt ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-200">Barcode Scanner</p>
                        <p className="text-xs text-slate-500">Enable barcode scanner support</p>
                      </div>
                      <button
                        onClick={() => setSettings({ ...settings, barcodeScannerEnabled: !settings.barcodeScannerEnabled })}
                        className={`w-12 h-6 rounded-full transition-colors ${settings.barcodeScannerEnabled ? 'bg-emerald-600' : 'bg-slate-700'}`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings.barcodeScannerEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-200">Weight Scale</p>
                        <p className="text-xs text-slate-500">Enable weight scale for weighted products</p>
                      </div>
                      <button
                        onClick={() => setSettings({ ...settings, weightScaleEnabled: !settings.weightScaleEnabled })}
                        className={`w-12 h-6 rounded-full transition-colors ${settings.weightScaleEnabled ? 'bg-emerald-600' : 'bg-slate-700'}`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings.weightScaleEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                    </div>

                    <Button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700">
                      <Save className="w-4 h-4 mr-2" />
                      Save System Settings
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Backup & Restore */}
          <TabsContent value="backup" className="space-y-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-400" />
                  Backup & Restore
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-6 text-center">
                    <Download className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
                    <h3 className="font-medium text-slate-200 mb-2">Export Data</h3>
                    <p className="text-sm text-slate-500 mb-4">
                      Download a complete backup of all your data
                    </p>
                    <Button onClick={handleBackup} className="bg-emerald-600 hover:bg-emerald-700">
                      <Download className="w-4 h-4 mr-2" />
                      Download Backup
                    </Button>
                  </div>

                  <div className="bg-slate-800/50 rounded-lg p-6 text-center">
                    <Upload className="w-10 h-10 text-blue-400 mx-auto mb-4" />
                    <h3 className="font-medium text-slate-200 mb-2">Import Data</h3>
                    <p className="text-sm text-slate-500 mb-4">
                      Restore from a previous backup file
                    </p>
                    <Button onClick={() => setShowImportDialog(true)} variant="outline" className="border-blue-600 text-blue-400">
                      <Upload className="w-4 h-4 mr-2" />
                      Import Data
                    </Button>
                  </div>
                </div>

                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                    <h3 className="font-medium text-red-400">Danger Zone</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-4">
                    Clearing all data will permanently delete everything. This action cannot be undone.
                  </p>
                  <Button onClick={() => setShowClearDialog(true)} variant="destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Log */}
          <TabsContent value="audit" className="space-y-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-400" />
                  Audit Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {auditLogs.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">No audit logs yet</p>
                    ) : (
                      auditLogs.map((log) => (
                        <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                          <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                            {getActionIcon(log.action)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-200 capitalize">
                                {log.action.replace(/_/g, ' ')}
                              </span>
                              <Badge variant="secondary" className="text-xs bg-slate-700">
                                {log.userName}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-400">{log.details}</p>
                            <p className="text-xs text-slate-500">{formatDateTime(log.timestamp)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-400" />
              Import Data
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Paste your backup data below. This will replace all current data.
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste JSON backup data here..."
              rows={10}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm font-mono"
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowImportDialog(false)} className="flex-1 border-slate-700">
                Cancel
              </Button>
              <Button onClick={handleImport} className="flex-1 bg-blue-600 hover:bg-blue-700">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear Data Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Clear All Data
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-sm text-red-400">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Warning: This will permanently delete all data including products, sales, customers, and settings. This action cannot be undone.
              </p>
            </div>
            <p className="text-sm text-slate-400">
              Make sure you have a backup before proceeding.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowClearDialog(false)} className="flex-1 border-slate-700">
                Cancel
              </Button>
              <Button onClick={handleClearAll} variant="destructive" className="flex-1">
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Everything
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
