import { useEffect, useState, type FormEvent } from 'react';
import AIcon from '../components/AIcon.tsx';
import { Card, Confirm, ErrorNote, Field, Loading, PageHeader } from '../components/ui.tsx';
import { BUSINESS, hasEmail, hasPhone, locationLine, siteUrl } from '../../config/business.ts';
import { api, USING_MOCK } from '../api/index.ts';
import { useAction, useAdminTitle, useApi } from '../hooks.ts';
import { fmtDate } from '../lib/format.ts';

interface SettingsForm {
  taxEnabled: boolean;
  taxLabel: string;
  /** '' while the field is empty. */
  taxRate: number | string;
  invoiceFooter: string;
}

export default function Settings() {
  useAdminTitle('Settings');
  const { data, error, loading, reload } = useApi(() => api.settings.get(), []);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [staffText, setStaffText] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const save = useAction();
  const reset = useAction();

  useEffect(() => {
    if (data) {
      setForm({ taxEnabled: data.taxEnabled, taxLabel: data.taxLabel, taxRate: data.taxRate || '', invoiceFooter: data.invoiceFooter });
      setStaffText(data.staff.join(', '));
    }
  }, [data]);

  if (loading && !data) return <Loading rows={8} />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!form) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    const r = await save.run(() => api.settings.update({ ...form, staff: staffText.split(',') }));
    if (r) setSaved(true);
  };

  const details: [label: string, value: string][] = [
    ['Studio name', BUSINESS.name],
    ['Address', BUSINESS.address.join(', ') || locationLine()],
    ['Phone', hasPhone() ? BUSINESS.phoneDisplay || BUSINESS.phone : ''],
    ['Email', hasEmail() ? BUSINESS.email : ''],
    ['Website', siteUrl()],
    ['Instagram', BUSINESS.instagramHandle || BUSINESS.instagramUrl],
  ];

  return (
    <div className="ad-page">
      <PageHeader crumbs={[{ label: 'Settings' }]} title="Settings" sub="Billing rules, staff names and studio details." />

      <div className="ad-grid ad-grid--2 ad-settings">
        <form onSubmit={submit} className="ad-stack-lg">
          <Card title="Billing & Tax" icon="bill">
            <label className="ad-check">
              <input type="checkbox" checked={form.taxEnabled} onChange={(e) => setForm({ ...form, taxEnabled: e.target.checked })} />
              <span>Add tax to new invoices</span>
            </label>
            <p className="ad-field-hint ad-mt-s">Turn this on only if the studio is registered to charge tax. Existing invoices are never changed.</p>
            {form.taxEnabled && (
              <div className="ad-form-grid ad-mt">
                <Field label="Tax name">{(p) => <input {...p} className="ad-input" value={form.taxLabel} onChange={(e) => setForm({ ...form, taxLabel: e.target.value })} maxLength={20} />}</Field>
                <Field label="Rate (%)" error={save.error?.fields?.taxRate}>
                  {(p) => <input {...p} className="ad-input" type="number" min="0" max="28" step="0.01" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />}
                </Field>
              </div>
            )}
            <Field label="Thank-you message on invoices" className="ad-mt">
              {(p) => <textarea {...p} className="ad-textarea" value={form.invoiceFooter} onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value })} maxLength={300} />}
            </Field>
          </Card>

          <Card title="Staff" icon="users">
            <Field label="Staff names (comma separated)" hint="Shown as optional choices when billing or booking. Staff do not get logins.">
              {(p) => <input {...p} className="ad-input" value={staffText} onChange={(e) => setStaffText(e.target.value)} />}
            </Field>
          </Card>

          {save.error && !save.error.fields && <ErrorNote error={save.error} />}
          <div className="ad-row-actions">
            <button type="submit" className="ad-btn ad-btn--primary" disabled={save.busy}>
              {save.busy ? 'Saving…' : 'Save Settings'}
            </button>
            {saved && <span className="ad-ok">Settings saved</span>}
          </div>
        </form>

        <div className="ad-stack-lg">
          <Card title="Studio Details" icon="spa">
            <p className="ad-muted">
              These come from <code>src/config/business.ts</code>, the same file the public website uses. Anything left empty there is simply left off invoices — nothing is made up.
            </p>
            <dl className="ad-kv ad-mt">
              {details.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v || <span className="ad-muted">Not set</span>}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Admin Account" icon="shield">
            <p className="ad-muted">
              There is one owner login and no staff accounts. {USING_MOCK ? 'Right now the panel runs without a server, so the sign-in is a demo only and offers no real protection. Password changes, secure sessions and sign-in limits will be handled by the backend once it is connected.' : 'Sign-in is handled by Firebase Authentication, and only the account listed in the admins collection can open this panel or change records. To change the password, sign out and use “Forgot password?” on the sign-in screen.'}
            </p>
          </Card>

          {USING_MOCK && (
            <Card title="Demo Data" icon="refresh">
              <p className="ad-muted">
                Every customer, bill and expense you see is sample data kept only in this browser{data?.demo?.seededOn ? ` (created ${fmtDate(data.demo.seededOn)})` : ''}. Resetting brings back a fresh set dated around today and removes anything you added.
              </p>
              <button type="button" className="ad-btn ad-btn--ghost ad-mt" onClick={() => setConfirmReset(true)}>
                <AIcon name="refresh" size={18} /> Reset Demo Data
              </button>
              <ErrorNote error={reset.error} />
            </Card>
          )}
        </div>
      </div>

      <Confirm
        open={confirmReset}
        title="Reset demo data?"
        text="All sample records and anything you have added in this browser will be replaced with a fresh demo set."
        confirmLabel="Reset"
        danger
        busy={reset.busy}
        onClose={() => setConfirmReset(false)}
        onConfirm={async () => {
          const ok = await reset.run(() => api.settings.resetDemoData());
          setConfirmReset(false);
          if (ok) window.location.assign('/admin/dashboard');
        }}
      />
    </div>
  );
}
