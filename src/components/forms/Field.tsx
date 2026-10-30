import type { ReactNode } from 'react';

/** Field name → error message (undefined = valid). */
export type FormErrors<K extends string = string> = Partial<Record<K, string | undefined>>;

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  hint?: string;
  children: ReactNode;
}

/* Labelled form field with an inline error message. */
export default function Field({ id, label, error, optional, hint, children }: FieldProps) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>
        {label}
        {optional ? <small> (optional)</small> : <span aria-hidden="true"> *</span>}
      </label>
      {hint && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}
      {children}
      {error && <p className="field-error" id={`${id}-err`}>{error}</p>}
    </div>
  );
}

/** aria props for an input, given the current errors. */
export const ariaFor = <K extends string>(errors: FormErrors<K>, prefix: string, k: K, required = true) => ({
  'aria-invalid': errors[k] ? ('true' as const) : ('false' as const),
  'aria-describedby': errors[k] ? `${prefix}-${k}-err` : undefined,
  ...(required ? { 'aria-required': 'true' as const } : null),
});
