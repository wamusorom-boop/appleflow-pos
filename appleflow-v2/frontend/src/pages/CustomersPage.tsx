import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  DollarSign,
  Calendar,
  X,
  User,
  History,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  loyalty_points: number;
  total_purchases: number;
  total_spent: number;
  last_purchase_date: string | null;
  created_at: string;
  is_active: boolean;
}

interface CustomerFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
}

const initialFormData: CustomerFormData = {
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
};

export function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', { search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      const response = await api.get(`/customers?${params}`);
      return response.data;
    },
  });

  const { data: customerHistory } = useQuery({
    queryKey: ['customer-history', selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer) return null;
      const response = await api.get(`/customers/${selectedCustomer.id}/history`);
      return response.data;
    },
    enabled: !!selectedCustomer && isDetailModalOpen,
  });

  const createMutation = useMutation({
    mutationFn: (data: CustomerFormData) => api.post('/customers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsModalOpen(false);
      setFormData(initialFormData);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CustomerFormData }) =>
      api.put(`/customers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsModalOpen(false);
      setEditingCustomer(null);
      setFormData(initialFormData);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        city: customer.city || '',
      });
    } else {
      setEditingCustomer(null);
      setFormData(initialFormData);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (customer: Customer) => {
    if (confirm(`Are you sure you want to delete ${customer.name}?`)) {
      deleteMutation.mutate(customer.id);
    }
  };

  const handleViewDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailModalOpen(true);
  };

  const totalCustomers = customers?.data?.length || 0;
  const activeCustomers = customers?.data?.filter((c: Customer) => c.is_active).length || 0;
  const totalSpent = customers?.data?.reduce((sum: number, c: Customer) => sum + c.total_spent, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">Manage your customer database</p>
        </div>
        <Button onClick={() => handleOpenModal()} leftIcon={<Plus className="w-4 h-4" />}>
          Add Customer
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Customers</p>
              <p className="text-xl font-bold text-gray-900">{totalCustomers}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <User className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Customers</p>
              <p className="text-xl font-bold text-gray-900">{activeCustomers}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalSpent)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name, phone, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Customers Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : customers?.data?.length === 0 ? (
        <Card className="p-12 text-center">
          <User className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No customers yet</h3>
          <p className="text-gray-500 mb-4">Start building your customer database</p>
          <Button onClick={() => handleOpenModal()} leftIcon={<Plus className="w-4 h-4" />}>
            Add First Customer
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers?.data?.map((customer: Customer) => (
            <Card key={customer.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium">
                      {customer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{customer.name}</h3>
                    {customer.phone && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {customer.phone}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant={customer.is_active ? 'success' : 'secondary'}>
                  {customer.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="space-y-2 mb-4">
                {customer.email && (
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    {customer.email}
                  </p>
                )}
                {customer.address && (
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {customer.address}
                    {customer.city && `, ${customer.city}`}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500">Purchases</p>
                  <p className="font-medium text-gray-900">{customer.total_purchases}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Spent</p>
                  <p className="font-medium text-gray-900">
                    {formatCurrency(customer.total_spent)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Loyalty Points</p>
                  <p className="font-medium text-blue-600">{customer.loyalty_points}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Purchase</p>
                  <p className="font-medium text-gray-900">
                    {customer.last_purchase_date
                      ? formatDate(customer.last_purchase_date)
                      : 'Never'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewDetails(customer)}
                  className="flex-1"
                  leftIcon={<History className="w-4 h-4" />}
                >
                  History
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenModal(customer)}
                  leftIcon={<Edit2 className="w-4 h-4" />}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(customer)}
                  leftIcon={<Trash2 className="w-4 h-4 text-red-500" />}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? 'Edit Customer' : 'Add Customer'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Customer name"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Email address"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Street address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <Input
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="City"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
              className="flex-1"
            >
              {editingCustomer ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Customer Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={selectedCustomer?.name}
        size="lg"
      >
        {selectedCustomer && (
          <div className="space-y-6">
            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{selectedCustomer.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{selectedCustomer.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium">
                  {selectedCustomer.address
                    ? `${selectedCustomer.address}${selectedCustomer.city ? `, ${selectedCustomer.city}` : ''}`
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Customer Since</p>
                <p className="font-medium">{formatDate(selectedCustomer.created_at)}</p>
              </div>
            </div>

            {/* Purchase History */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                Purchase History
              </h4>
              {customerHistory?.purchases?.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No purchase history</p>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Receipt</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {customerHistory?.purchases?.map((purchase: any) => (
                      <tr key={purchase.id}>
                        <td className="px-3 py-2 text-sm">
                          {formatDate(purchase.created_at)}
                        </td>
                        <td className="px-3 py-2 text-sm font-mono">
                          {purchase.receipt_number}
                        </td>
                        <td className="px-3 py-2 text-sm text-right font-medium">
                          {formatCurrency(purchase.final_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {selectedCustomer.total_purchases}
                </p>
                <p className="text-sm text-blue-700">Total Purchases</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(selectedCustomer.total_spent)}
                </p>
                <p className="text-sm text-green-700">Total Spent</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {selectedCustomer.loyalty_points}
                </p>
                <p className="text-sm text-purple-700">Loyalty Points</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
