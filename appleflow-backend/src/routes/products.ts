import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  price: z.number().positive('Price must be positive'),
  costPrice: z.number().nonnegative('Cost price must be non-negative'),
  quantity: z.number().int().nonnegative('Quantity must be non-negative'),
  reorderPoint: z.number().int().nonnegative().default(10),
  reorderQuantity: z.number().int().positive().default(50),
  supplier: z.string().optional(),
  isActive: z.boolean().default(true)
});

// GET /products - List all products
router.get('/', authenticate, async (req, res) => {
  try {
    const { 
      search, 
      category, 
      lowStock, 
      page = '1', 
      limit = '50',
      isActive = 'true'
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { sku: { contains: search as string, mode: 'insensitive' } },
        { barcode: { contains: search as string } }
      ];
    }
    
    if (category) {
      where.category = category as string;
    }
    
    if (lowStock === 'true') {
      where.quantity = { lte: prisma.product.fields.reorderPoint };
    }
    
    if (isActive !== 'all') {
      where.isActive = isActive === 'true';
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { name: 'asc' }
      }),
      prisma.product.count({ where })
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
});

// GET /products/:id - Get single product
router.get('/:id', authenticate, async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product'
    });
  }
});

// POST /products - Create product
router.post('/', authenticate, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const data = productSchema.parse(req.body);

    // Check for duplicate SKU
    const existingSku = await prisma.product.findUnique({
      where: { sku: data.sku }
    });

    if (existingSku) {
      return res.status(409).json({
        success: false,
        error: 'SKU already exists',
        code: 'DUPLICATE_SKU'
      });
    }

    // Check for duplicate barcode if provided
    if (data.barcode) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode: data.barcode }
      });

      if (existingBarcode) {
        return res.status(409).json({
          success: false,
          error: 'Barcode already exists',
          code: 'DUPLICATE_BARCODE'
        });
      }
    }

    const product = await prisma.product.create({
      data: {
        ...data,
        price: Math.round(data.price * 100),
        costPrice: Math.round(data.costPrice * 100)
      }
    });

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create product'
    });
  }
});

// PUT /products/:id - Update product
router.put('/:id', authenticate, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const data = productSchema.partial().parse(req.body);

    const existingProduct = await prisma.product.findUnique({
      where: { id: req.params.id }
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Check for duplicate SKU if changing
    if (data.sku && data.sku !== existingProduct.sku) {
      const duplicateSku = await prisma.product.findUnique({
        where: { sku: data.sku }
      });

      if (duplicateSku) {
        return res.status(409).json({
          success: false,
          error: 'SKU already exists',
          code: 'DUPLICATE_SKU'
        });
      }
    }

    const updateData: any = { ...data };
    if (data.price !== undefined) {
      updateData.price = Math.round(data.price * 100);
    }
    if (data.costPrice !== undefined) {
      updateData.costPrice = Math.round(data.costPrice * 100);
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product'
    });
  }
});

// DELETE /products/:id - Delete product (soft delete)
router.delete('/:id', authenticate, requireRole(['ADMIN']), async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: { saleItems: true }
        }
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    if (product._count.saleItems > 0) {
      // Soft delete - just mark as inactive
      await prisma.product.update({
        where: { id: req.params.id },
        data: { isActive: false }
      });

      return res.json({
        success: true,
        message: 'Product deactivated (has sales history)'
      });
    }

    // Hard delete if no sales
    await prisma.product.delete({
      where: { id: req.params.id }
    });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete product'
    });
  }
});

// GET /products/categories - Get all categories
router.get('/meta/categories', authenticate, async (req, res) => {
  try {
    const categories = await prisma.product.groupBy({
      by: ['category'],
      where: { isActive: true },
      _count: { category: true }
    });

    res.json({
      success: true,
      data: categories.map(c => ({
        name: c.category,
        productCount: c._count.category
      }))
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

export { router as productsRouter };
