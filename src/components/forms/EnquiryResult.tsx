import { useState } from 'react';
import { mailLink, waLink } from '../../config/business.ts';
import type { EnquiryChannel } from '../../utils/enquiry.ts';
import Icon from '../ui/Icon.tsx';

/* What happened after submitting: never claims a booking was saved. */
export default function EnquiryResult({ channel, message, subject }: { channel: EnquiryChannel; message: string; subject: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="bk-sent" role="status">
      {channel === 'whatsapp' && (
        <>
          <p className="mini-label">WhatsApp opened in a new tab</p>
          <p className="fine">Press send in WhatsApp to deliver your message. If it didn’t open, <a href={waLink(message)} target="_blank" rel="noopener noreferrer">tap here to send it</a>. Nothing is confirmed until the studio replies.</p>
        </>
      )}
      {channel === 'email' && (
        <>
          <p className="mini-label">Your email app should open</p>
          <p className="fine">Press send in your email app to deliver your message. If it didn’t open, <a href={mailLink(subject, message)}>tap here</a> or copy the message below. Nothing is confirmed until the studio replies.</p>
        </>
      )}
      {channel === 'copy' && (
        <>
          <p className="mini-label">Your message is ready</p>
          <p className="fine">The studio’s WhatsApp number and email haven’t been added to the website yet, so this message can’t be sent from here. Please copy it and send it to the studio directly.</p>
        </>
      )}
      {channel !== 'whatsapp' && (
        <>
          <pre>{message}</pre>
          <button type="button" className="btn btn--line btn--sm" onClick={copy}>
            <Icon name={copied ? 'check' : 'copy'} size={16} />{copied ? 'Copied' : 'Copy message'}
          </button>
        </>
      )}
    </div>
  );
}
