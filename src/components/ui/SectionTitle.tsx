import type { ElementType } from 'react';
import type { TitleLines } from '../../types/content.ts';
import Reveal from './Reveal.tsx';

/**
 * Eyebrow + serif headline. `lines` is an array; wrap a word in *asterisks*
 * to render it in gold italic, e.g. ['Learn the', 'Art of *Beauty.*']
 */
export function Accent({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith('*') ? <em key={i}>{p.slice(1, -1)}</em> : <span key={i}>{p}</span>))}
    </>
  );
}

interface SectionTitleProps {
  eyebrow?: string;
  lines: TitleLines;
  id?: string;
  /** Heading element; 'h1' on pages whose title this is. */
  as?: ElementType;
  className?: string;
  align?: 'left' | 'center';
}

export default function SectionTitle({ eyebrow, lines, id, as: H = 'h2', className = '', align = 'left' }: SectionTitleProps) {
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
