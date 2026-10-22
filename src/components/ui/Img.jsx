import { useState } from 'react';
import Leaf from './Leaf.jsx';

/**
 * Photo with graceful loading:
 *  - fades in when loaded
 *  - `priority` = eager + high fetch priority (hero); everything else lazy-loads
 *  - `position` = object-position, to keep the subject in frame when cropped
 *  - if the photo can't load, shows a branded textured panel instead of a broken image
 */
export default function Img({ src, alt, priority = false, className = '', sizes, position }) {
  const [state, setState] = useState('loading');

  if (!src || state === 'error') {
    return (
      <div className={`img img--fallback ${className}`} role="img" aria-label={alt}>
        <Leaf className="img-leaf" stroke={0.7} />
      </div>
    );
  }

  return (
    <div className={`img ${state === 'loaded' ? 'is-loaded' : ''} ${className}`}>
      <img
        src={src}
        alt={alt}
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        fetchpriority={priority ? 'high' : 'auto'}
        decoding="async"
        style={position ? { objectPosition: position } : undefined}
        ref={(el) => {
          // cached images can finish before React attaches onLoad
          if (el && el.complete && el.naturalWidth && state === 'loading') setState('loaded');
        }}
        onLoad={() => setState('loaded')}
        onError={() => setState('error')}
      />
    </div>
  );
}
