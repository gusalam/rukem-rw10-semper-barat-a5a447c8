import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  success?: boolean;
  hint?: string;
  required?: boolean;
}

export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, success, hint, required, className, id, ...props }, ref) => {
    const fieldId = id || label.toLowerCase().replace(/\s+/g, '_');
    const hasError = !!error;
    const isValid = success && !hasError;

    return (
      <div className="space-y-1.5">
        <Label 
          htmlFor={fieldId} 
          className={cn(
            "text-sm font-medium",
            hasError && "text-destructive"
          )}
        >
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="relative">
          <Input
            ref={ref}
            id={fieldId}
            className={cn(
              "pr-10 transition-colors",
              hasError && "border-destructive focus-visible:ring-destructive/30",
              isValid && "border-success focus-visible:ring-success/30",
              className
            )}
            {...props}
          />
          {(hasError || isValid) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {hasError ? (
                <AlertCircle className="h-4 w-4 text-destructive animate-in fade-in zoom-in duration-200" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-success animate-in fade-in zoom-in duration-200" />
              )}
            </div>
          )}
        </div>
        {hasError && (
          <p className="text-xs text-destructive animate-in slide-in-from-top-1 fade-in duration-200">
            {error}
          </p>
        )}
        {hint && !hasError && (
          <p className="text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

// Hook for real-time validation
export function useFormValidation<T extends Record<string, unknown>>(
  data: T,
  schema: { safeParse: (data: T) => { success: boolean; error?: { errors: { path: (string | number)[]; message: string }[] } } }
) {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const validateField = React.useCallback((field: keyof T) => {
    const result = schema.safeParse(data);
    if (!result.success) {
      const fieldError = result.error?.errors.find(e => e.path[0] === field);
      if (fieldError) {
        setErrors(prev => ({ ...prev, [field as string]: fieldError.message }));
        return false;
      }
    }
    setErrors(prev => {
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
    return true;
  }, [data, schema]);

  const validateAll = React.useCallback(() => {
    const result = schema.safeParse(data);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error?.errors.forEach(e => {
        const field = e.path[0] as string;
        if (!newErrors[field]) {
          newErrors[field] = e.message;
        }
      });
      setErrors(newErrors);
      return false;
    }
    setErrors({});
    return true;
  }, [data, schema]);

  const markTouched = React.useCallback((field: keyof T) => {
    setTouched(prev => ({ ...prev, [field as string]: true }));
  }, []);

  const getFieldError = React.useCallback((field: keyof T): string | undefined => {
    return touched[field as string] ? errors[field as string] : undefined;
  }, [errors, touched]);

  const isFieldValid = React.useCallback((field: keyof T): boolean => {
    return touched[field as string] && !errors[field as string] && !!data[field];
  }, [errors, touched, data]);

  const resetValidation = React.useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  return {
    errors,
    touched,
    validateField,
    validateAll,
    markTouched,
    getFieldError,
    isFieldValid,
    resetValidation,
  };
}
