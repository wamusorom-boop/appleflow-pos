import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit2,
  Trash2,
  User,
  Shield,
  Store,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  Lock,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { useAuthStore } from '../store/authStore';

interface UserData {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  store_name: string | null;
}

interface UserFormData {
  email: string;
  full_name: string;
  phone: string;
  role: string;
  store_id: string;
  pin: string;
}

const roles = [
  { value: 'cashier', label: 'Cashier', description: 'Can process sales and view basic reports' },
  { value: 'supervisor', label: 'Supervisor', description: 'Can manage inventory and view all reports' },
  { value: 'manager', label: 'Manager', description: 'Can manage products, users, and settings' },
  { value: 'tenant_admin', label: 'Admin', description: 'Full access to tenant resources' },
];

const initialFormData: UserFormData = {
  email: '',
  full_name: '',
  phone: '',
  role: 'cashier',
  store_id: '',
  pin: '',
};

export function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', { search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      const response = await api.get(`/users?${params}`);
      return response.data;
    },
  });

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const response = await api.get('/stores');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: UserFormData) => api.post('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsModalOpen(false);
      setFormData(initialFormData);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserFormData> }) =>
      api.put(`/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsModalOpen(false);
      setEditingUser(null);
      setFormData(initialFormData);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/users/${id}/status`, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const handleOpenModal = (user?: UserData) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        full_name: user.full_name,
        phone: user.phone || '',
        role: user.role,
        store_id: '',
        pin: '',
      });
    } else {
      setEditingUser(null);
      setFormData(initialFormData);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      const { pin, ...updateData } = formData;
      updateMutation.mutate({
        id: editingUser.id,
        data: pin ? formData : updateData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleToggleStatus = (user: UserData) => {
    const action = user.is_active ? 'deactivate' : 'activate';
    if (confirm(`Are you sure you want to ${action} ${user.full_name}?`)) {
      toggleStatusMutation.mutate({ id: user.id, isActive: !user.is_active });
    }
  };

  const handleDelete = (user: UserData) => {
    if (confirm(`Are you sure you want to delete ${user.full_name}? This action cannot be undone.`)) {
      deleteMutation.mutate(user.id);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'tenant_admin':
        return 'purple';
      case 'manager':
        return 'blue';
      case 'supervisor':
        return 'orange';
      case 'cashier':
        return 'green';
      default:
        return 'default';
    }
  };

  const totalUsers = users?.data?.length || 0;
  const activeUsers = users?.data?.filter((u: UserData) => u.is_active).length || 0;

  const canManageUsers = currentUser?.role === 'tenant_admin' || currentUser?.role === 'manager';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">Manage staff accounts and permissions</p>
        </div>
        {canManageUsers && (
          <Button onClick={() => handleOpenModal()} leftIcon={<Plus className="w-4 h-4" />}>
            Add User
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Users</p>
              <p className="text-xl font-bold text-gray-900">{totalUsers}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Users</p>
              <p className="text-xl font-bold text-gray-900">{activeUsers}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Your Role</p>
              <p className="text-xl font-bold text-gray-900 capitalize">
                {currentUser?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : users?.data?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <User className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p>No users found</p>
                  </td>
                </tr>
              ) : (
                users?.data?.map((user: UserData) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-medium">
                            {user.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.full_name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                          {user.phone && (
                            <p className="text-xs text-gray-400">{user.phone}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getRoleBadgeColor(user.role) as any}>
                        {user.role.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {user.store_name || 'All Stores'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleStatus(user)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                          user.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {user.is_active ? (
                          <><CheckCircle className="w-3 h-3" /> Active</>
                        ) : (
                          <><XCircle className="w-3 h-3" /> Inactive</>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {user.last_login_at ? formatDate(user.last_login_at) : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {canManageUsers && user.id !== currentUser?.id && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenModal(user)}
                              leftIcon={<Edit2 className="w-4 h-4" />}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(user)}
                              leftIcon={<Trash2 className="w-4 h-4 text-red-500" />}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? 'Edit User' : 'Add User'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                leftIcon={<Mail className="w-4 h-4" />}
                required
                disabled={!!editingUser}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+254 700 000 000"
                leftIcon={<Phone className="w-4 h-4" />}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {editingUser ? 'New PIN (optional)' : 'PIN'} <span className="text-red-500">*</span>
              </label>
              <Input
                type="password"
                value={formData.pin}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                placeholder="4-6 digit PIN"
                leftIcon={<Lock className="w-4 h-4" />}
                maxLength={6}
                required={!editingUser}
              />
              <p className="text-xs text-gray-500 mt-1">4-6 digits for login</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {roles.find(r => r.value === formData.role)?.description}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign Store</label>
            <select
              value={formData.store_id}
              onChange={(e) => setFormData({ ...formData, store_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Stores</option>
              {stores?.data?.map((store: any) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
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
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
