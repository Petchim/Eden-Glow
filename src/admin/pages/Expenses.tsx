import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import AIcon from '../components/AIcon.tsx';
import { Card, Confirm, Empty, ErrorNote, Field, Loading, Modal, PageHeader, StatCard } from '../components/ui.tsx';
import { Donut } from '../charts/Charts.tsx';
import { api, type ExpenseInput, type FieldErrors } from '../api/index.ts';
import type { Expense } from '../../types/models.ts';
import { useAction, useAdminTitle, useApi } from '../hooks.ts';
import { PAYMENT_METHODS, fmtDate, methodLabel, money, num, today } from '../lib/format.ts';

interface ExpenseFormProps {
  open: boolean;
  /** The expense to edit, or null to add one. */
  expense: Partial<Expense> | null;
  categories: string[];
  onClose: () => void;
  onSaved: (expense: Expense) => void;
}

function ExpenseForm({ open, expense, categories, onClose, onSaved }: ExpenseFormProps) {
  const [form, setForm] = useState<ExpenseInput>({});
  const { busy, error, setError, run } = useAction();
  useEffect(() => {
    if (open) {
      setForm(expense ? { ...expense } : { date: today(), category: categories[0] || '', description: '', amount: '', method: 'upi' });
      setError(null);
    }
  }, [open, expense, categories, setError]);
  const fe: FieldErrors = error?.fields || {};
  const set = (k: keyof ExpenseInput) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await run(() => api.expenses.save(form));
    if (r) onSaved(r);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={expense ? 'Edit Expense' : 'Add Expense'}
      footer={
        <>
          <button type="button" className="ad-btn ad-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="ad-exp-form" className="ad-btn ad-btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save Expense'}
          </button>
        </>
      }
    >
      <form id="ad-exp-form" className="ad-form-grid" onSubmit={submit} noValidate>
        {error && !error.fields && <p className="ad-alert ad-alert--error ad-span-2">{error.message}</p>}
        <Field label="Date" required error={fe.date}>
          {(p) => <input {...p} className="ad-input" type="date" max={today()} value={form.date || ''} onChange={set('date')} />}
        </Field>
        <Field label="Category" required error={fe.category}>
          {(p) => (
            <select {...p} className="ad-select" value={form.category || ''} onChange={set('category')}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Description" required error={fe.description} className="ad-span-2">
          {(p) => <input {...p} className="ad-input" value={form.description || ''} onChange={set('description')} maxLength={120} placeholder="e.g. Hair colour stock" />}
        </Field>
        <Field label="Amount (₹)" required error={fe.amount}>
          {(p) => <input {...p} className="ad-input" type="number" min="1" value={form.amount ?? ''} onChange={set('amount')} />}
        </Field>
        <Field label="Paid by">
          {(p) => (
            <select {...p} className="ad-select" value={form.method || 'upi'} onChange={set('method')}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </form>
    </Modal>
  );
}

export default function Expenses() {
  useAdminTitle('Expenses');
  const [from, setFrom] = useState(`${today().slice(0, 8)}01`);
  const [to, setTo] = useState(today());
  const [cat, setCat] = useState('all');
  const [edit, setEdit] = useState<Partial<Expense> | null>(null);
  const [del, setDel] = useState<Expense | null>(null);
  const settings = useApi(() => api.settings.get(), []);
  const { data, error, loading, reload } = useApi(() => api.expenses.list({ from, to, category: cat }), [from, to, cat]);
  const remove = useAction();
  const categories = settings.data?.expenseCategories || [];
  const total = (data || []).reduce((t, e) => t + e.amount, 0);
  const byCat = Object.entries((data || []).reduce<Record<string, number>>((m, e) => ({ ...m, [e.category]: (m[e.category] || 0) + e.amount }), {}))
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="ad-page">
      <PageHeader
        crumbs={[{ label: 'Expenses' }]}
        title="Expenses"
        sub="Record what the studio spends, so reports show the real picture."
        actions={
          <button type="button" className="ad-btn ad-btn--primary ad-btn--lg" onClick={() => setEdit({})}>
            <AIcon name="plus" size={20} /> Add Expense
          </button>
        }
      />

      <div className="ad-exp-layout">
        <Card>
          <div className="ad-toolbar">
            <label className="ad-inline-field">
              <span>From</span>
              <input className="ad-input" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
            </label>
            <label className="ad-inline-field">
              <span>To</span>
              <input className="ad-input" type="date" value={to} min={from} max={today()} onChange={(e) => e.target.value && setTo(e.target.value)} />
            </label>
            <select className="ad-select ad-select--auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <ErrorNote error={error || remove.error} onRetry={reload} />
          {loading && !data ? (
            <Loading rows={6} />
          ) : !data?.length ? (
            <Empty icon="wallet" title="No expenses in this period" />
          ) : (
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Paid by</th>
                    <th className="num">Amount (₹)</th>
                    <th className="ctr">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((e) => (
                    <tr key={e.id}>
                      <td className="ad-nowrap">{fmtDate(e.date)}</td>
                      <td>{e.category}</td>
                      <td>{e.description}</td>
                      <td>{methodLabel(e.method)}</td>
                      <td className="num">{num(e.amount)}</td>
                      <td className="ctr ad-nowrap">
                        <button type="button" className="ad-icon-btn" onClick={() => setEdit(e)} aria-label={`Edit ${e.description}`}>
                          <AIcon name="edit" size={17} />
                        </button>
                        <button type="button" className="ad-icon-btn ad-icon-btn--danger" onClick={() => setDel(e)} aria-label={`Delete ${e.description}`}>
                          <AIcon name="trash" size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="ad-stack-lg">
          <StatCard icon="wallet" label="Total in period" value={money(total)} foot={`${data?.length || 0} entries`} />
          <Card title="By Category">
            <Donut items={byCat} centerValue={money(total)} centerLabel="Total" size={160} thickness={28} />
          </Card>
        </div>
      </div>

      <ExpenseForm open={!!edit} expense={edit?.id ? edit : null} categories={categories} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), reload())} />
      <Confirm
        open={!!del}
        title="Delete this expense?"
        text={del ? `${del.description} · ${money(del.amount)} on ${fmtDate(del.date)}. This cannot be undone.` : ''}
        confirmLabel="Delete"
        danger
        busy={remove.busy}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          if (!del) return;
          await remove.run(() => api.expenses.remove(del.id));
          setDel(null);
          reload();
        }}
      />
    </div>
  );
}
