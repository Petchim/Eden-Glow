import type { NavLink, TitleLines } from '../types/content.ts';
import Button from './ui/Button.tsx';
import Leaf from './ui/Leaf.tsx';
import Reveal from './ui/Reveal.tsx';
import { Accent } from './ui/SectionTitle.tsx';

/* Closing call to action used at the end of every page. */
interface CtaBandProps {
  title: TitleLines;
  text?: string;
  label?: string;
  to: string;
  /** Optional second, outlined button. */
  secondary?: NavLink;
}

export default function CtaBand({ title, text, label = 'Book Appointment', to, secondary }: CtaBandProps) {
  return (
    <section className="cta-band" aria-label="Book an appointment">
      <Reveal className="wrap cta-band-in">
        <Leaf className="cta-leaf" stroke={0.8} />
        <h2 className="cta-title">
          {title.map((l, i) => <span className="line" key={i}><Accent text={l} /></span>)}
        </h2>
        {text && <p className="lede cta-text">{text}</p>}
        <div className="ctas cta-actions">
          <Button to={to} arrow>{label}</Button>
          {secondary && <Button to={secondary.to} variant="line">{secondary.label}</Button>}
        </div>
        <p className="fine cta-fine">Appointments are confirmed by the studio after your enquiry.</p>
      </Reveal>
    </section>
  );
}
