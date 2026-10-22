import { useMemo, useRef, useState } from 'react';
import { BUSINESS } from '../config/business.js';
import { BOOKING_SERVICES } from '../data/content.js';
import { SERVICE_PAGES, MAKEUP_PAGE } from '../data/services.js';
import { ACADEMY } from '../data/academy.js';
import { checkName, checkPhone, enquiryChannel, nowHHMM, prettyDate, prettyTime, sendEnquiry, todayISO } from '../utils/enquiry.js';
import Field, { ariaFor } from './forms/Field.jsx';
import EnquiryResult from './forms/EnquiryResult.jsx';
import Icon from './ui/Icon.jsx';

/* Treatment options for each service, taken from the service pages. */
const titles = (page) => page.offerings.items.map((i) => i.title);
export const TREATMENTS = {
  Hair: titles(SERVICE_PAGES.hair),
  Skin: titles(SERVICE_PAGES.skin),
  Nails: titles(SERVICE_PAGES.nails),
  Lashes: titles(SERVICE_PAGES.lashes),
  Makeup: MAKEUP_PAGE.occasion.points,
  'Bridal makeup': MAKEUP_PAGE.bridal.points,
  'Academy enquiry': ACADEMY.interests.filter((i) => i !== 'Not sure yet'),
};

const EMPTY = { name: '', phone: '', service: '', treatment: '', date: '', time: '', message: '' };
const ORDER = ['name', 'phone', 'service', 'date', 'time'];
const SUBJECT = `Appointment enquiry — ${BUSINESS.name}`;

function validate(f) {
  const e = {
    name: checkName(f.name),
    phone: checkPhone(f.phone),
    service: f.service ? undefined : 'Please choose a service.',
  };
  if (!f.date) e.date = 'Please choose a preferred date.';
  else if (f.date < todayISO()) e.date = 'Please choose today or a later date.';
  if (!f.time) e.time = 'Please choose a preferred time.';
  else if (f.date === todayISO() && f.time <= nowHHMM()) e.time = 'That time has already passed today — please choose a later time.';
  return e;
}

function buildMessage(f) {
  return [
    `Hello ${BUSINESS.name}, I'd like to request an appointment.`,
    '',
    `Name: ${f.name.trim() || '—'}`,
    `Phone: ${f.phone.trim() || '—'}`,
    `Service: ${f.service || '—'}${f.treatment ? ` — ${f.treatment}` : ''}`,
    `Preferred date: ${prettyDate(f.date) || '—'}`,
    `Preferred time: ${prettyTime(f.time) || '—'}`,
    ...(f.message.trim() ? [`Message: ${f.message.trim()}`] : []),
    '',
    'Please let me know if this slot is available. Thank you!',
  ].join('\n');
}

/** Appointment enquiry form. `initialService`/`initialTreatment` come from the URL. */
export default function BookingForm({ initialService = '', initialTreatment = '' }) {
  const service = BOOKING_SERVICES.includes(initialService) ? initialService : '';
  const treatment = service && TREATMENTS[service]?.includes(initialTreatment) ? initialTreatment : '';
  const [form, setForm] = useState({ ...EMPTY, service, treatment });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(null);
  const formRef = useRef(null);
  const message = useMemo(() => buildMessage(form), [form]);
  const options = TREATMENTS[form.service] || [];
  const channel = enquiryChannel();

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v, ...(k === 'service' ? { treatment: '' } : null) }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
    setSent(null);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const er = validate(form);
    setErrors(er);
    const first = ORDER.find((k) => er[k]);
    if (first) {
      formRef.current.querySelector(`#bk-${first}`)?.focus();
      return;
    }
    setSent({ channel: sendEnquiry(message, SUBJECT), msg: message });
  };

  const aria = (k) => ariaFor(errors, 'bk', k);

  return (
    <div className="booking-grid">
      <form className="bk-form" ref={formRef} onSubmit={onSubmit} noValidate aria-labelledby="bk-form-title">
        <h2 className="bk-form-title" id="bk-form-title">Your details</h2>
        <div className="field-row">
          <Field id="bk-name" label="Full name" error={errors.name}>
            <input id="bk-name" type="text" autoComplete="name" value={form.name} onChange={set('name')} {...aria('name')} />
          </Field>
          <Field id="bk-phone" label="Phone number" error={errors.phone}>
            <input id="bk-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} {...aria('phone')} />
          </Field>
        </div>
        <div className="field-row">
          <Field id="bk-service" label="Service category" error={errors.service}>
            <div className="select">
              <select id="bk-service" value={form.service} onChange={set('service')} {...aria('service')}>
                <option value="">Select a service</option>
                {BOOKING_SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <Icon name="chevron" size={16} />
            </div>
          </Field>
          <Field id="bk-treatment" label="Treatment" optional>
            <div className="select">
              <select id="bk-treatment" value={form.treatment} onChange={set('treatment')} disabled={!options.length}>
                <option value="">{options.length ? 'Not sure — please advise' : 'Choose a service first'}</option>
                {options.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <Icon name="chevron" size={16} />
            </div>
          </Field>
        </div>
        <div className="field-row">
          <Field id="bk-date" label="Preferred date" error={errors.date}>
            <input id="bk-date" type="date" min={todayISO()} value={form.date} onChange={set('date')} {...aria('date')} />
          </Field>
          <Field id="bk-time" label="Preferred time" error={errors.time}>
            <input id="bk-time" type="time" value={form.time} onChange={set('time')} {...aria('time')} />
          </Field>
        </div>
        <Field id="bk-message" label="Additional message" optional>
          <textarea id="bk-message" rows={4} value={form.message} onChange={set('message')} placeholder="Anything we should know — hair length, skin concerns, the occasion…" />
        </Field>

        <div className="bk-submit">
          <button className="btn btn--gold" type="submit">
            <Icon name={channel === 'whatsapp' ? 'whatsapp' : 'arrow'} size={20} />
            {channel === 'whatsapp' ? 'Send Enquiry on WhatsApp' : channel === 'email' ? 'Send Enquiry by Email' : 'Prepare My Enquiry'}
          </button>
          <p className="fine">This is a request, not a confirmed booking. The studio will reply to confirm your appointment.</p>
        </div>

        {sent && <EnquiryResult channel={sent.channel} message={sent.msg} subject={SUBJECT} />}
      </form>

      <aside className="preview" aria-label="Message preview">
        <p className="mini-label">Your message preview</p>
        <pre>{message}</pre>
      </aside>
    </div>
  );
}
