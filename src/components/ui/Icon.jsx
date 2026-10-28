/* Lightweight inline line icons (no icon library needed). */
const PATHS = {
  arrow: <path d="M3 12h17M14 6l6 6-6 6" />,
  arrowLeft: <path d="M21 12H4M10 6l-6 6 6 6" />,
  close: <path d="M5 5l14 14M19 5L5 19" />,
  menu: <path d="M3 8h18M9 16h12" />,
  menu3: <path d="M4 7h16M4 12h16M4 17h16" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L20.5 20.5" />
    </>
  ),
  chevron: <path d="M6 9l6 6 6-6" />,
  whatsapp: (
    <>
      <path d="M3.5 20.5l1.4-4.1A8.5 8.5 0 1 1 8 19.3z" />
      <path d="M9 9.2c.2 2.6 2.8 5.2 5.6 5.6l1.3-1.3-1.8-1-.9.8c-1-.4-2-1.4-2.4-2.4l.8-.9-1-1.8z" />
    </>
  ),
  phone: <path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" />,
  pin: (
    <>
      <path d="M12 21.5s7-6.3 7-11.5a7 7 0 1 0-14 0c0 5.2 7 11.5 7 11.5z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r=".6" fill="currentColor" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" />
      <path d="M16 8V4H4v12h4" />
    </>
  ),
  check: <path d="M4 12.5l5 5L20 6.5" />,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />,
  sparkle: (
    <>
      <path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z" />
      <path d="M18.5 16v4M16.5 18h4" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8 5.5-13 14-14 0 8.5-5 14-14 14z" />
      <path d="M5 19c3-3.5 6-6.5 9.5-9" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="1" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5l7 2.6v5.6c0 4.4-3 7.6-7 8.8-4-1.2-7-4.4-7-8.8V6.1z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </>
  ),
  tools: (
    <>
      <path d="M6 3.5v9M4 3.5v4.5a2 2 0 0 0 4 0V3.5M6 12.5v8" />
      <path d="M15 20.5v-8.5M13 3.5h4l-.6 8.5h-2.8z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.8v6.4l5-3.2z" />
    </>
  ),
};

export default function Icon({ name, size = 18, stroke = 1.3, className = '', ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
