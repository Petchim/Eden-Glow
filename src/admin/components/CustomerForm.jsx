import { useEffect, useState } from 'react';
import { Field, Modal } from './ui.jsx';
import { api } from '../api/index.js';
import { useAction } from '../hooks.js';

const EMPTY = { name: '', phone: '', email: '', area: '', notes: '', status: 'active' };

/** Create or edit a customer. Only what the studio needs: name, phone, optional email/area/notes. */
export default function CustomerForm({ open, customer, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const { busy, error, setError, run } = useAction();

  useEffect(() => {
    if (open) {
      setForm(customer ? { ...EMPTY, ...customer } : EMPTY);
      setError(null);
    }
  }, [open, customer, setError]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const fe = error?.fields || {};

  const submit = async (e) => {
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
