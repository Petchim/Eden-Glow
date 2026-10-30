import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Field, Modal } from './ui.tsx';
import { api, type FieldErrors } from '../api/index.ts';
import { useAction } from '../hooks.ts';
import type { Customer } from '../../types/models.ts';

const EMPTY = { name: '', phone: '', email: '', area: '', notes: '', status: 'active' };
type CustomerForm = typeof EMPTY;

interface CustomerFormProps {
  open: boolean;
  /** The customer to edit; omit (or pass a record without an id) to add a new one. */
  customer?: Partial<Customer> | null;
  onClose: () => void;
  onSaved: (customer: Customer) => void;
}

/** Create or edit a customer. Only what the studio needs: name, phone, optional email/area/notes. */
export default function CustomerForm({ open, customer, onClose, onSaved }: CustomerFormProps) {
  const [form, setForm] = useState<CustomerForm>(EMPTY);
  const { busy, error, setError, run } = useAction();

  useEffect(() => {
    if (open) {
      setForm(customer ? { ...EMPTY, ...customer } : EMPTY);
      setError(null);
    }
  }, [open, customer, setError]);

  const set = (k: keyof CustomerForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });
  const fe: FieldErrors = error?.fields || {};

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const saved = await run(() => (customer?.id ? api.customers.update(customer.id, form) : api.customers.create(form)));
    if (saved) onSaved(saved);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer?.id ? 'Edit Customer' : 'New Customer'}
      footer={
        <>
          <button type="button" className="ad-btn ad-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="ad-customer-form" className="ad-btn ad-btn--primary" disabled={busy}>
            {busy ? 'Saving…' : customer?.id ? 'Save Changes' : 'Add Customer'}
          </button>
        </>
      }
    >
      <form id="ad-customer-form" className="ad-form-grid" onSubmit={submit} noValidate>
        {error && !error.fields && <p className="ad-alert ad-alert--error ad-span-2">{error.message}</p>}
        <Field label="Full name" required error={fe.name} className="ad-span-2">
          {(p) => <input {...p} className="ad-input" value={form.name} onChange={set('name')} autoComplete="off" maxLength={80} />}
        </Field>
        <Field label="Phone number" required error={fe.phone}>
          {(p) => <input {...p} className="ad-input" type="tel" value={form.phone} onChange={set('phone')} placeholder="+91 XXXXX XXXXX" maxLength={16} />}
        </Field>
        <Field label="Email (optional)" error={fe.email}>
          {(p) => <input {...p} className="ad-input" type="email" value={form.email} onChange={set('email')} maxLength={120} />}
        </Field>
        <Field label="Area (optional)" hint="Neighbourhood only — no full address needed.">
          {(p) => <input {...p} className="ad-input" value={form.area} onChange={set('area')} maxLength={80} />}
        </Field>
        <Field label="Status">
          {(p) => (
            <select {...p} className="ad-select" value={form.status} onChange={set('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          )}
        </Field>
        <Field label="Notes (optional)" hint="Preferences or care notes, e.g. sensitive skin." className="ad-span-2">
          {(p) => <textarea {...p} className="ad-textarea" value={form.notes} onChange={set('notes')} maxLength={1000} />}
        </Field>
      </form>
    </Modal>
  );
}
