/**
 * AppleFlow POS - Input Validation
 * Comprehensive validation for all user inputs
 */

import { sanitizeInput, isValidEmail, isValidPhone, isValidKRAPin, isValidMpesaCode, isValidBarcode } from './security';

// ============================================
// VALIDATION RULES
// ============================================

export interface ValidationRule<T = string> {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: T) => boolean;
  message?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// ============================================
// VALIDATOR FUNCTIONS
// ============================================

export class Validator {
  /**
   * Validate a single value against rules
   */
  static validate<T>(value: T, rules: ValidationRule<T>): ValidationResult {
    const errors: string[] = [];

    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(rules.message || 'This field is required');
      return { isValid: false, errors };
    }

    // Skip other checks if value is empty and not required
    if (!value && !rules.required) {
      return { isValid: true, errors: [] };
    }

    const strValue = String(value);

    // Min length
    if (rules.minLength !== undefined && strValue.length < rules.minLength) {
      errors.push(rules.message || `Minimum ${rules.minLength} characters required`);
    }

    // Max length
    if (rules.maxLength !== undefined && strValue.length > rules.maxLength) {
      errors.push(rules.message || `Maximum ${rules.maxLength} characters allowed`);
    }

    // Min value (for numbers)
    if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
      errors.push(rules.message || `Minimum value is ${rules.min}`);
    }

    // Max value (for numbers)
    if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
      errors.push(rules.message || `Maximum value is ${rules.max}`);
    }

    // Pattern match
    if (rules.pattern && !rules.pattern.test(strValue)) {
      errors.push(rules.message || 'Invalid format');
    }

    // Custom validation
    if (rules.custom && !rules.custom(value)) {
      errors.push(rules.message || 'Invalid value');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate multiple fields
   */
  static validateFields<T extends Record<string, any>>(
    values: T,
    schema: Record<keyof T, ValidationRule>
  ): Record<keyof T, ValidationResult> {
    const results = {} as Record<keyof T, ValidationResult>;

    for (const [field, rules] of Object.entries(schema)) {
      results[field as keyof T] = this.validate(values[field], rules);
    }

    return results;
  }

  /**
   * Check if all validations pass
   */
  static allValid(results: Record<string, ValidationResult>): boolean {
    return Object.values(results).every(r => r.isValid);
  }

  /**
   * Get first error from results
   */
  static getFirstError(results: Record<string, ValidationResult>): string | null {
    for (const result of Object.values(results)) {
      if (!result.isValid && result.errors.length > 0) {
        return result.errors[0];
      }
    }
    return null;
  }
}

// ============================================
// PRE-DEFINED VALIDATION SCHEMAS
// ============================================

export const Schemas = {
  product: {
    name: {
      required: true,
      minLength: 2,
      maxLength: 100,
      message: 'Product name must be 2-100 characters',
    },
    sku: {
      required: true,
      pattern: /^[A-Z0-9\-]{3,20}$/i,
      message: 'SKU must be 3-20 alphanumeric characters',
    },
    barcode: {
      pattern: /^\d{8,13}$/,
      message: 'Barcode must be 8-13 digits',
    },
    sellingPrice: {
      required: true,
      min: 0,
      max: 999999,
      message: 'Price must be between 0 and 999,999',
    },
    costPrice: {
      min: 0,
      max: 999999,
      message: 'Cost must be between 0 and 999,999',
    },
    quantity: {
      required: true,
      min: 0,
      max: 999999,
      message: 'Quantity must be between 0 and 999,999',
    },
    minStockLevel: {
      min: 0,
      max: 999999,
      message: 'Min stock must be between 0 and 999,999',
    },
  },

  customer: {
    name: {
      required: true,
      minLength: 2,
      maxLength: 100,
      message: 'Name must be 2-100 characters',
    },
    email: {
      custom: isValidEmail,
      message: 'Please enter a valid email address',
    },
    phone: {
      custom: isValidPhone,
      message: 'Please enter a valid Kenyan phone number',
    },
    kraPin: {
      custom: isValidKRAPin,
      message: 'Please enter a valid KRA PIN (e.g., A123456789B)',
    },
  },

  sale: {
    items: {
      required: true,
      custom: (items: any[]) => Array.isArray(items) && items.length > 0,
      message: 'At least one item is required',
    },
    total: {
      required: true,
      min: 0,
      message: 'Total must be a positive number',
    },
  },

  user: {
    name: {
      required: true,
      minLength: 2,
      maxLength: 50,
      message: 'Name must be 2-50 characters',
    },
    email: {
      required: true,
      custom: isValidEmail,
      message: 'Please enter a valid email address',
    },
    pin: {
      required: true,
      pattern: /^\d{4,6}$/,
      message: 'PIN must be 4-6 digits',
    },
  },

  supplier: {
    name: {
      required: true,
      minLength: 2,
      maxLength: 100,
      message: 'Supplier name must be 2-100 characters',
    },
    phone: {
      custom: isValidPhone,
      message: 'Please enter a valid phone number',
    },
    email: {
      custom: isValidEmail,
      message: 'Please enter a valid email address',
    },
    kraPin: {
      custom: isValidKRAPin,
      message: 'Please enter a valid KRA PIN',
    },
  },

  expense: {
    description: {
      required: true,
      minLength: 3,
      maxLength: 200,
      message: 'Description must be 3-200 characters',
    },
    amount: {
      required: true,
      min: 0.01,
      max: 9999999,
      message: 'Amount must be between 0.01 and 9,999,999',
    },
    category: {
      required: true,
      message: 'Category is required',
    },
  },

  mpesaCode: {
    required: true,
    custom: isValidMpesaCode,
    message: 'Please enter a valid M-Pesa code (e.g., SHG123XYZ)',
  },

  barcode: {
    required: true,
    custom: isValidBarcode,
    message: 'Please enter a valid barcode (8-13 digits)',
  },
};

// ============================================
// SANITIZATION HELPERS
// ============================================

export function sanitizeProductData(data: any): any {
  return {
    ...data,
    name: sanitizeInput(data.name),
    description: data.description ? sanitizeInput(data.description) : undefined,
    sku: data.sku?.toUpperCase().trim(),
    barcode: data.barcode?.trim(),
    sellingPrice: Math.max(0, Number(data.sellingPrice) || 0),
    costPrice: Math.max(0, Number(data.costPrice) || 0),
    quantity: Math.max(0, Math.floor(Number(data.quantity) || 0)),
  };
}

export function sanitizeCustomerData(data: any): any {
  return {
    ...data,
    name: sanitizeInput(data.name),
    email: data.email?.toLowerCase().trim(),
    phone: data.phone?.trim(),
    address: data.address ? sanitizeInput(data.address) : undefined,
    notes: data.notes ? sanitizeInput(data.notes) : undefined,
  };
}

export function sanitizeSaleData(data: any): any {
  return {
    ...data,
    notes: data.notes ? sanitizeInput(data.notes) : undefined,
    items: data.items?.map((item: any) => ({
      ...item,
      productName: sanitizeInput(item.productName),
    })),
  };
}

// ============================================
// REACT HOOK FOR FORM VALIDATION
// ============================================

import { useState, useCallback } from 'react';

interface UseFormValidationOptions<T> {
  initialValues: T;
  schema: Record<keyof T, ValidationRule>;
  onSubmit?: (values: T) => void | Promise<void>;
}

interface UseFormValidationResult<T> {
  values: T;
  errors: Record<keyof T, string[]>;
  touched: Record<keyof T, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setTouched: (field: keyof T) => void;
  validate: () => boolean;
  validateField: (field: keyof T) => boolean;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  reset: () => void;
}

export function useFormValidation<T extends Record<string, any>>({
  initialValues,
  schema,
  onSubmit,
}: UseFormValidationOptions<T>): UseFormValidationResult<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<keyof T, string[]>>({} as Record<keyof T, string[]>);
  const [touched, setTouchedState] = useState<Record<keyof T, boolean>>({} as Record<keyof T, boolean>);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues(prev => ({ ...prev, [field]: value }));
    
    // Clear error when value changes
    if (errors[field]?.length > 0) {
      setErrors(prev => ({ ...prev, [field]: [] }));
    }
  }, [errors]);

  const setTouched = useCallback((field: keyof T) => {
    setTouchedState(prev => ({ ...prev, [field]: true }));
  }, []);

  const validateField = useCallback((field: keyof T): boolean => {
    const result = Validator.validate(values[field], schema[field]);
    setErrors(prev => ({ ...prev, [field]: result.errors }));
    return result.isValid;
  }, [values, schema]);

  const validate = useCallback((): boolean => {
    const results = Validator.validateFields(values, schema);
    const errorMap = Object.entries(results).reduce((acc, [key, result]) => {
      acc[key as keyof T] = result.errors;
      return acc;
    }, {} as Record<keyof T, string[]>);
    setErrors(errorMap);
    return Validator.allValid(results);
  }, [values, schema]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!validate()) {
      // Mark all fields as touched
      const allTouched = Object.keys(schema).reduce((acc, key) => {
        acc[key as keyof T] = true;
        return acc;
      }, {} as Record<keyof T, boolean>);
      setTouchedState(allTouched);
      return;
    }

    if (onSubmit) {
      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [validate, onSubmit, values, schema]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({} as Record<keyof T, string[]>);
    setTouchedState({} as Record<keyof T, boolean>);
    setIsSubmitting(false);
  }, [initialValues]);

  const isValid = Validator.allValid(Validator.validateFields(values, schema));

  return {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    setValue,
    setTouched,
    validate,
    validateField,
    handleSubmit,
    reset,
  };
}

// ============================================
// VALIDATED INPUT COMPONENT
// ============================================

import React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  touched?: boolean;
  helperText?: string;
}

export const ValidatedInput = React.forwardRef<HTMLInputElement, ValidatedInputProps>(
  ({ label, error, touched, helperText, className, ...props }, ref) => {
    const showError = touched && error;

    return (
      <div className="space-y-1">
        {label && (
          <label className="text-sm font-medium text-slate-300">
            {label}
            {props.required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}
        <Input
          ref={ref}
          className={cn(
            showError && 'border-red-500 focus-visible:ring-red-500',
            className
          )}
          {...props}
        />
        {showError ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

ValidatedInput.displayName = 'ValidatedInput';
