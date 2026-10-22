import { useMemo, useRef, useState } from 'react';
import { BUSINESS } from '../config/business.js';
import { checkEmail, checkName, checkPhone, enquiryChannel, sendEnquiry } from '../utils/enquiry.js';
import Field, { ariaFor } from './forms/Field.jsx';
import EnquiryResult from './forms/EnquiryResult.jsx';
import Icon from './ui/Icon.jsx';

const EMPTY = { name: '', phone: '', email: '', topic: '', message: '' };
const ORDER = ['name', 'phone', 'email', 'topic', 'message'];

/**
 * General enquiry form (contact page, academy). Sends via WhatsApp,
 * or email when no WhatsApp number is configured, or prepares a message to copy.
 */
export default function EnquiryForm({ id = 'enq', title, intro, topicLabel = 'Enquiry about', topics, greeting, subject = `Enquiry — ${BUSINESS.name}`, messagePlaceholder }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(null);
  const formRef = useRef(null);
  const channel = enquiryChannel();

  const message = useMemo(
    () => [
      greeting || `Hello ${BUSINESS.name}, I have an enquiry.`,
      '',
      `Name: ${form.name.trim() || '—'}`,
      `Phone: ${form.phone.trim() || '—'}`,
      ...(form.email.trim() ? [`Email: ${form.email.trim()}`] : []),
      `${topicLabel}: ${form.topic || '—'}`,
      '',
      form.message.trim() || '—',
    ].join('\n'),
    [form, greeting, topicLabel],
  );

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
    setSent(null);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const er = {
      name: checkName(form.name),
      phone: checkPhone(form.phone),
      email: checkEmail(form.email),
      topic: form.topic ? undefined : 'Please choose an option.',
      message: form.message.trim().length < 10 ? 'Please write a short message (at least 10 characters).' : undefined,
    };
    setErrors(er);
    const first = ORDER.find((k) => er[k]);
    if (first) {
      formRef.current.querySelector(`#${id}-${first}`)?.focus();
      return;
    }
    setSent({ channel: sendEnquiry(message, subject), msg: message });
  };

  const aria = (k, req = true) => ariaFor(errors, id, k, req);

  return (
    <form className="bk-form enq-form" ref={formRef} onSubmit={onSubmit} noValidate aria-labelledby={`${id}-title`}>
      <h2 className="bk-form-title" id={`${id}-title`}>{title}</h2>
      {intro && <p className="fine enq-intro">{intro}</p>}
      <div className="field-row">
        <Field id={`${id}-name`} label="Full name" error={errors.name}>
          <input id={`${id}-name`} type="text" autoComplete="name" value={form.name} onChange={set('name')} {...aria('name')} />
        </Field>
        <Field id={`${id}-phone`} label="Phone number" error={errors.phone}>
          <input id={`${id}-phone`} type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} {...aria('phone')} />
        </Field>
      </div>
      <div className="field-row">
        <Field id={`${id}-email`} label="Email" optional error={errors.email}>
          <input id={`${id}-email`} type="email" autoComplete="email" value={form.email} onChange={set('email')} {...aria('email', false)} />
        </Field>
        <Field id={`${id}-topic`} label={topicLabel} error={errors.topic}>
          <div className="select">
            <select id={`${id}-topic`} value={form.topic} onChange={set('topic')} {...aria('topic')}>
              <option value="">Select an option</option>
              {topics.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <Icon name="chevron" size={16} />
          </div>
        </Field>
      </div>
      <Field id={`${id}-message`} label="Message" error={errors.message}>
        <textarea id={`${id}-message`} rows={5} value={form.message} onChange={set('message')} placeholder={messagePlaceholder} {...aria('message')} />
      </Field>
      <div className="bk-submit">
        <button className="btn btn--gold" type="submit">
          <Icon name={channel === 'whatsapp' ? 'whatsapp' : 'arrow'} size={20} />
          {channel === 'whatsapp' ? 'Send on WhatsApp' : channel === 'email' ? 'Send by Email' : 'Prepare My Message'}
        </button>
        <p className="fine">Your message is sent from your own WhatsApp or email app — this website doesn’t store it.</p>
      </div>
      {sent && <EnquiryResult channel={sent.channel} message={sent.msg} subject={subject} />}
    </form>
  );
}
