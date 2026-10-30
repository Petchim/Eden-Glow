import type { ElementType, HTMLAttributes } from 'react';
import { useReveal } from '../../hooks/useReveal.ts';

interface RevealProps extends HTMLAttributes<HTMLElement> {
  /** Element to render, e.g. 'li', 'article', 'section'. */
  as?: ElementType;
  delay?: number;
  variant?: 'rise' | 'fade' | 'curtain' | 'draw';
}

/**
 * Scroll-triggered reveal wrapper.
 * `delay` (ms) staggers siblings; `variant` = 'rise' | 'fade' | 'curtain'.
 */
export default function Reveal({ as: Tag = 'div', delay = 0, variant = 'rise', className = '', children, ...rest }: RevealProps) {
  const [ref, inView] = useReveal();
  return (
    <Tag
      ref={ref}
      className={`reveal reveal--${variant} ${inView ? 'is-in' : ''} ${className}`}
      style={delay ? { '--delay': `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
