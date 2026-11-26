import type { VideoPostType } from '../types/video.ts';

export interface ParsedInstagramUrl {
  valid: true;
  shortcode: string;
  postType: VideoPostType;
  canonicalUrl: string;
  docId: string;
}

export interface InvalidInstagramUrl {
  valid: false;
  error: string;
}

export type ParseInstagramResult = ParsedInstagramUrl | InvalidInstagramUrl;

/**
 * Validates and extracts canonical Instagram video post information.
 * Supports:
 * - Instagram Reels: https://www.instagram.com/reel/SHORTCODE/
 * - Instagram Video Posts: https://www.instagram.com/p/SHORTCODE/
 * - Legacy IGTV: https://www.instagram.com/tv/SHORTCODE/
 */
export function parseInstagramUrl(rawUrl: string): ParseInstagramResult {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Please enter an Instagram URL.' };
  }

  let parsed: URL;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    parsed = new URL(withProtocol);
  } catch {
    return { valid: false, error: 'Please enter a valid URL.' };
  }

  // Hostname validation
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (hostname !== 'instagram.com') {
    return { valid: false, error: 'Only instagram.com URLs are supported.' };
  }

  // Path validation: /(reel|p|tv)/SHORTCODE
  // Matches shortcodes containing alphanumeric characters, underscores, and dashes
  const match = parsed.pathname.match(/^\/(reel|p|tv)\/([A-Za-z0-9_-]+)/i);
  if (!match) {
    if (parsed.pathname.startsWith('/stories/')) {
      return { valid: false, error: 'Instagram Stories expire and cannot be embedded. Please paste a Reel or public video post.' };
    }
    return {
      valid: false,
      error: 'Please enter a valid Instagram Reel or Video post URL (e.g. https://www.instagram.com/reel/POST_ID/).',
    };
  }

  const kind = match[1].toLowerCase();
  const shortcode = match[2];

  if (!shortcode || shortcode.length < 3 || shortcode.length > 64) {
    return { valid: false, error: 'Invalid Instagram post identifier.' };
  }

  const postType: VideoPostType = kind === 'reel' ? 'REEL' : 'VIDEO';
  const canonicalUrl = `https://www.instagram.com/${kind === 'reel' ? 'reel' : 'p'}/${shortcode}/`;
  const docId = `vid_${shortcode}`;

  return {
    valid: true,
    shortcode,
    postType,
    canonicalUrl,
    docId,
  };
}

/** Deterministic document ID from an Instagram shortcode */
export const getVideoDocId = (shortcode: string): string => `vid_${shortcode}`;
