/**
 * AppleFlow POS - Products View
 * Advanced product and inventory management with weighted/serialized products
 */

import { useState, useEffect } from 'react';
import { 
  Search, Plus, Edit2, Trash2, Package, AlertTriangle, Scale, Hash,
  ChevronDown, ChevronUp, Truck, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  getProducts, getCategories, getSuppliers, saveProducts, saveSuppliers,
  formatCurrency, addAuditLog, checkStockAlerts
} from '@/lib/data';
import type { Product, Supplier } from '@/types';

export function ProductsView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('products');
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    description: '',
    categoryId: '',
    unit: 'piece',
    productType: 'standard' as 'standard' | 'weighted' | 'serialized',
    weightUnit: 'kg' as 'kg' | 'g' | 'lb' | 'oz',
    costPrice: '',
    sellingPrice: '',
    quantity: '',
    minStockLevel: '',
    reorderPoint: '',
    vatRate: '16',
    supplierId: '',
    trackInventory: true,
    allowBackorders: false,
    serialNumbers: '',
  });

  // Supplier form
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    kraPin: '',
    paymentTerms: 'Net 30',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setProducts(getProducts());
    setCategories(getCategories());
    setSuppliers(getSuppliers());
  };

  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.barcode && product.barcode.includes(searchQuery))
  );

  const lowStockProducts = products.filter(p => p.quantity <= p.minStockLevel && p.isActive);
  const outOfStockProducts = products.filter(p => p.quantity === 0 && p.isActive);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const category = categories.find(c => c.id === formData.categoryId);
    if (!category) {
      toast.error('Please select a category');
      return;
    }

    const productData: Product = {
      id: editingProduct ? editingProduct.id : 'p' + Date.now(),
      name: formData.name,
      sku: formData.sku,
      barcode: formData.barcode || undefined,
      description: formData.description,
      category,
      unit: formData.unit,
      productType: formData.productType as 'standard' | 'weighted' | 'serialized',
      weightUnit: formData.productType === 'weighted' ? formData.weightUnit : undefined,
      costPrice: parseFloat(formData.costPrice) || 0,
      sellingPrice: parseFloat(formData.sellingPrice) || 0,
      quantity: parseFloat(formData.quantity) || 0,
      minStockLevel: parseFloat(formData.minStockLevel) || 10,
      reorderPoint: parseFloat(formData.reorderPoint) || 15,
      vatRate: parseFloat(formData.vatRate) || 16,
      isVatInclusive: true,
      isActive: true,
      supplierId: formData.supplierId || undefined,
      trackInventory: formData.trackInventory,
      allowBackorders: formData.allowBackorders,
      serialNumbers: formData.productType === 'serialized' && formData.serialNumbers 
        ? formData.serialNumbers.split(',').map(s => s.trim()).filter(Boolean)
        : undefined,
      createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let updatedProducts;
    if (editingProduct) {
      updatedProducts = products.map(p => p.id === editingProduct.id ? productData : p);
      addAuditLog('product_updated', 'product', productData.id, `Updated product: ${productData.name}`);
      toast.success('Product updated successfully');
    } else {
      updatedProducts = [...products, productData];
      addAuditLog('product_created', 'product', productData.id, `Created product: ${productData.name}`);
      toast.success('Product added successfully');
    }

    saveProducts(updatedProducts);
    setProducts(updatedProducts);
    setShowAddDialog(false);
    setEditingProduct(null);
    resetForm();
    
    // Check for stock alerts
    checkStockAlerts();
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      description: product.description,
      categoryId: product.category.id,
      unit: product.unit,
      productType: product.productType,
      weightUnit: product.weightUnit || 'kg',
      costPrice: product.costPrice.toString(),
      sellingPrice: product.sellingPrice.toString(),
      quantity: product.quantity.toString(),
      minStockLevel: product.minStockLevel.toString(),
      reorderPoint: product.reorderPoint.toString(),
      vatRate: product.vatRate.toString(),
      supplierId: product.supplierId || '',
      trackInventory: product.trackInventory,
      allowBackorders: product.allowBackorders,
      serialNumbers: product.serialNumbers?.join(', ') || '',
    });
    setShowAddDialog(true);
  };

  const handleDelete = (productId: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      const updatedProducts = products.map(p => 
        p.id === productId ? { ...p, isActive: false } : p
      );
      saveProducts(updatedProducts);
      setProducts(updatedProducts);
      addAuditLog('product_deleted', 'product', productId, 'Product deactivated');
      toast.success('Product deleted');
    }
  };

  const handleAddSupplier = () => {
    if (!supplierForm.name.trim()) {
      toast.error('Supplier name is required');
      return;
    }

    const newSupplier: Supplier = {
      id: 'sup-' + Date.now(),
      name: supplierForm.name,
      contactPerson: supplierForm.contactPerson,
      phone: supplierForm.phone,
      email: supplierForm.email,
      address: supplierForm.address,
      kraPin: supplierForm.kraPin,
      paymentTerms: supplierForm.paymentTerms,
      isActive: true,
    };

    const updatedSuppliers = [...suppliers, newSupplier];
    saveSuppliers(updatedSuppliers);
    setSuppliers(updatedSuppliers);
    setShowSupplierDialog(false);
    setSupplierForm({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      kraPin: '',
      paymentTerms: 'Net 30',
    });
    toast.success('Supplier added');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      description: '',
      categoryId: '',
      unit: 'piece',
      productType: 'standard',
      weightUnit: 'kg',
      costPrice: '',
      sellingPrice: '',
      quantity: '',
      minStockLevel: '',
      reorderPoint: '',
      vatRate: '16',
      supplierId: '',
      trackInventory: true,
      allowBackorders: false,
      serialNumbers: '',
    });
  };

  const getProductTypeIcon = (type: string) => {
    switch (type) {
      case 'weighted': return <Scale className="w-4 h-4" />;
      case 'serialized': return <Hash className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
        <h1 className="text-xl font-bold text-slate-200">Products & Inventory</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => setShowSupplierDialog(true)}
            className="border-slate-700 text-slate-400"
          >
            <Truck className="w-4 h-4 mr-2" />
            Add Supplier
          </Button>
          <Button 
            onClick={() => { setEditingProduct(null); resetForm(); setShowAddDialog(true); }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-6 mt-4 bg-slate-900 border border-slate-800 w-auto">
          <TabsTrigger value="products" className="data-[state=active]:bg-emerald-600">Products</TabsTrigger>
          <TabsTrigger value="suppliers" className="data-[state=active]:bg-emerald-600">Suppliers</TabsTrigger>
          <TabsTrigger value="alerts" className="data-[state=active]:bg-emerald-600">
            Alerts
            {(lowStockProducts.length + outOfStockProducts.length) > 0 && (
              <Badge className="ml-2 bg-red-500 text-white">{lowStockProducts.length + outOfStockProducts.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="flex-1 flex flex-col m-0">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 p-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Total Products</p>
                    <p className="text-2xl font-bold text-slate-200">{products.filter(p => p.isActive).length}</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Low Stock</p>
                    <p className="text-2xl font-bold text-amber-400">{lowStockProducts.length}</p>
                  </div>
                  <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Out of Stock</p>
                    <p className="text-2xl font-bold text-red-400">{outOfStockProducts.length}</p>
                  </div>
                  <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Inventory Value</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {formatCurrency(products.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0))}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-emerald-400" />
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
                placeholder="Search products by name, SKU, or barcode..."
                className="pl-10 bg-slate-900 border-slate-700 text-slate-200"
              />
            </div>
          </div>

          {/* Products Table */}
          <ScrollArea className="flex-1 px-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Product</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Type</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">SKU</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Price</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Stock</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredProducts.filter(p => p.isActive).map(product => (
                    <>
                      <tr key={product.id} className="hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                              className="text-slate-500 hover:text-slate-300"
                            >
                              {expandedProduct === product.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <div>
                              <p className="font-medium text-slate-200">{product.name}</p>
                              <p className="text-xs text-slate-500">{product.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-slate-400">
                            {getProductTypeIcon(product.productType)}
                            <span className="text-xs capitalize">{product.productType}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{product.sku}</td>
                        <td className="px-4 py-3 text-right text-emerald-400">
                          {formatCurrency(product.sellingPrice)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium ${
                            product.quantity <= product.minStockLevel 
                              ? 'text-red-400' 
                              : 'text-slate-300'
                          }`}>
                            {product.quantity} {product.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(product)}
                              className="text-slate-400 hover:text-emerald-400"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(product.id)}
                              className="text-slate-400 hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedProduct === product.id && (
                        <tr className="bg-slate-800/30">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="grid grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-slate-500">Cost Price</p>
                                <p className="text-slate-300">{formatCurrency(product.costPrice)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">Barcode</p>
                                <p className="text-slate-300">{product.barcode || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">VAT Rate</p>
                                <p className="text-slate-300">{product.vatRate}%</p>
                              </div>
                              <div>
                                <p className="text-slate-500">Reorder Point</p>
                                <p className="text-slate-300">{product.reorderPoint} {product.unit}</p>
                              </div>
                              {product.serialNumbers && product.serialNumbers.length > 0 && (
                                <div className="col-span-4">
                                  <p className="text-slate-500">Serial Numbers</p>
                                  <p className="text-slate-300 text-xs">{product.serialNumbers.join(', ')}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="suppliers" className="flex-1 m-0">
          <ScrollArea className="h-full p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suppliers.map(supplier => (
                <Card key={supplier.id} className="bg-slate-900 border-slate-800">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <Truck className="w-5 h-5 text-blue-400" />
                      </div>
                      <Badge className="bg-slate-800 text-slate-400">{supplier.paymentTerms}</Badge>
                    </div>
                    <h3 className="font-medium text-slate-200 mb-1">{supplier.name}</h3>
                    <p className="text-sm text-slate-500 mb-2">{supplier.contactPerson}</p>
                    <div className="space-y-1 text-sm text-slate-400">
                      <p>{supplier.phone}</p>
                      {supplier.email && <p>{supplier.email}</p>}
                    </div>
                    {supplier.kraPin && (
                      <p className="text-xs text-slate-500 mt-2">KRA: {supplier.kraPin}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="alerts" className="flex-1 m-0">
          <ScrollArea className="h-full p-4">
            <div className="space-y-4">
              {outOfStockProducts.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-red-400 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Out of Stock ({outOfStockProducts.length})
                  </h3>
                  <div className="space-y-2">
                    {outOfStockProducts.map(product => (
                      <div key={product.id} className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div>
                          <p className="font-medium text-slate-200">{product.name}</p>
                          <p className="text-sm text-slate-500">{product.sku}</p>
                        </div>
                        <Button size="sm" variant="outline" className="border-red-500/50 text-red-400">
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Reorder
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lowStockProducts.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-amber-400 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Low Stock ({lowStockProducts.length})
                  </h3>
                  <div className="space-y-2">
                    {lowStockProducts.map(product => (
                      <div key={product.id} className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <div>
                          <p className="font-medium text-slate-200">{product.name}</p>
                          <p className="text-sm text-slate-500">
                            {product.quantity} {product.unit} remaining (min: {product.minStockLevel})
                          </p>
                        </div>
                        <Button size="sm" variant="outline" className="border-amber-500/50 text-amber-400">
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Reorder
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {outOfStockProducts.length === 0 && lowStockProducts.length === 0 && (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500">No stock alerts</p>
                  <p className="text-sm text-slate-600">All products have adequate inventory</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Product Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Product Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-slate-200"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">SKU *</label>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-slate-200"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Barcode</label>
                <Input
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-slate-200"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Product Type</label>
                <select
                  value={formData.productType}
                  onChange={(e) => setFormData({ ...formData, productType: e.target.value as any })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-slate-200"
                >
                  <option value="standard">Standard</option>
                  <option value="weighted">Weighted</option>
                  <option value="serialized">Serialized</option>
                </select>
              </div>
            </div>

            {formData.productType === 'weighted' && (
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Weight Unit</label>
                <select
                  value={formData.weightUnit}
                  onChange={(e) => setFormData({ ...formData, weightUnit: e.target.value as any })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-slate-200"
                >
                  <option value="kg">Kilograms (kg)</option>
                  <option value="g">Grams (g)</option>
                  <option value="lb">Pounds (lb)</option>
                  <option value="oz">Ounces (oz)</option>
                </select>
              </div>
            )}

            {formData.productType === 'serialized' && (
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Serial Numbers (comma separated)</label>
                <textarea
                  value={formData.serialNumbers}
                  onChange={(e) => setFormData({ ...formData, serialNumbers: e.target.value })}
                  placeholder="SN001, SN002, SN003..."
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm"
                />
              </div>
            )}

            <div>
              <label className="text-sm text-slate-400 mb-1 block">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Category *</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-slate-200"
                  required
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Unit</label>
                <Input
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Cost Price (KES)</label>
                <Input
                  type="number"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-slate-200"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Selling Price (KES) *</label>
                <Input
                  type="number"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-slate-200"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Quantity *</label>
                <Input
                  type="number"
                  step={formData.productType === 'weighted' ? '0.01' : '1'}
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-slate-200"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Min Stock Level</label>
                <Input
                  type="number"
                  value={formData.minStockLevel}
                  onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-slate-200"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Reorder Point</label>
                <Input
                  type="number"
                  value={formData.reorderPoint}
                  onChange={(e) => setFormData({ ...formData, reorderPoint: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">VAT Rate (%)</label>
                <Input
                  type="number"
                  value={formData.vatRate}
                  onChange={(e) => setFormData({ ...formData, vatRate: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-slate-200"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Supplier</label>
                <select
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-slate-200"
                >
                  <option value="">No supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-400">
                <input
                  type="checkbox"
                  checked={formData.trackInventory}
                  onChange={(e) => setFormData({ ...formData, trackInventory: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700"
                />
                Track Inventory
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-400">
                <input
                  type="checkbox"
                  checked={formData.allowBackorders}
                  onChange={(e) => setFormData({ ...formData, allowBackorders: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700"
                />
                Allow Backorders
              </label>
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
                {editingProduct ? 'Update Product' : 'Add Product'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Supplier Dialog */}
      <Dialog open={showSupplierDialog} onOpenChange={setShowSupplierDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={supplierForm.name}
              onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
              placeholder="Supplier Name *"
              className="bg-slate-800 border-slate-700 text-slate-200"
            />
            <Input
              value={supplierForm.contactPerson}
              onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
              placeholder="Contact Person"
              className="bg-slate-800 border-slate-700 text-slate-200"
            />
            <Input
              value={supplierForm.phone}
              onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
              placeholder="Phone Number *"
              className="bg-slate-800 border-slate-700 text-slate-200"
            />
            <Input
              value={supplierForm.email}
              onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
              placeholder="Email Address"
              className="bg-slate-800 border-slate-700 text-slate-200"
            />
            <Input
              value={supplierForm.address}
              onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
              placeholder="Address"
              className="bg-slate-800 border-slate-700 text-slate-200"
            />
            <Input
              value={supplierForm.kraPin}
              onChange={(e) => setSupplierForm({ ...supplierForm, kraPin: e.target.value })}
              placeholder="KRA PIN"
              className="bg-slate-800 border-slate-700 text-slate-200"
            />
            <select
              value={supplierForm.paymentTerms}
              onChange={(e) => setSupplierForm({ ...supplierForm, paymentTerms: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-slate-200"
            >
              <option value="Net 30">Net 30</option>
              <option value="Net 15">Net 15</option>
              <option value="Net 7">Net 7</option>
              <option value="Prepaid">Prepaid</option>
              <option value="COD">Cash on Delivery</option>
            </select>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowSupplierDialog(false)} className="flex-1 border-slate-700">
                Cancel
              </Button>
              <Button onClick={handleAddSupplier} className="flex-1 bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Supplier
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
