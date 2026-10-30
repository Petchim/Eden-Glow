/* Fine line-art blossom branch (decorative). Colour follows `currentColor`; `flip` mirrors it. */
const BLOSSOMS: [x: number, y: number, scale: number][] = [
  [104, 38, 1],
  [138, 72, 0.8],
  [134, 222, 1],
  [18, 142, 0.9],
  [44, 262, 0.7],
];

function Blossom({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} pathLength="1" cx="0" cy="-7" rx="4.2" ry="6.5" transform={`rotate(${a})`} />
      ))}
      <circle cx="0" cy="0" r="1.8" fill="currentColor" />
    </g>
  );
}

export default function Floral({ className = '', flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      className={`floral ${className}`}
      viewBox="0 0 160 360"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path pathLength="1" d="M70 360C64 300 86 250 74 196C64 150 80 96 104 44" />
      <path pathLength="1" d="M74 250C96 238 116 240 130 226" />
      <path pathLength="1" d="M72 168C52 156 34 158 22 146" />
      <path pathLength="1" d="M90 92C106 84 120 86 134 76" />
      <path pathLength="1" d="M66 290C58 280 50 272 46 266" />
      <path pathLength="1" d="M74 300c-14-6-22-18-22-32 14 4 22 16 22 32z" />
      <path pathLength="1" d="M76 214c12-10 26-12 38-6-10 10-24 12-38 6z" />
      <path pathLength="1" d="M66 130c-4-14 0-28 12-36 4 14 0 28-12 36z" />
      <path pathLength="1" d="M96 110c10-2 20 2 26 10-10 2-20-2-26-10z" />
      <path pathLength="1" d="M58 182c-10 0-18-6-22-14 10 0 18 6 22 14z" />
      {BLOSSOMS.map(([x, y, s]) => <Blossom key={`${x}-${y}`} x={x} y={y} s={s} />)}
    </svg>
  );
}
