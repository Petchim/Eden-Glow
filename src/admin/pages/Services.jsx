import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AIcon from '../components/AIcon.jsx';
import { Badge, Card, Empty, ErrorNote, Field, Loading, Modal, PageHeader, SearchInput } from '../components/ui.jsx';
import Img from '../../components/ui/Img.jsx';
import { api } from '../api/index.js';
import { useAction, useAdminTitle, useApi, useDebounced } from '../hooks.js';
import { money } from '../lib/format.js';
import { websiteMenu } from '../lib/websiteMenu.js';

function ServiceForm({ open, service, categories, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const { busy, error, setError, run } = useAction();
  useEffect(() => {
    if (open) {
      setForm(service ? { ...service } : { name: '', category: categories[0] || '', price: '', durationMin: '', image: '', active: true, published: false });
      setError(null);
    }
  }, [open, service, categories, setError]);
  const fe = error?.fields || {};
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const r = await run(() => api.services.save({ ...form, price: form.price === '' ? null : form.price, durationMin: form.durationMin === '' ? null : form.durationMin }));
    if (r) onSaved(r);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={service ? 'Edit Service' : 'New Service'}
      footer={
        <>
          <button type="button" className="ad-btn ad-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="ad-svc-form" className="ad-btn ad-btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save Service'}
          </button>
        </>
      }
    >
      <form id="ad-svc-form" className="ad-form-grid" onSubmit={submit} noValidate>
        {error && !error.fields && <p className="ad-alert ad-alert--error ad-span-2">{error.message}</p>}
        <Field label="Service name" required error={fe.name} className="ad-span-2">
          {(p) => <input {...p} className="ad-input" value={form.name || ''} onChange={set('name')} maxLength={80} />}
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
        <Field label="Duration (mins)" required error={fe.durationMin}>
          {(p) => <input {...p} className="ad-input" type="number" min="5" max="600" step="5" value={form.durationMin ?? ''} placeholder="Not set" onChange={set('durationMin')} />}
        </Field>
        <Field label="Price (₹)" required error={fe.price} hint={service ? 'Saved invoices keep the price they were billed at.' : ''}>
          {(p) => <input {...p} className="ad-input" type="number" min="1" value={form.price ?? ''} onChange={set('price')} placeholder="Not set" />}
        </Field>
        <Field label="Status">
          {(p) => (
            <select {...p} className="ad-select" value={form.active === false ? 'off' : 'on'} onChange={(e) => setForm({ ...form, active: e.target.value === 'on' })}>
              <option value="on">Active – shown when billing</option>
              <option value="off">Hidden</option>
            </select>
          )}
        </Field>
        <Field label="Website" hint="Published services (name, category, price, duration) can be read by anyone. Customer and billing records never are.">
          {(p) => (
            <select {...p} className="ad-select" value={form.published ? 'on' : 'off'} onChange={(e) => setForm({ ...form, published: e.target.value === 'on' })}>
              <option value="off">Not published</option>
              <option value="on">Published</option>
            </select>
          )}
        </Field>
        <Field label="Image URL (optional)" hint="A photo from the studio, e.g. /images/services/facial.jpg" className="ad-span-2">
          {(p) => <input {...p} className="ad-input" value={form.image || ''} onChange={set('image')} maxLength={500} />}
        </Field>
      </form>
    </Modal>
  );
}

export default function Services() {
  useAdminTitle('Services');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [edit, setEdit] = useState(params.get('new') ? {} : null);
  const dq = useDebounced(q);
  const settings = useApi(() => api.settings.get(), []);
  const { data, error, loading, reload } = useApi(() => api.services.list({ q: dq, category: cat, includeInactive: true }), [dq, cat]);
  const categories = settings.data?.serviceCategories || [];
  const importer = useAction();
  const [imported, setImported] = useState(null);
  const importMenu = async () => {
    const r = await importer.run(() => api.services.importMenu(websiteMenu()));
    if (r) {
      setImported(r);
      reload();
    }
  };

  return (
    <div className="ad-page">
      <PageHeader
        crumbs={[{ label: 'Services' }]}
        title="Services"
        sub="The menu used for billing and appointments. Prices here apply to new bills only."
        actions={
          <button type="button" className="ad-btn ad-btn--primary ad-btn--lg" onClick={() => setEdit({})}>
            <AIcon name="plus" size={20} /> Add New Service
          </button>
        }
      />
      <Card>
        <div className="ad-toolbar">
          <SearchInput value={q} onChange={setQ} placeholder="Search services…" />
          <select className="ad-select ad-select--auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <ErrorNote error={error} onRetry={reload} />
        <ErrorNote error={importer.error} />
        {imported && (
          <p className="ad-alert ad-mt-s" role="status">
            {imported.added
              ? `Added ${imported.added} treatment${imported.added > 1 ? 's' : ''} from the website as hidden services. Set a price and duration on each, then mark it Active.`
              : 'Every treatment on the website is already in this list.'}
          </p>
        )}
        {loading && !data ? (
          <Loading rows={6} />
        ) : !data?.length ? (
          <Empty
            title="No services found"
            text={!dq && cat === 'all' ? 'Add services one by one, or start from the treatments listed on the website (names only: you enter the prices).' : undefined}
            action={
              !dq &&
              cat === 'all' && (
                <button type="button" className="ad-btn ad-btn--ghost ad-mt" onClick={importMenu} disabled={importer.busy}>
                  {importer.busy ? 'Importing…' : 'Import the website’s treatment list'}
                </button>
              )
            }
          />
        ) : (
          <div className="ad-svc-manage">
            {data.map((s) => (
              <div key={s.id} className={`ad-svc-card ${s.active ? '' : 'is-off'}`}>
                <Img src={s.image} alt="" className="ad-svc-card-img" />
                <div className="ad-svc-card-body">
                  <span className="ad-cap">{s.category}</span>
                  <b>{s.name}</b>
                  <span className="ad-svc-card-meta">
                    <span className="ad-svc-price">{s.price > 0 ? money(s.price) : 'Price not set'}</span>
                    <span className="ad-muted">{s.durationMin ? `${s.durationMin} mins` : 'Duration not set'}</span>
                  </span>
                  <span className="ad-svc-card-foot">
                    {s.active ? <Badge status="active">Active</Badge> : <Badge status="draft">Hidden</Badge>}
                    {s.published && <Badge status="paid">On website</Badge>}
                    <span className="ad-muted">{s.bookings} billed</span>
                    <button type="button" className="ad-icon-btn" onClick={() => setEdit(s)} aria-label={`Edit ${s.name}`}>
                      <AIcon name="edit" size={17} />
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <ServiceForm
        open={!!edit}
        service={edit?.id ? edit : null}
        categories={categories}
        onClose={() => (setEdit(null), params.get('new') && setParams({}))}
        onSaved={() => {
          setEdit(null);
          setParams({});
          reload();
        }}
      />
    </div>
  );
}
