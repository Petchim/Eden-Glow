import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Icon, { type IconName } from './Icon.tsx';

interface ButtonProps extends HTMLAttributes<HTMLElement> {
  /** Internal route: renders a router <Link>. */
  to?: string;
  /** External or in-page link: renders an <a> (http(s) links open in a new tab). */
  href?: string;
  variant?: 'gold' | 'line';
  size?: 'sm';
  arrow?: boolean;
  icon?: IconName;
  children?: ReactNode;
}

/**
 * One button style for internal links (`to`), external links (`href`) and buttons.
 * variant = 'gold' | 'line'; `arrow` adds the trailing arrow icon.
 */
export default function Button({ to, href, variant = 'gold', size, arrow = false, icon, className = '', children, ...rest }: ButtonProps) {
  const cls = `btn btn--${variant} ${size ? `btn--${size}` : ''} ${className}`.trim();
  const inner = (
    <>
      {icon && <Icon name={icon} size={20} />}
      {children}
      {arrow && <Icon name="arrow" />}
    </>
  );
  if (to) return <Link className={cls} to={to} {...rest}>{inner}</Link>;
  if (href) {
    const external = /^https?:/.test(href);
    return (
      <a className={cls} href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : null)} {...rest}>
        {inner}
      </a>
    );
  }
  return <button className={cls} type="button" {...rest}>{inner}</button>;
}
