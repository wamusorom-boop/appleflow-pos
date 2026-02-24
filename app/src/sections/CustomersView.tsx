/**
 * AppleFlow POS - Customers View
 * Customer management and loyalty program
 */

import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, User, Phone, Mail, Award, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { getCustomers, saveCustomers, formatCurrency } from '@/lib/data';
import type { Customer, CustomerTier } from '@/types';

const tierColors: Record<CustomerTier, string> = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  platinum: '#e5e4e2',
};

const tierBenefits: Record<CustomerTier, string[]> = {
  bronze: ['Earn 1 point per KES 100 spent'],
  silver: ['Earn 1.5 points per KES 100 spent', '2% discount on purchases'],
  gold: ['Earn 2 points per KES 100 spent', '5% discount on purchases', 'Priority service'],
  platinum: ['Earn 3 points per KES 100 spent', '10% discount on purchases', 'Priority service', 'Exclusive offers'],
};

export function CustomersView() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showDetails, setShowDetails] = useState<Customer | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    tier: 'bronze' as CustomerTier,
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = () => {
    setCustomers(getCustomers());
  };

  const filteredCustomers = customers.filter(customer => 
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone.includes(searchQuery) ||
    (customer.email && customer.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const customerData: Customer = {
      id: editingCustomer ? editingCustomer.id : 'cust' + Date.now(),
      name: formData.name,
      phone: formData.phone,
      email: formData.email || undefined,
      tier: formData.tier,
      points: editingCustomer ? editingCustomer.points : 0,
      totalSpent: editingCustomer ? editingCustomer.totalSpent : 0,
      creditBalance: editingCustomer ? editingCustomer.creditBalance : 0,
      isActive: true,
      createdAt: editingCustomer ? editingCustomer.createdAt : new Date().toISOString(),
    };

    let updatedCustomers;
    if (editingCustomer) {
      updatedCustomers = customers.map(c => c.id === editingCustomer.id ? customerData : c);
      toast.success('Customer updated successfully');
    } else {
      updatedCustomers = [...customers, customerData];
      toast.success('Customer added successfully');
    }

    saveCustomers(updatedCustomers);
    setCustomers(updatedCustomers);
    setShowAddDialog(false);
    setEditingCustomer(null);
    resetForm();
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      tier: customer.tier,
    });
    setShowAddDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      tier: 'bronze',
    });
  };

  // Stats
  const totalCustomers = customers.filter(c => c.isActive).length;
  const totalPoints = customers.reduce((sum, c) => sum + c.points, 0);
  const totalSpent = customers.reduce((sum, c) => sum + c.totalSpent, 0);

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
        <h1 className="text-xl font-bold text-slate-200">Customers & Loyalty</h1>
        <Button 
          onClick={() => { setEditingCustomer(null); resetForm(); setShowAddDialog(true); }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 p-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Customers</p>
                <p className="text-2xl font-bold text-slate-200">{totalCustomers}</p>
              </div>
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Points Issued</p>
                <p className="text-2xl font-bold text-amber-400">{totalPoints.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Spent</p>
                <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalSpent)}</p>
              </div>
              <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="px-4 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customers by name, phone, or email..."
            className="pl-10 bg-slate-900 border-slate-700 text-slate-200"
          />
        </div>
      </div>

      {/* Customers Grid */}
      <ScrollArea className="flex-1 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.filter(c => c.isActive).map(customer => (
            <Card 
              key={customer.id} 
              className="bg-slate-900 border-slate-800 hover:border-slate-700 cursor-pointer transition-all"
              onClick={() => setShowDetails(customer)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-600 rounded-full flex items-center justify-center">
                    <span className="text-lg font-medium text-slate-300">
                      {customer.name.charAt(0)}
                    </span>
                  </div>
                  <Badge 
                    className="text-xs"
                    style={{ 
                      backgroundColor: tierColors[customer.tier] + '30', 
                      color: tierColors[customer.tier],
                      borderColor: tierColors[customer.tier],
                    }}
                  >
                    {customer.tier.toUpperCase()}
                  </Badge>
                </div>
                
                <h3 className="font-medium text-slate-200 mb-1">{customer.name}</h3>
                <div className="space-y-1 text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {customer.phone}
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {customer.email}
                    </div>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Points</p>
                    <p className="text-lg font-bold text-amber-400">{customer.points}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Spent</p>
                    <p className="text-lg font-bold text-emerald-400">{formatCurrency(customer.totalSpent)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Full Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-200"
                required
              />
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-1 block">Phone Number *</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-200"
                placeholder="e.g., 0712345678"
                required
              />
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-1 block">Email Address</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-200"
              />
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-1 block">Loyalty Tier</label>
              <select
                value={formData.tier}
                onChange={(e) => setFormData({ ...formData, tier: e.target.value as CustomerTier })}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-slate-200"
              >
                <option value="bronze">Bronze</option>
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
                <option value="platinum">Platinum</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                className="flex-1 border-slate-700 text-slate-400"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {editingCustomer ? 'Update Customer' : 'Add Customer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Details Dialog */}
      <Dialog open={!!showDetails} onOpenChange={() => setShowDetails(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-md">
          {showDetails && (
            <>
              <DialogHeader>
                <DialogTitle>Customer Details</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6">
                <div className="text-center">
                  <div 
                    className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center"
                    style={{ backgroundColor: tierColors[showDetails.tier] + '30' }}
                  >
                    <span 
                      className="text-2xl font-bold"
                      style={{ color: tierColors[showDetails.tier] }}
                    >
                      {showDetails.name.charAt(0)}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-200">{showDetails.name}</h3>
                  <Badge 
                    className="mt-2"
                    style={{ 
                      backgroundColor: tierColors[showDetails.tier] + '30', 
                      color: tierColors[showDetails.tier],
                    }}
                  >
                    {showDetails.tier.toUpperCase()} MEMBER
                  </Badge>
                </div>

                <div className="space-y-3 bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-slate-500" />
                    <span>{showDetails.phone}</span>
                  </div>
                  {showDetails.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-slate-500" />
                      <span>{showDetails.email}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                    <Award className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-amber-400">{showDetails.points}</p>
                    <p className="text-xs text-slate-500">Loyalty Points</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                    <TrendingUp className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-emerald-400">{formatCurrency(showDetails.totalSpent)}</p>
                    <p className="text-xs text-slate-500">Total Spent</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Tier Benefits</h4>
                  <ul className="space-y-1">
                    {tierBenefits[showDetails.tier].map((benefit, idx) => (
                      <li key={idx} className="text-sm text-slate-300 flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: tierColors[showDetails.tier] }}
                        />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowDetails(null)}
                    className="flex-1 border-slate-700 text-slate-400"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => { setShowDetails(null); handleEdit(showDetails); }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
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
