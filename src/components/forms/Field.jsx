/* Labelled form field with an inline error message. */
export default function Field({ id, label, error, optional, hint, children }) {
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
export const ariaFor = (errors, prefix, k, required = true) => ({
  'aria-invalid': errors[k] ? 'true' : 'false',
  'aria-describedby': errors[k] ? `${prefix}-${k}-err` : undefined,
  ...(required ? { 'aria-required': 'true' } : null),
});
