/* Botanical line-art sprig inspired by the shop banner. Purely decorative. */
export default function Leaf({ className = '', stroke = 0.8, flip = false, style }) {
  return (
    <svg
      className={`leaf ${className}`}
      style={{ ...(flip ? { transform: 'scaleX(-1)' } : null), ...style }}
      viewBox="0 0 120 200"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M60 198C60 140 58 90 63 8" />
      <path d="M60 162C40 152 27 136 25 114C44 120 56 136 60 162Z" />
      <path d="M61 132C81 124 93 107 95 86C76 92 64 108 61 132Z" />
      <path d="M60 102C42 94 31 77 31 58C48 64 58 80 60 102Z" />
      <path d="M62 72C78 63 87 48 87 31C72 38 63 53 62 72Z" />
      <path d="M62.5 40C70 33 73 24 72 14C65 19 62 28 62.5 40Z" />
    </svg>
  );
}
