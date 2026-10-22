/* Lightweight inline line icons (no icon library needed). */
const PATHS = {
  arrow: <path d="M3 12h17M14 6l6 6-6 6" />,
  arrowLeft: <path d="M21 12H4M10 6l-6 6 6 6" />,
  close: <path d="M5 5l14 14M19 5L5 19" />,
  menu: <path d="M3 8h18M9 16h12" />,
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
