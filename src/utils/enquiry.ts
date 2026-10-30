import { BUSINESS, hasEmail, hasWhatsApp, mailLink, waLink } from '../config/business.ts';

/* Shared helpers for the booking, contact and academy forms.
   There is no backend: enquiries are handed to WhatsApp (or email). */

/** How an enquiry is delivered: WhatsApp, the email app, or a message to copy by hand. */
export type EnquiryChannel = 'whatsapp' | 'email' | 'copy';

export const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
export const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export const prettyDate = (iso: string): string =>
  iso ? new Date(`${iso}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : '';
export const prettyTime = (t: string): string => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

export function checkName(v: string): string | undefined {
  return v.trim().length < 2 ? 'Please enter your name.' : undefined;
}
export function checkPhone(v: string, required = true): string | undefined {
  const digits = v.replace(/\D/g, '');
  if (!digits) return required ? 'Please enter your phone number.' : undefined;
  if (/[^\d\s+()-]/.test(v)) return 'Phone numbers can only contain digits, spaces, +, ( ) and -.';
  if (digits.length < 8 || digits.length > 15) return 'Please enter a valid phone number (8–15 digits).';
  return undefined;
}
export function checkEmail(v: string, required = false): string | undefined {
  if (!v.trim()) return required ? 'Please enter your email address.' : undefined;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? undefined : 'Please enter a valid email address.';
}

/** How an enquiry will be delivered with the current business config. */
export const enquiryChannel = (): EnquiryChannel => (hasWhatsApp() ? 'whatsapp' : hasEmail() ? 'email' : 'copy');

/** Opens WhatsApp (or the email app) with the message. Returns the channel used. */
export function sendEnquiry(message: string, subject = `Enquiry for ${BUSINESS.name}`): EnquiryChannel {
  const channel = enquiryChannel();
  if (channel === 'whatsapp') window.open(waLink(message), '_blank', 'noopener,noreferrer');
  if (channel === 'email') window.location.href = mailLink(subject, message);
  return channel;
}
