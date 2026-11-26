import { useEffect, useRef, useState } from 'react';
import Icon from './ui/Icon.tsx';

declare global {
  interface Window {
    instgrm?: {
      Embeds: {
        process: (element?: HTMLElement | null) => void;
      };
    };
  }
}

interface InstagramEmbedProps {
  url: string;
  type?: 'REEL' | 'VIDEO';
  captioned?: boolean;
  maxWidth?: number;
  className?: string;
}

const SCRIPT_ID = 'instagram-embed-script';
let scriptLoadingPromise: Promise<void> | null = null;

function loadInstagramScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.instgrm?.Embeds) return Promise.resolve();

  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.instgrm?.Embeds) {
        resolve();
        return;
      }
      let checks = 0;
      const interval = setInterval(() => {
        checks++;
        if (window.instgrm?.Embeds || checks > 30) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
      existing.addEventListener('load', () => {
        clearInterval(interval);
        resolve();
      }, { once: true });
      existing.addEventListener('error', () => {
        clearInterval(interval);
        resolve();
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://www.instagram.com/embed.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      console.warn('[InstagramEmbed] Failed to load official Instagram embed script');
      resolve();
    };
    document.body.appendChild(script);
  });

  return scriptLoadingPromise;
}

export default function InstagramEmbed({
  url,
  type = 'REEL',
  captioned = false,
  maxWidth = 540,
  className = '',
}: InstagramEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [hasIframe, setHasIframe] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    setHasIframe(false);
    setHasError(false);

    const processEmbed = () => {
      if (!active) return;
      if (typeof window !== 'undefined' && window.instgrm?.Embeds) {
        try {
          if (containerRef.current) {
            window.instgrm.Embeds.process(containerRef.current);
          } else {
            window.instgrm.Embeds.process();
          }
        } catch (e) {
          console.warn('[InstagramEmbed] Error processing embed:', e);
        }
      }
    };

    loadInstagramScript().then(() => {
      if (!active) return;
      processEmbed();
      requestAnimationFrame(processEmbed);
    });

    // Schedule retries in case DOM mount or layout finishes slightly later
    const t1 = setTimeout(processEmbed, 150);
    const t2 = setTimeout(processEmbed, 500);
    const t3 = setTimeout(processEmbed, 1200);

    // Watch for iframe insertion to confirm embed rendered
    const observer = new MutationObserver(() => {
      if (!active) return;
      const iframe = containerRef.current?.querySelector('iframe');
      if (iframe) {
        setHasIframe(true);
        setLoaded(true);
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true });
    }

    // Timeout: if embed hasn't injected an iframe after 4.5s, finish loading
    const timer = setTimeout(() => {
      if (!active) return;
      const iframe = containerRef.current?.querySelector('iframe');
      if (iframe) {
        setHasIframe(true);
      }
      setLoaded(true);
    }, 4500);

    return () => {
      active = false;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [url]);

  const permalinkUrl = url.includes('?') ? url : `${url}?utm_source=ig_embed&utm_campaign=loading`;

  return (
    <div
      ref={containerRef}
      key={url}
      className={`ig-embed-wrap ${className} ${loaded ? 'is-loaded' : 'is-loading'}`}
      style={{ maxWidth: `${maxWidth}px`, width: '100%', margin: '0 auto', position: 'relative' }}
    >
      {!loaded && (
        <div className="ig-embed-skeleton" aria-label="Loading video from Instagram…">
          <div className="ig-embed-skeleton-icon">
            <Icon name="instagram" size={28} />
          </div>
          <p className="ig-embed-skeleton-text">Loading {type === 'REEL' ? 'Reel' : 'video'} from Instagram…</p>
        </div>
      )}

      {loaded && !hasIframe && !hasError && (
        <div className="ig-embed-fallback">
          <div className="ig-embed-fallback-icon">
            <Icon name="instagram" size={32} />
          </div>
          <p className="ig-embed-fallback-title">Instagram {type === 'REEL' ? 'Reel' : 'Video'}</p>
          <p className="ig-embed-fallback-sub">Preview post directly on Instagram.</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--line ig-embed-btn"
          >
            <span>Watch on Instagram</span>
            <Icon name="arrow" size={14} />
          </a>
        </div>
      )}

      {hasError && (
        <div className="ig-embed-fallback">
          <div className="ig-embed-fallback-icon">
            <Icon name="instagram" size={32} />
          </div>
          <p className="ig-embed-fallback-title">Instagram {type === 'REEL' ? 'Reel' : 'Video'}</p>
          <p className="ig-embed-fallback-sub">This post may be private, removed, or unavailable.</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--line ig-embed-btn"
          >
            <span>Watch on Instagram</span>
            <Icon name="arrow" size={14} />
          </a>
        </div>
      )}

      {/* Official blockquote element: always rendered in DOM so Meta's script can measure and inject iframe */}
      <blockquote
        key={url}
        className="instagram-media"
        data-instgrm-captioned={captioned ? 'true' : undefined}
        data-instgrm-permalink={permalinkUrl}
        data-instgrm-version="14"
        style={{
          background: '#FFF',
          border: 0,
          borderRadius: '12px',
          boxShadow: hasIframe ? '0 4px 20px rgba(53, 28, 27, 0.08)' : 'none',
          margin: '0 auto',
          maxWidth: `${maxWidth}px`,
          minWidth: '280px',
          padding: 0,
          width: '100%',
          opacity: loaded && hasIframe ? 1 : 0,
          position: loaded && hasIframe ? 'relative' : 'absolute',
          pointerEvents: loaded && hasIframe ? 'auto' : 'none',
          visibility: hasError || (loaded && !hasIframe) ? 'hidden' : 'visible',
          transition: 'opacity 0.25s ease',
        }}
      >
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#7a1830',
              fontFamily: 'inherit',
              textDecoration: 'none',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>Watch this {type === 'REEL' ? 'Reel' : 'video'} on Instagram</span>
          </a>
        </div>
      </blockquote>
    </div>
  );
}
