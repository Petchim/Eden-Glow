import { useReveal } from '../../hooks/useReveal.js';

/**
 * Scroll-triggered reveal wrapper.
 * `delay` (ms) staggers siblings; `variant` = 'rise' | 'fade' | 'curtain'.
 */
export default function Reveal({ as: Tag = 'div', delay = 0, variant = 'rise', className = '', children, ...rest }) {
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
