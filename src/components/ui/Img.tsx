import { useState } from 'react';
import type { Photo } from '../../types/content.ts';
import Leaf from './Leaf.tsx';

interface ImgProps extends Omit<Photo, 'artInImage'> {
  priority?: boolean;
  className?: string;
  sizes?: string;
}

/**
 * Photo with graceful loading:
 *  - fades in when loaded
 *  - `priority` = eager + high fetch priority (hero); everything else lazy-loads
 *  - `position` = object-position, to keep the subject in frame when cropped
 *  - `srcSet` = responsive WebP copies; `src` stays the JPEG fallback for browsers without WebP,
 *    and is retried on its own if a WebP copy fails to load
 *  - if the photo can't load, shows a branded textured panel instead of a broken image
 */
export default function Img({ src, srcSet, alt, priority = false, className = '', sizes, position }: ImgProps) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [plain, setPlain] = useState(false);

  if (!src || state === 'error') {
    return (
      <div className={`img img--fallback ${className}`} role="img" aria-label={alt}>
        <Leaf className="img-leaf" stroke={0.7} />
      </div>
    );
  }

  const img = (
    <img
      src={src}
      alt={alt}
      sizes={sizes}
      loading={priority ? 'eager' : 'lazy'}
      // lower-case attribute: React 18 passes it through to the DOM as-is (camelCase triggers a warning)
      {...{ fetchpriority: priority ? 'high' : 'auto' }}
      decoding="async"
      style={position ? { objectPosition: position } : undefined}
      ref={(el) => {
        // cached images can finish before React attaches onLoad
        if (el && el.complete && el.naturalWidth && state === 'loading') setState('loaded');
      }}
      onLoad={() => setState('loaded')}
      onError={() => (srcSet && !plain ? setPlain(true) : setState('error'))}
    />
  );

  return (
    <div className={`img ${state === 'loaded' ? 'is-loaded' : ''} ${className}`}>
      {srcSet && !plain ? (
        <picture>
          <source type="image/webp" srcSet={srcSet} sizes={sizes} />
          {img}
        </picture>
      ) : (
        img
      )}
    </div>
  );
}
