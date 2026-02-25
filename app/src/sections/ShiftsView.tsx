/**
 * AppleFlow POS - Shift Management View
 * Cash drawer management, shift open/close, X/Z reports, EOD reconciliation
 */

import { useState, useEffect } from 'react';
import { 
  Clock, DollarSign, LogIn, LogOut, Plus, Minus, 
  AlertTriangle, History, User, TrendingUp, FileText,
  Printer, CheckCircle, XCircle,
  BarChart3, Receipt, Download, Sun
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  getShifts, saveShifts, getSales, getCashMovements, saveCashMovements,
  generateShiftId, formatCurrency, formatDateTime, formatTime,
  generateXReport, generateZReport, generateEndOfDaySummary,
  saveXReport, saveZReport, DEMO_BUSINESS
} from '@/lib/data';
import type { XReport, ZReport, EndOfDaySummary } from '@/types';
import { useAuth } from '@/context/AuthContext';

export function ShiftsView() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<any[]>([]);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [cashMovements, setCashMovements] = useState<any[]>([]);
  
  // Dialog states
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [showCashMovement, setShowCashMovement] = useState(false);
  const [showShiftDetails, setShowShiftDetails] = useState<any>(null);
  const [showXReport, setShowXReport] = useState<XReport | null>(null);
  const [showZReport, setShowZReport] = useState<ZReport | null>(null);
  const [showEodSummary, setShowEodSummary] = useState<EndOfDaySummary | null>(null);
  const [showEodDatePicker, setShowEodDatePicker] = useState(false);
  
  // Form states
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [openingNote, setOpeningNote] = useState('');
  const [closingNote, setClosingNote] = useState('');
  const [movementType, setMovementType] = useState<'paid_in' | 'paid_out'>('paid_in');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [eodDate, setEodDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const allShifts = getShifts();
    setShifts(allShifts);
    setActiveShift(allShifts.find((s: any) => s.isActive && !s.isClosed) || null);
    setSales(getSales());
    setCashMovements(getCashMovements());
  };

  const openShift = () => {
    const cash = parseFloat(openingCash);
    if (isNaN(cash) || cash < 0) {
      toast.error('Please enter a valid opening cash amount');
      return;
    }

    // Close any existing active shifts first
    const existingShifts = getShifts();
    const updatedShifts = existingShifts.map((s: any) => 
      s.isActive ? { ...s, isActive: false } : s
    );

    const newShift = {
      id: generateShiftId(),
      userId: user?.id || '',
      userName: user?.name || 'Unknown',
      openedAt: new Date().toISOString(),
      openingCash: cash,
      cashSales: 0,
      mpesaSales: 0,
      cardSales: 0,
      creditSales: 0,
      chequeSales: 0,
      transactionCount: 0,
      refundCount: 0,
      refundTotal: 0,
      voidCount: 0,
      isActive: true,
      isClosed: false,
      openingNote,
    };

    saveShifts([newShift, ...updatedShifts]);
    setShowOpenShift(false);
    setOpeningCash('');
    setOpeningNote('');
    loadData();
    toast.success('Shift opened successfully');
  };

  const closeShift = () => {
    const cash = parseFloat(closingCash);
    if (isNaN(cash) || cash < 0) {
      toast.error('Please enter a valid closing cash amount');
      return;
    }

    if (!activeShift) return;

    // Calculate expected cash
    const shiftMovements = cashMovements.filter((m: any) => m.shiftId === activeShift.id);
    const paidIn = shiftMovements.filter((m: any) => m.type === 'paid_in').reduce((sum: number, m: any) => sum + m.amount, 0);
    const paidOut = shiftMovements.filter((m: any) => m.type === 'paid_out').reduce((sum: number, m: any) => sum + m.amount, 0);
    
    const expectedCash = activeShift.openingCash + activeShift.cashSales - paidOut + paidIn;
    const difference = cash - expectedCash;

    const updatedShifts = shifts.map((s: any) => {
      if (s.id === activeShift.id) {
        return {
          ...s,
          closedAt: new Date().toISOString(),
          closingCash: cash,
          expectedCash,
          cashDifference: difference,
          isActive: false,
          isClosed: true,
          closingNote,
        };
      }
      return s;
    });

    saveShifts(updatedShifts);
    setShowCloseShift(false);
    setClosingCash('');
    setClosingNote('');
    loadData();
    
    if (Math.abs(difference) > 100) {
      toast.warning(`Shift closed with ${formatCurrency(Math.abs(difference))} ${difference > 0 ? 'overage' : 'shortage'}`);
    } else {
      toast.success('Shift closed successfully');
    }
  };

  const addCashMovement = () => {
    const amount = parseFloat(movementAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!movementReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    if (!activeShift) {
      toast.error('No active shift');
      return;
    }

    const movement = {
      id: 'cm-' + Date.now(),
      shiftId: activeShift.id,
      type: movementType,
      amount,
      reason: movementReason,
      performedBy: user?.name || 'Unknown',
      performedAt: new Date().toISOString(),
    };

    saveCashMovements([...cashMovements, movement]);
    setShowCashMovement(false);
    setMovementAmount('');
    setMovementReason('');
    loadData();
    toast.success(`${movementType === 'paid_in' ? 'Cash in' : 'Cash out'} recorded`);
  };

  const handleGenerateXReport = () => {
    if (!activeShift) {
      toast.error('No active shift');
      return;
    }
    const report = generateXReport(activeShift.id);
    if (report) {
      saveXReport(report);
      setShowXReport(report);
      toast.success('X Report generated');
    }
  };

  const handleGenerateEod = () => {
    const summary = generateEndOfDaySummary(eodDate, user?.name || 'Unknown');
    setShowEodSummary(summary);
    setShowEodDatePicker(false);
  };

  const getShiftMovements = (shiftId: string) => {
    return cashMovements.filter((m: any) => m.shiftId === shiftId);
  };

  const getShiftSales = (shiftId: string) => {
    return sales.filter((s: any) => s.shiftId === shiftId && s.status === 'completed');
  };

  // Stats for active shift
  const activeShiftStats = activeShift ? {
    duration: Math.floor((Date.now() - new Date(activeShift.openedAt).getTime()) / 60000),
    sales: activeShift.cashSales + activeShift.mpesaSales + activeShift.cardSales,
    transactions: activeShift.transactionCount,
  } : null;

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-auto">
      {/* Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
        <h1 className="text-xl font-bold text-slate-200">Shift Management</h1>
        <div className="flex items-center gap-2">
          {/* X/Z Report Buttons */}
          {activeShift && (
            <>
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleGenerateXReport}
                className="border-blue-700 text-blue-400"
              >
                <FileText className="w-4 h-4 mr-1" />
                X Report
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setShowEodDatePicker(true)}
                className="border-purple-700 text-purple-400"
              >
                <Sun className="w-4 h-4 mr-1" />
                EOD
              </Button>
            </>
          )}
          {activeShift ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400">
                <Clock className="w-3 h-3 mr-1" />
                Active Shift
              </Badge>
              <Button 
                size="sm" 
                onClick={() => setShowCloseShift(true)}
                variant="destructive"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Close Shift
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setShowOpenShift(true)} className="bg-emerald-600">
              <LogIn className="w-4 h-4 mr-1" />
              Open Shift
            </Button>
          )}
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Active Shift Card */}
        {activeShift && activeShiftStats && (
          <Card className="bg-gradient-to-r from-emerald-900/50 to-slate-900 border-emerald-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                    <Clock className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-200">Current Shift</p>
                    <p className="text-sm text-slate-400">
                      Opened {formatTime(activeShift.openedAt)} • {Math.floor(activeShiftStats.duration / 60)}h {activeShiftStats.duration % 60}m
                    </p>
                    <p className="text-sm text-slate-400">by {activeShift.userName}</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-400">{formatCurrency(activeShiftStats.sales)}</p>
                    <p className="text-xs text-slate-400">Total Sales</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-400">{activeShiftStats.transactions}</p>
                    <p className="text-xs text-slate-400">Transactions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-400">{formatCurrency(activeShift.openingCash)}</p>
                    <p className="text-xs text-slate-400">Opening Cash</p>
                  </div>
                </div>
              </div>
              
              {/* Quick Actions */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700/50">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => { setMovementType('paid_in'); setShowCashMovement(true); }}
                  className="border-emerald-700 text-emerald-400"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Cash In
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => { setMovementType('paid_out'); setShowCashMovement(true); }}
                  className="border-red-700 text-red-400"
                >
                  <Minus className="w-4 h-4 mr-1" />
                  Cash Out
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Breakdown */}
        {activeShift && (
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Cash Sales</p>
                    <p className="text-xl font-bold text-green-400">{formatCurrency(activeShift.cashSales)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">M-Pesa</p>
                    <p className="text-xl font-bold text-blue-400">{formatCurrency(activeShift.mpesaSales)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Card Sales</p>
                    <p className="text-xl font-bold text-purple-400">{formatCurrency(activeShift.cardSales)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Refunds</p>
                    <p className="text-xl font-bold text-red-400">{formatCurrency(activeShift.refundTotal)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Shift History */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
              <History className="w-5 h-5 text-slate-400" />
              Shift History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {shifts.filter((s: any) => s.isClosed).length === 0 ? (
                <p className="text-center text-slate-500 py-8">No closed shifts yet</p>
              ) : (
                shifts.filter((s: any) => s.isClosed).map((shift: any) => (
                  <div 
                    key={shift.id} 
                    className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800 cursor-pointer"
                    onClick={() => setShowShiftDetails(shift)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                        <User className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-200">{shift.userName}</p>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(shift.openedAt)} - {formatTime(shift.closedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-slate-400">Sales</p>
                        <p className="font-medium text-emerald-400">
                          {formatCurrency(shift.cashSales + shift.mpesaSales + shift.cardSales)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-400">Transactions</p>
                        <p className="font-medium text-slate-200">{shift.transactionCount}</p>
                      </div>
                      {shift.cashDifference !== 0 && (
                        <Badge className={shift.cashDifference > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                          {shift.cashDifference > 0 ? '+' : ''}{formatCurrency(shift.cashDifference)}
                        </Badge>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          const report = generateZReport(shift.id, user?.name || 'Unknown');
                          if (report) {
                            saveZReport(report);
                            setShowZReport(report);
                          }
                        }}
                        className="border-purple-700 text-purple-400"
                      >
                        <Receipt className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Open Shift Dialog */}
      <Dialog open={showOpenShift} onOpenChange={setShowOpenShift}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="w-5 h-5 text-emerald-400" />
              Open New Shift
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Opening Cash Amount (KES)</label>
              <Input
                type="number"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="e.g., 5000"
                className="bg-slate-800 border-slate-700 text-slate-200 text-lg"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Note (Optional)</label>
              <textarea
                value={openingNote}
                onChange={(e) => setOpeningNote(e.target.value)}
                placeholder="Any notes for this shift..."
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm"
              />
            </div>
            <Button 
              onClick={openShift}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Open Shift
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={showCloseShift} onOpenChange={setShowCloseShift}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="w-5 h-5 text-red-400" />
              Close Shift
            </DialogTitle>
          </DialogHeader>
          {activeShift && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Opening Cash:</span>
                  <span>{formatCurrency(activeShift.openingCash)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Cash Sales:</span>
                  <span className="text-emerald-400">+{formatCurrency(activeShift.cashSales)}</span>
                </div>
                {getShiftMovements(activeShift.id).length > 0 && (
                  <>
                    {getShiftMovements(activeShift.id).filter((m: any) => m.type === 'paid_in').map((m: any) => (
                      <div key={m.id} className="flex justify-between text-sm">
                        <span className="text-slate-400">Cash In:</span>
                        <span className="text-emerald-400">+{formatCurrency(m.amount)}</span>
                      </div>
                    ))}
                    {getShiftMovements(activeShift.id).filter((m: any) => m.type === 'paid_out').map((m: any) => (
                      <div key={m.id} className="flex justify-between text-sm">
                        <span className="text-slate-400">Cash Out:</span>
                        <span className="text-red-400">-{formatCurrency(m.amount)}</span>
                      </div>
                    ))}
                  </>
                )}
                <div className="border-t border-slate-700 pt-2">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Expected Cash:</span>
                    <span className="font-medium">
                      {formatCurrency(
                        activeShift.openingCash + 
                        activeShift.cashSales + 
                        getShiftMovements(activeShift.id).filter((m: any) => m.type === 'paid_in').reduce((sum: number, m: any) => sum + m.amount, 0) -
                        getShiftMovements(activeShift.id).filter((m: any) => m.type === 'paid_out').reduce((sum: number, m: any) => sum + m.amount, 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">Actual Cash in Drawer (KES)</label>
                <Input
                  type="number"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  placeholder="Count and enter actual cash"
                  className="bg-slate-800 border-slate-700 text-slate-200 text-lg"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">Closing Note (Optional)</label>
                <textarea
                  value={closingNote}
                  onChange={(e) => setClosingNote(e.target.value)}
                  placeholder="Any notes about this shift..."
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowCloseShift(false)}
                  className="flex-1 border-slate-700 text-slate-400"
                >
                  Cancel
                </Button>
                <Button
                  onClick={closeShift}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Close Shift
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cash Movement Dialog */}
      <Dialog open={showCashMovement} onOpenChange={setShowCashMovement}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {movementType === 'paid_in' ? (
                <Plus className="w-5 h-5 text-emerald-400" />
              ) : (
                <Minus className="w-5 h-5 text-red-400" />
              )}
              {movementType === 'paid_in' ? 'Cash In' : 'Cash Out'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Amount (KES)</label>
              <Input
                type="number"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                placeholder="Enter amount"
                className="bg-slate-800 border-slate-700 text-slate-200 text-lg"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Reason</label>
              <Input
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                placeholder={movementType === 'paid_in' ? 'e.g., Owner contribution' : 'e.g., Petty cash, supplies'}
                className="bg-slate-800 border-slate-700 text-slate-200"
              />
            </div>
            <Button 
              onClick={addCashMovement}
              className={movementType === 'paid_in' ? 'w-full bg-emerald-600 hover:bg-emerald-700' : 'w-full bg-red-600 hover:bg-red-700'}
            >
              {movementType === 'paid_in' ? (
                <Plus className="w-4 h-4 mr-2" />
              ) : (
                <Minus className="w-4 h-4 mr-2" />
              )}
              Record {movementType === 'paid_in' ? 'Cash In' : 'Cash Out'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Shift Details Dialog */}
      <Dialog open={!!showShiftDetails} onOpenChange={() => setShowShiftDetails(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-lg max-h-[80vh] overflow-y-auto">
          {showShiftDetails && (
            <>
              <DialogHeader>
                <DialogTitle>Shift Details</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="font-medium">{showShiftDetails.userName}</p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(showShiftDetails.openedAt)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Opening Cash</p>
                      <p className="font-medium">{formatCurrency(showShiftDetails.openingCash)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Closing Cash</p>
                      <p className="font-medium">{formatCurrency(showShiftDetails.closingCash)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Expected Cash</p>
                      <p className="font-medium">{formatCurrency(showShiftDetails.expectedCash)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Difference</p>
                      <p className={showShiftDetails.cashDifference === 0 ? 'font-medium text-emerald-400' : showShiftDetails.cashDifference > 0 ? 'font-medium text-emerald-400' : 'font-medium text-red-400'}>
                        {showShiftDetails.cashDifference > 0 ? '+' : ''}{formatCurrency(showShiftDetails.cashDifference)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500">Cash Sales</p>
                    <p className="font-medium text-green-400">{formatCurrency(showShiftDetails.cashSales)}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500">M-Pesa</p>
                    <p className="font-medium text-blue-400">{formatCurrency(showShiftDetails.mpesaSales)}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500">Card</p>
                    <p className="font-medium text-purple-400">{formatCurrency(showShiftDetails.cardSales)}</p>
                  </div>
                </div>

                {/* Cash Movements */}
                {getShiftMovements(showShiftDetails.id).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-300 mb-2">Cash Movements</p>
                    <div className="space-y-1">
                      {getShiftMovements(showShiftDetails.id).map((m: any) => (
                        <div key={m.id} className="flex justify-between items-center bg-slate-800/30 p-2 rounded text-sm">
                          <div>
                            <span className={m.type === 'paid_in' ? 'text-emerald-400' : 'text-red-400'}>
                              {m.type === 'paid_in' ? 'Cash In' : 'Cash Out'}
                            </span>
                            <p className="text-xs text-slate-500">{m.reason}</p>
                          </div>
                          <span className={m.type === 'paid_in' ? 'text-emerald-400' : 'text-red-400'}>
                            {m.type === 'paid_in' ? '+' : '-'}{formatCurrency(m.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transactions */}
                <div>
                  <p className="text-sm font-medium text-slate-300 mb-2">Transactions ({getShiftSales(showShiftDetails.id).length})</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {getShiftSales(showShiftDetails.id).slice(0, 10).map((sale: any) => (
                      <div key={sale.id} className="flex justify-between items-center bg-slate-800/30 p-2 rounded text-sm">
                        <div>
                          <p className="font-mono text-xs">{sale.receiptNumber}</p>
                          <p className="text-xs text-slate-500">{formatTime(sale.createdAt)}</p>
                        </div>
                        <span className="text-emerald-400">{formatCurrency(sale.total)}</span>
                      </div>
                    ))}
                    {getShiftSales(showShiftDetails.id).length > 10 && (
                      <p className="text-center text-xs text-slate-500">
                        +{getShiftSales(showShiftDetails.id).length - 10} more transactions
                      </p>
                    )}
                  </div>
                </div>

                {showShiftDetails.closingNote && (
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Closing Note</p>
                    <p className="text-sm">{showShiftDetails.closingNote}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* X Report Dialog */}
      <Dialog open={!!showXReport} onOpenChange={() => setShowXReport(null)}>
        <DialogContent className="bg-white text-slate-900 max-w-md max-h-[90vh] overflow-y-auto">
          {showXReport && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center flex items-center justify-center gap-2">
                  <FileText className="w-5 h-5" />
                  X REPORT (Mid-Shift Reading)
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Header */}
                <div className="text-center border-b border-slate-200 pb-4">
                  <h3 className="font-bold text-lg">{DEMO_BUSINESS.name}</h3>
                  <p className="text-xs text-slate-500">X Report - Not a Final Report</p>
                  <p className="text-xs text-slate-500">Generated: {new Date(showXReport.generatedAt).toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Cashier: {showXReport.cashierName}</p>
                </div>

                {/* Sales Summary */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm border-b border-slate-200 pb-1">Sales Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gross Sales:</span>
                      <span>{formatCurrency(showXReport.grossSales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Net Sales:</span>
                      <span className="font-medium">{formatCurrency(showXReport.netSales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tax (VAT):</span>
                      <span>{formatCurrency(showXReport.taxTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Discounts:</span>
                      <span className="text-amber-600">-{formatCurrency(showXReport.discountTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Breakdown */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm border-b border-slate-200 pb-1">Payment Methods</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cash:</span>
                      <span>{formatCurrency(showXReport.payments.cash)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">M-Pesa:</span>
                      <span>{formatCurrency(showXReport.payments.mpesa)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Card:</span>
                      <span>{formatCurrency(showXReport.payments.card)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t border-slate-200 pt-1">
                      <span>Total:</span>
                      <span className="text-emerald-600">{formatCurrency(showXReport.payments.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Transaction Stats */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm border-b border-slate-200 pb-1">Transaction Statistics</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Transactions:</span>
                      <span>{showXReport.transactionCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Items Sold:</span>
                      <span>{showXReport.itemCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Avg Transaction:</span>
                      <span>{formatCurrency(showXReport.averageTransaction)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Voids:</span>
                      <span className="text-red-600">{showXReport.voidCount}</span>
                    </div>
                  </div>
                </div>

                {/* Cash Drawer */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm border-b border-slate-200 pb-1">Cash Drawer Status</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Opening Cash:</span>
                      <span>{formatCurrency(showXReport.openingCash)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cash Sales:</span>
                      <span className="text-emerald-600">+{formatCurrency(showXReport.cashSales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Paid In:</span>
                      <span className="text-emerald-600">+{formatCurrency(showXReport.paidIn)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Paid Out:</span>
                      <span className="text-red-600">-{formatCurrency(showXReport.paidOut)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t border-slate-200 pt-1">
                      <span>Expected Cash:</span>
                      <span className="text-blue-600">{formatCurrency(showXReport.expectedCash)}</span>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <p className="text-sm text-amber-700 font-medium">⚠️ This is a mid-shift reading only</p>
                  <p className="text-xs text-amber-600">Final figures will be in the Z Report</p>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => window.print()}
                    className="flex-1 border-slate-700"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                  <Button onClick={() => setShowXReport(null)} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Done
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Z Report Dialog */}
      <Dialog open={!!showZReport} onOpenChange={() => setShowZReport(null)}>
        <DialogContent className="bg-white text-slate-900 max-w-md max-h-[90vh] overflow-y-auto">
          {showZReport && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center flex items-center justify-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Z REPORT (End-of-Shift)
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Header */}
                <div className="text-center border-b border-slate-200 pb-4">
                  <h3 className="font-bold text-lg">{DEMO_BUSINESS.name}</h3>
                  <p className="text-xs text-slate-500">Z Report - Final Reading</p>
                  <p className="text-xs text-slate-500">Report Date: {showZReport.reportDate}</p>
                  <p className="text-xs text-slate-500">Generated: {new Date(showZReport.generatedAt).toLocaleString()}</p>
                  {showZReport.shiftInfo && (
                    <>
                      <p className="text-xs text-slate-500">Cashier: {showZReport.shiftInfo.cashierName}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(showZReport.shiftInfo.openedAt).toLocaleTimeString()} - {new Date(showZReport.shiftInfo.closedAt).toLocaleTimeString()}
                      </p>
                    </>
                  )}
                </div>

                {/* Sales Summary */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm border-b border-slate-200 pb-1">Sales Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gross Sales:</span>
                      <span>{formatCurrency(showZReport.grossSales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Net Sales:</span>
                      <span className="font-medium">{formatCurrency(showZReport.netSales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tax (VAT):</span>
                      <span>{formatCurrency(showZReport.taxTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Discounts:</span>
                      <span className="text-amber-600">-{formatCurrency(showZReport.discountTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Breakdown */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm border-b border-slate-200 pb-1">Payment Methods</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cash:</span>
                      <span>{formatCurrency(showZReport.payments.cash)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">M-Pesa:</span>
                      <span>{formatCurrency(showZReport.payments.mpesa)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Card:</span>
                      <span>{formatCurrency(showZReport.payments.card)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t border-slate-200 pt-1">
                      <span>Total:</span>
                      <span className="text-emerald-600">{formatCurrency(showZReport.payments.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Voids & Refunds */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm border-b border-slate-200 pb-1">Voids & Refunds</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Voids:</span>
                      <span className="text-red-600">{showZReport.voidCount} ({formatCurrency(showZReport.voidAmount)})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Refunds:</span>
                      <span className="text-red-600">{showZReport.refundCount} ({formatCurrency(showZReport.refundAmount)})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">No-Receipt Returns:</span>
                      <span className="text-amber-600">{showZReport.noReceiptReturns} ({formatCurrency(showZReport.noReceiptReturnAmount)})</span>
                    </div>
                  </div>
                </div>

                {/* Cash Reconciliation */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm border-b border-slate-200 pb-1">Cash Reconciliation</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Opening Cash:</span>
                      <span>{formatCurrency(showZReport.openingCash)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cash Sales:</span>
                      <span className="text-emerald-600">+{formatCurrency(showZReport.cashSales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Paid In:</span>
                      <span className="text-emerald-600">+{formatCurrency(showZReport.paidIn)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Paid Out:</span>
                      <span className="text-red-600">-{formatCurrency(showZReport.paidOut)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Expected Cash:</span>
                      <span className="text-blue-600">{formatCurrency(showZReport.expectedCash)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Actual Cash:</span>
                      <span>{formatCurrency(showZReport.actualCash)}</span>
                    </div>
                    <div className={`flex justify-between font-medium border-t border-slate-200 pt-1 ${showZReport.cashDifference === 0 ? 'text-emerald-600' : showZReport.cashDifference > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      <span>Difference:</span>
                      <span>{showZReport.cashDifference > 0 ? '+' : ''}{formatCurrency(showZReport.cashDifference)}</span>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className={`rounded-lg p-3 text-center ${showZReport.isFinal ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                  <p className={`text-sm font-medium ${showZReport.isFinal ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {showZReport.isFinal ? '✓ Final Report - Shift Closed' : '⚠️ Preliminary Report'}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => window.print()}
                    className="flex-1 border-slate-700"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                  <Button onClick={() => setShowZReport(null)} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Done
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* EOD Date Picker Dialog */}
      <Dialog open={showEodDatePicker} onOpenChange={setShowEodDatePicker}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sun className="w-5 h-5 text-amber-400" />
              End-of-Day Summary
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Select Date</label>
              <Input
                type="date"
                value={eodDate}
                onChange={(e) => setEodDate(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-200"
              />
            </div>
            <Button 
              onClick={handleGenerateEod}
              className="w-full bg-amber-600 hover:bg-amber-700"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Generate EOD Summary
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* EOD Summary Dialog */}
      <Dialog open={!!showEodSummary} onOpenChange={() => setShowEodSummary(null)}>
        <DialogContent className="bg-white text-slate-900 max-w-2xl max-h-[90vh] overflow-y-auto">
          {showEodSummary && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center flex items-center justify-center gap-2">
                  <Sun className="w-5 h-5 text-amber-500" />
                  END-OF-DAY SUMMARY
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Header */}
                <div className="text-center border-b border-slate-200 pb-4">
                  <h3 className="font-bold text-xl">{DEMO_BUSINESS.name}</h3>
                  <p className="text-sm text-slate-500">Date: {showEodSummary.date}</p>
                  <p className="text-xs text-slate-500">Generated: {new Date(showEodSummary.generatedAt).toLocaleString()}</p>
                  <p className="text-xs text-slate-500">By: {showEodSummary.generatedBy}</p>
                </div>

                {/* Shift Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{showEodSummary.totalShifts}</p>
                    <p className="text-xs text-slate-500">Total Shifts</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{showEodSummary.closedShifts}</p>
                    <p className="text-xs text-slate-500">Closed</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">{showEodSummary.activeShifts}</p>
                    <p className="text-xs text-slate-500">Active</p>
                  </div>
                </div>

                <Tabs defaultValue="sales">
                  <TabsList className="grid grid-cols-3 bg-slate-100">
                    <TabsTrigger value="sales">Sales</TabsTrigger>
                    <TabsTrigger value="payments">Payments</TabsTrigger>
                    <TabsTrigger value="cashiers">Cashiers</TabsTrigger>
                  </TabsList>

                  <TabsContent value="sales" className="space-y-4">
                    {/* Sales Summary */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-emerald-50 rounded-lg p-4">
                        <p className="text-sm text-slate-500">Net Sales</p>
                        <p className="text-2xl font-bold text-emerald-600">{formatCurrency(showEodSummary.netSales)}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-sm text-slate-500">Transactions</p>
                        <p className="text-2xl font-bold text-blue-600">{showEodSummary.totalTransactions}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-sm border-b border-slate-200 pb-1">Sales Breakdown</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Gross Sales:</span>
                          <span>{formatCurrency(showEodSummary.grossSales)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Tax (VAT):</span>
                          <span>{formatCurrency(showEodSummary.taxTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Discounts:</span>
                          <span className="text-amber-600">-{formatCurrency(showEodSummary.discountTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Refunds:</span>
                          <span className="text-red-600">-{formatCurrency(showEodSummary.refundTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Avg Transaction:</span>
                          <span>{formatCurrency(showEodSummary.averageTransaction)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Items Sold:</span>
                          <span>{showEodSummary.totalItems}</span>
                        </div>
                      </div>
                    </div>

                    {/* Hourly Chart */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm border-b border-slate-200 pb-1">Hourly Sales</h4>
                      <div className="h-32 flex items-end gap-1">
                        {showEodSummary.hourlySales.map((h, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center">
                            <div 
                              className="w-full bg-blue-400 rounded-t"
                              style={{ 
                                height: `${Math.max(4, (h.sales / Math.max(...showEodSummary.hourlySales.map(x => x.sales))) * 100)}%`,
                                opacity: h.sales > 0 ? 1 : 0.2
                              }}
                            />
                            <span className="text-[10px] text-slate-400">{i}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="payments" className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm border-b border-slate-200 pb-1">Payment Methods</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                          <span className="text-slate-600">Cash</span>
                          <span className="font-medium">{formatCurrency(showEodSummary.payments.cash)}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                          <span className="text-slate-600">M-Pesa</span>
                          <span className="font-medium">{formatCurrency(showEodSummary.payments.mpesa)}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                          <span className="text-slate-600">Card</span>
                          <span className="font-medium">{formatCurrency(showEodSummary.payments.card)}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-slate-100 rounded font-medium">
                          <span>Total</span>
                          <span className="text-emerald-600">{formatCurrency(showEodSummary.payments.total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Cash Summary */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm border-b border-slate-200 pb-1">Cash Summary</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Opening Cash:</span>
                          <span>{formatCurrency(showEodSummary.totalOpeningCash)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Closing Cash:</span>
                          <span>{formatCurrency(showEodSummary.totalClosingCash)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Expected Cash:</span>
                          <span>{formatCurrency(showEodSummary.totalExpectedCash)}</span>
                        </div>
                        <div className={`flex justify-between ${showEodSummary.totalCashDifference === 0 ? 'text-emerald-600' : showEodSummary.totalCashDifference > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          <span>Difference:</span>
                          <span className="font-medium">{showEodSummary.totalCashDifference > 0 ? '+' : ''}{formatCurrency(showEodSummary.totalCashDifference)}</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="cashiers" className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm border-b border-slate-200 pb-1">Per-Cashier Performance</h4>
                      {showEodSummary.cashierSummaries.length === 0 ? (
                        <p className="text-center text-slate-500 py-4">No cashier data available</p>
                      ) : (
                        <div className="space-y-2">
                          {showEodSummary.cashierSummaries.map((cashier) => (
                            <div key={cashier.userId} className="bg-slate-50 rounded-lg p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{cashier.userName}</p>
                                  <p className="text-xs text-slate-500">{cashier.shiftCount} shift(s)</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-medium text-emerald-600">{formatCurrency(cashier.salesTotal)}</p>
                                  <p className="text-xs text-slate-500">{cashier.transactionCount} transactions</p>
                                </div>
                              </div>
                              <div className="flex gap-4 mt-2 text-xs">
                                <span className="text-red-600">{cashier.voidCount} voids</span>
                                <span className="text-amber-600">{cashier.refundCount} refunds</span>
                                <span className={cashier.cashDifference === 0 ? 'text-emerald-600' : cashier.cashDifference > 0 ? 'text-emerald-600' : 'text-red-600'}>
                                  {cashier.cashDifference > 0 ? '+' : ''}{formatCurrency(cashier.cashDifference)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Reconciliation Status */}
                <div className={`rounded-lg p-4 text-center ${showEodSummary.isReconciled ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                  <div className="flex items-center justify-center gap-2">
                    {showEodSummary.isReconciled ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                        <span className="font-medium text-emerald-700">✓ Day Fully Reconciled</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-amber-600" />
                        <span className="font-medium text-amber-700">⚠️ Reconciliation Pending</span>
                      </>
                    )}
                  </div>
                  {!showEodSummary.isReconciled && (
                    <p className="text-xs text-amber-600 mt-1">
                      {showEodSummary.activeShifts} active shift(s) need to be closed
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => window.print()}
                    className="flex-1 border-slate-700"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      const dataStr = JSON.stringify(showEodSummary, null, 2);
                      const blob = new Blob([dataStr], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `eod-${showEodSummary.date}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex-1 border-slate-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                  <Button onClick={() => setShowEodSummary(null)} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Done
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
