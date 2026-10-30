/* Script wordmark with a fine lotus, as in the admin designs. */
export function Lotus({ size = 44, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size * 0.7} viewBox="0 0 64 44" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
      <path d="M32 6c5 6 6 14 0 24-6-10-5-18 0-24z" />
      <path d="M32 30c3-9 9-15 17-17 0 9-7 16-17 17zM32 30c-3-9-9-15-17-17 0 9 7 16 17 17z" />
      <path d="M32 30c7-4 15-5 23-2-5 6-14 7-23 2zM32 30c-7-4-15-5-23-2 5 6 14 7 23 2z" />
      <path d="M14 36h36" />
    </svg>
  );
}

export default function AdminLogo({ sub = 'STUDIO', tagline, className = '' }: { sub?: string; tagline?: string; className?: string }) {
  return (
    <span className={`ad-logo ${className}`}>
      <Lotus className="ad-logo-lotus" />
      <span className="ad-logo-name">Eden Glow</span>
      <span className="ad-logo-sub">{sub}</span>
      {tagline && <span className="ad-logo-tag">{tagline}</span>}
    </span>
  );
}

/** Line-art blossom used as a quiet decoration (sidebar foot, invoice corner). */
export function Blossom({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
      {[0, 72, 144, 216, 288].map((r) => (
        <path key={r} transform={`rotate(${r} 100 100)`} d="M100 100c-14-20-14-46 0-62 14 16 14 42 0 62z" />
      ))}
      {[36, 108, 180, 252, 324].map((r) => (
        <path key={r} transform={`rotate(${r} 100 100)`} d="M100 100c-8-14-8-30 0-40 8 10 8 26 0 40z" opacity=".7" />
      ))}
      <circle cx="100" cy="100" r="7" />
      <path d="M100 100c30 18 50 48 56 92M60 196c10-30 22-52 40-62" opacity=".6" />
      <path d="M140 160c14-6 30-4 42 6-14 6-30 4-42-6zM70 160c-12-8-28-8-40 0 12 8 28 8 40 0z" opacity=".6" />
    </svg>
  );
}
