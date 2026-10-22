import { BUSINESS, hasEmail, hasWhatsApp, mailLink, waLink } from '../config/business.js';

/* Shared helpers for the booking, contact and academy forms.
   There is no backend: enquiries are handed to WhatsApp (or email). */

export const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
export const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export const prettyDate = (iso) =>
  iso ? new Date(`${iso}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : '';
export const prettyTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

export function checkName(v) {
  return v.trim().length < 2 ? 'Please enter your name.' : undefined;
}
export function checkPhone(v, required = true) {
  const digits = v.replace(/\D/g, '');
  if (!digits) return required ? 'Please enter your phone number.' : undefined;
  if (/[^\d\s+()-]/.test(v)) return 'Phone numbers can only contain digits, spaces, +, ( ) and -.';
  if (digits.length < 8 || digits.length > 15) return 'Please enter a valid phone number (8–15 digits).';
  return undefined;
}
export function checkEmail(v, required = false) {
  if (!v.trim()) return required ? 'Please enter your email address.' : undefined;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? undefined : 'Please enter a valid email address.';
}

/** How an enquiry will be delivered with the current business config. */
export const enquiryChannel = () => (hasWhatsApp() ? 'whatsapp' : hasEmail() ? 'email' : 'copy');

/** Opens WhatsApp (or the email app) with the message. Returns the channel used. */
export function sendEnquiry(message, subject = `Enquiry for ${BUSINESS.name}`) {
  const channel = enquiryChannel();
  if (channel === 'whatsapp') window.open(waLink(message), '_blank', 'noopener,noreferrer');
  if (channel === 'email') window.location.href = mailLink(subject, message);
  return channel;
}
