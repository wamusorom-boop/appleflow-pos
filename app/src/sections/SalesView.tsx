/**
 * AppleFlow POS - Sales View
 * Sales history with refunds, voids, and advanced filtering
 */

import { useState, useEffect, useMemo } from 'react';
import { Search, Receipt, Download, RotateCcw, Ban, X, AlertTriangle, Plus, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { getSales, saveSales, getShifts, saveShifts, saveRefunds, formatCurrency, formatDateTime, DEMO_BUSINESS, logReceiptReprint } from '@/lib/data';

export function SalesView() {
  const [sales, setSales] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [refundItems, setRefundItems] = useState<Record<string, number>>({});
  const [showReprintDialog, setShowReprintDialog] = useState(false);
  const [reprintReason, setReprintReason] = useState('');

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = () => {
    setSales(getSales());
  };

  const filteredSales = useMemo(() => {
    let filtered = sales.filter(sale => 
      sale.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.cashierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale.customer && sale.customer.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Apply date filter
    const now = new Date();
    if (dateFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(s => new Date(s.createdAt) >= today);
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(s => new Date(s.createdAt) >= weekAgo);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter(s => new Date(s.createdAt) >= monthAgo);
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sales, searchQuery, dateFilter]);

  const viewReceipt = (sale: any) => {
    setSelectedSale(sale);
    setShowReceipt(true);
  };

  const openRefund = (sale: any) => {
    if (sale.status === 'refunded' || sale.status === 'voided') {
      toast.error('This sale cannot be refunded');
      return;
    }
    setSelectedSale(sale);
    setRefundItems({});
    setRefundReason('');
    setShowRefund(true);
  };

  const openVoid = (sale: any) => {
    if (sale.status === 'voided') {
      toast.error('This sale is already voided');
      return;
    }
    setSelectedSale(sale);
    setVoidReason('');
    setShowVoid(true);
  };

  const openReprint = (sale: any) => {
    setSelectedSale(sale);
    setReprintReason('');
    setShowReprintDialog(true);
  };

  const processReprint = () => {
    if (!selectedSale) return;
    if (!reprintReason.trim()) {
      toast.error('Please provide a reprint reason');
      return;
    }
    
    logReceiptReprint(selectedSale.id, selectedSale.receiptNumber, reprintReason);
    setShowReprintDialog(false);
    toast.success('Receipt reprinted successfully');
  };

  const processRefund = () => {
    if (!selectedSale) return;
    
    const itemsToRefund = Object.entries(refundItems).filter(([_, qty]) => qty > 0);
    if (itemsToRefund.length === 0) {
      toast.error('Select items to refund');
      return;
    }
    if (!refundReason.trim()) {
      toast.error('Please provide a refund reason');
      return;
    }

    const refundAmount = itemsToRefund.reduce((sum, [productId, qty]) => {
      const item = selectedSale.items.find((i: any) => i.productId === productId);
      return sum + (item ? item.total * (qty / item.quantity) : 0);
    }, 0);

    // Update sale status
    const allItems = selectedSale.items;
    const refundQty = itemsToRefund.reduce((sum, [_, qty]) => sum + qty, 0);
    const totalQty = allItems.reduce((sum: number, i: any) => sum + i.quantity, 0);
    
    const updatedSales = sales.map(s => {
      if (s.id === selectedSale.id) {
        return {
          ...s,
          status: refundQty >= totalQty ? 'refunded' : 'partially_refunded',
          refundedAt: new Date().toISOString(),
          refundedBy: 'Current User',
          refundReason,
          refundAmount,
        };
      }
      return s;
    });

    saveSales(updatedSales);
    setSales(updatedSales);

    // Save refund record
    const refunds = JSON.parse(localStorage.getItem('appleflow-refunds') || '[]');
    refunds.push({
      id: 'ref-' + Date.now(),
      originalSaleId: selectedSale.id,
      receiptNumber: selectedSale.receiptNumber,
      items: itemsToRefund.map(([productId, qty]) => {
        const item = selectedSale.items.find((i: any) => i.productId === productId);
        return { ...item, quantity: qty };
      }),
      refundAmount,
      reason: refundReason,
      processedBy: 'Current User',
      processedAt: new Date().toISOString(),
      paymentMethod: selectedSale.payment.method,
    });
    saveRefunds(refunds);

    // Restore inventory
    const products = JSON.parse(localStorage.getItem('appleflow-products') || '[]');
    itemsToRefund.forEach(([productId, qty]) => {
      const product = products.find((p: any) => p.id === productId);
      if (product) {
        product.quantity += qty;
      }
    });
    localStorage.setItem('appleflow-products', JSON.stringify(products));

    setShowRefund(false);
    toast.success(`Refund processed: ${formatCurrency(refundAmount)}`);
  };

  const processVoid = () => {
    if (!selectedSale) return;
    if (!voidReason.trim()) {
      toast.error('Please provide a void reason');
      return;
    }

    // Update sale status
    const updatedSales = sales.map(s => {
      if (s.id === selectedSale.id) {
        return {
          ...s,
          status: 'voided',
          voidedAt: new Date().toISOString(),
          voidedBy: 'Current User',
          voidReason,
        };
      }
      return s;
    });

    saveSales(updatedSales);
    setSales(updatedSales);

    // Restore inventory
    const products = JSON.parse(localStorage.getItem('appleflow-products') || '[]');
    selectedSale.items.forEach((item: any) => {
      const product = products.find((p: any) => p.id === item.productId);
      if (product) {
        product.quantity += item.quantity;
      }
    });
    localStorage.setItem('appleflow-products', JSON.stringify(products));

    // Update shift totals
    const shifts = getShifts();
    const updatedShifts = shifts.map(s => {
      if (s.id === selectedSale.shiftId) {
        return {
          ...s,
          refundCount: s.refundCount + 1,
          refundTotal: s.refundTotal + selectedSale.total,
        };
      }
      return s;
    });
    saveShifts(updatedShifts);

    setShowVoid(false);
    toast.success('Sale voided successfully');
  };

  // Calculate stats
  const stats = useMemo(() => {
    const completed = sales.filter(s => s.status === 'completed');
    const refunded = sales.filter(s => s.status === 'refunded' || s.status === 'partially_refunded');
    const voided = sales.filter(s => s.status === 'voided');
    
    return {
      totalSales: completed.reduce((sum, s) => sum + s.total, 0),
      totalTransactions: completed.length,
      totalRefunds: refunded.reduce((sum, s) => sum + (s.refundAmount || 0), 0),
      refundCount: refunded.length,
      voidedCount: voided.length,
    };
  }, [sales]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-500/20 text-emerald-400">Completed</Badge>;
      case 'refunded':
        return <Badge className="bg-red-500/20 text-red-400">Refunded</Badge>;
      case 'partially_refunded':
        return <Badge className="bg-amber-500/20 text-amber-400">Partial Refund</Badge>;
      case 'voided':
        return <Badge className="bg-slate-500/20 text-slate-400">Voided</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
        <h1 className="text-xl font-bold text-slate-200">Sales History</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="border-slate-700 text-slate-400">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 p-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-400">Total Sales</p>
              <p className="text-2xl font-bold text-emerald-400">{formatCurrency(stats.totalSales)}</p>
              <p className="text-xs text-slate-500">{stats.totalTransactions} transactions</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-400">Refunds</p>
              <p className="text-2xl font-bold text-red-400">{formatCurrency(stats.totalRefunds)}</p>
              <p className="text-xs text-slate-500">{stats.refundCount} refunds</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-400">Net Sales</p>
              <p className="text-2xl font-bold text-blue-400">
                {formatCurrency(stats.totalSales - stats.totalRefunds)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-400">Voided</p>
              <p className="text-2xl font-bold text-slate-400">{stats.voidedCount}</p>
              <p className="text-xs text-slate-500">transactions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="px-4 pb-4 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by receipt number, cashier, or customer..."
            className="pl-10 bg-slate-900 border-slate-700 text-slate-200"
          />
        </div>
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {(['all', 'today', 'week', 'month'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setDateFilter(filter)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                dateFilter === filter 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Sales Table */}
      <ScrollArea className="flex-1 px-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Receipt #</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Date</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Customer</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Cashier</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Items</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Total</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredSales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-emerald-400">{sale.receiptNumber}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {formatDateTime(sale.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {sale.customer ? sale.customer.name : 'Walk-in'}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{sale.cashierName}</td>
                  <td className="px-4 py-3 text-center text-slate-300">
                    {sale.items.length}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-400">
                    {formatCurrency(sale.total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(sale.status)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewReceipt(sale)}
                        className="text-slate-400 hover:text-emerald-400"
                        title="View Receipt"
                      >
                        <Receipt className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openReprint(sale)}
                        className="text-slate-400 hover:text-blue-400"
                        title="Reprint Receipt"
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                      {sale.status === 'completed' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openRefund(sale)}
                            className="text-slate-400 hover:text-amber-400"
                            title="Refund"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openVoid(sale)}
                            className="text-slate-400 hover:text-red-400"
                            title="Void"
                          >
                            <Ban className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="bg-white text-slate-900 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center flex items-center justify-center gap-2">
              <Receipt className="w-5 h-5" />
              Receipt
            </DialogTitle>
          </DialogHeader>
          
          {selectedSale && (
            <div className="space-y-4">
              <div className="text-center border-b border-slate-200 pb-4">
                <h3 className="font-bold text-lg">{DEMO_BUSINESS.name}</h3>
                <p className="text-xs text-slate-500">{DEMO_BUSINESS.address}</p>
                <p className="text-xs text-slate-500">Tel: {DEMO_BUSINESS.phone}</p>
                <p className="text-xs text-slate-500">KRA PIN: {DEMO_BUSINESS.kraPin}</p>
              </div>

              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt #:</span>
                  <span>{selectedSale.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span>{new Date(selectedSale.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cashier:</span>
                  <span>{selectedSale.cashierName}</span>
                </div>
                {selectedSale.status !== 'completed' && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="font-medium capitalize">{selectedSale.status.replace('_', ' ')}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-b border-slate-200 py-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="text-left">Item</th>
                      <th className="text-center">Qty</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSale.items.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="text-left py-1">{item.productName}</td>
                        <td className="text-center">{item.quantity}</td>
                        <td className="text-right">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal:</span>
                  <span>{formatCurrency(selectedSale.subtotal)}</span>
                </div>
                {selectedSale.discountTotal > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Discount:</span>
                    <span>-{formatCurrency(selectedSale.discountTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">VAT (16%):</span>
                  <span>{formatCurrency(selectedSale.vatTotal)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                  <span>TOTAL:</span>
                  <span className="text-emerald-600">{formatCurrency(selectedSale.total)}</span>
                </div>
              </div>

              <div className="text-center text-xs text-slate-500 border-t border-slate-200 pt-4">
                <p className="whitespace-pre-line">{DEMO_BUSINESS.receiptFooter}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={showRefund} onOpenChange={setShowRefund}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-400" />
              Process Refund
            </DialogTitle>
          </DialogHeader>
          
          {selectedSale && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Select items to refund from receipt #{selectedSale.receiptNumber}
              </p>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedSale.items.map((item: any) => (
                  <div key={item.productId} className="flex items-center justify-between bg-slate-800/50 p-3 rounded">
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-xs text-slate-500">{formatCurrency(item.total)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setRefundItems({
                          ...refundItems,
                          [item.productId]: Math.max(0, (refundItems[item.productId] || 0) - 1)
                        })}
                        className="w-7 h-7 bg-slate-700 rounded flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center">
                        {refundItems[item.productId] || 0}
                      </span>
                      <button
                        onClick={() => setRefundItems({
                          ...refundItems,
                          [item.productId]: Math.min(item.quantity, (refundItems[item.productId] || 0) + 1)
                        })}
                        className="w-7 h-7 bg-slate-700 rounded flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">Refund Reason</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Why is this being refunded?"
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowRefund(false)}
                  className="flex-1 border-slate-700 text-slate-400"
                >
                  Cancel
                </Button>
                <Button
                  onClick={processRefund}
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Process Refund
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Void Dialog */}
      <Dialog open={showVoid} onOpenChange={setShowVoid}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Void Transaction
            </DialogTitle>
          </DialogHeader>
          
          {selectedSale && (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-sm text-red-400">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Warning: This action cannot be undone. The entire transaction will be voided and inventory will be restored.
                </p>
              </div>
              
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-sm text-slate-400">Transaction Details</p>
                <p className="font-medium">{selectedSale.receiptNumber}</p>
                <p className="text-emerald-400">{formatCurrency(selectedSale.total)}</p>
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">Void Reason *</label>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Why is this transaction being voided?"
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowVoid(false)}
                  className="flex-1 border-slate-700 text-slate-400"
                >
                  Cancel
                </Button>
                <Button
                  onClick={processVoid}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Void Transaction
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reprint Dialog */}
      <Dialog open={showReprintDialog} onOpenChange={setShowReprintDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-400" />
              Reprint Receipt
            </DialogTitle>
          </DialogHeader>
          
          {selectedSale && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-sm text-slate-400">Receipt Details</p>
                <p className="font-medium">{selectedSale.receiptNumber}</p>
                <p className="text-emerald-400">{formatCurrency(selectedSale.total)}</p>
                <p className="text-xs text-slate-500">{formatDateTime(selectedSale.createdAt)}</p>
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">Reprint Reason *</label>
                <textarea
                  value={reprintReason}
                  onChange={(e) => setReprintReason(e.target.value)}
                  placeholder="Why is this receipt being reprinted?"
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowReprintDialog(false)}
                  className="flex-1 border-slate-700 text-slate-400"
                >
                  Cancel
                </Button>
                <Button
                  onClick={processReprint}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Reprint
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
