import Reveal from './Reveal.jsx';

/**
 * Eyebrow + serif headline. `lines` is an array; wrap a word in *asterisks*
 * to render it in gold italic, e.g. ['Learn the', 'Art of *Beauty.*']
 */
export function Accent({ text }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((p, i) =>
    p.startsWith('*') ? <em key={i}>{p.slice(1, -1)}</em> : <span key={i}>{p}</span>,
  );
}

export default function SectionTitle({ eyebrow, lines, id, as: H = 'h2', className = '', align = 'left' }) {
  return (
    <Reveal className={`stitle stitle--${align} ${className}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <H className="h2" id={id}>
        {lines.map((l, i) => (
          <span className="line" key={i}>
            <span className="line-in" style={{ '--li': i }}>
              <Accent text={l} />
            </span>
          </span>
        ))}
      </H>
    </Reveal>
  );
}
