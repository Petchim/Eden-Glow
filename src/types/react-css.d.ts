import 'react';

/* Components pass CSS custom properties (e.g. style={{ '--delay': '120ms' }}) that the stylesheets read. */
declare module 'react' {
  interface CSSProperties {
    [customProperty: `--${string}`]: string | number | undefined;
  }
}
