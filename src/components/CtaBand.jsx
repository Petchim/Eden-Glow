import Button from './ui/Button.jsx';
import Leaf from './ui/Leaf.jsx';
import Reveal from './ui/Reveal.jsx';
import { Accent } from './ui/SectionTitle.jsx';

/* Closing call to action used at the end of every page. */
export default function CtaBand({ title, text, label = 'Book Appointment', to, secondary }) {
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
