/* =====================================================================
   PUBLIC SITE CONTENT TYPES — the shapes of src/data and src/config.
   Title lines (`TitleLines`) mark a word in *asterisks* to set it in
   gold italic.
   ===================================================================== */

export type TitleLines = string[];

/** A photo with optional responsive WebP copies (`srcSet`) and crop focus (`position`). */
export interface Photo {
  src: string;
  alt: string;
  srcSet?: string;
  position?: string;
  /** The photo already carries the overlay art, so the hero skips its own. */
  artInImage?: boolean;
}

/** 'p' portrait 4:5 · 't' tall 2:3 · 's' square · 'l' landscape 4:3 */
export type GalleryRatio = 'p' | 't' | 's' | 'l';

/** A slide of an Instagram carousel post. */
export interface GallerySlide {
  kind: 'image' | 'video';
  /** Photo URL, or the video's cover image. */
  src: string;
  /** Video file, when Instagram provides one. */
  video?: string;
}

export interface GalleryImage {
  cat: string;
  caption: string;
  src: string;
  /** Larger copy for the lightbox. */
  full: string;
  srcSet?: string;
  ratio?: GalleryRatio;
  position?: string;
  /* ----- optional: set for posts imported from Instagram ----- */
  /** Stable key (Instagram posts); stock photos are keyed by `src`. */
  id?: string;
  source?: 'stock' | 'instagram';
  /** 'image' when omitted. */
  kind?: 'image' | 'video' | 'carousel';
  /** Video file for kind 'video' (Instagram can withhold it, e.g. for licensed music). */
  video?: string;
  /** Carousel slides, in order. */
  slides?: GallerySlide[];
  /** The original post on Instagram (opened in a new tab). */
  permalink?: string;
  isReel?: boolean;
  featured?: boolean;
  /** Descriptive alt text; falls back to "category: caption". */
  alt?: string;
  /** When it was posted on Instagram (ISO). */
  takenAt?: string;
  /** The full Instagram caption (the tile shows a short version). */
  fullCaption?: string;
  /** Instagram's like count, only when Instagram provided one (never estimated). */
  likeCount?: number;
}

export interface NavLink {
  label: string;
  to: string;
}
export interface NavGroup {
  label: string;
  children: NavLink[];
}
export type MainNavItem = NavLink | NavGroup;

export interface FaqItem {
  q: string;
  a: string;
}

export interface CtaContent {
  title: TitleLines;
  text: string;
  label: string;
}

export type HeroVariant = 'arch' | 'split' | 'full' | 'framed';
export interface HeroContent {
  variant: HeroVariant;
  eyebrow: string;
  title: TitleLines;
  text: string;
  image: Photo;
}

export interface IntroContent {
  eyebrow: string;
  title: TitleLines;
  paragraphs: string[];
  image: Photo;
}

export interface Offering {
  title: string;
  text: string;
  /** Real starting price exactly as shown, e.g. 'From ₹1,500'. Empty = no price shown. */
  price: string;
  includes?: string[];
  image?: Photo;
}
export interface OfferingsContent {
  variant: 'rows' | 'grid' | 'cards' | 'index';
  eyebrow: string;
  title: TitleLines;
  intro?: string;
  /** Side photo for the 'index' layout. */
  image?: Photo;
  items: Offering[];
}

export interface InfoStep {
  title: string;
  text: string;
}
export interface InfoColumn {
  title: string;
  items: string[];
}
export type InfoContent = { eyebrow: string; title: TitleLines; note?: string } & (
  | { variant: 'steps'; items: InfoStep[] }
  | { variant: 'columns'; columns: InfoColumn[] }
);

export type GalleryVariant = 'masonry' | 'strip';
export interface GallerySectionContent {
  eyebrow: string;
  title: TitleLines;
  cat: string;
  variant?: GalleryVariant;
}

export type ServiceSectionKey = 'intro' | 'offerings' | 'info' | 'gallery' | 'faqs' | 'cta';

export interface ServicePageContent {
  slug: string;
  name: string;
  /** Option pre-selected in the booking form. */
  booking: string;
  /** false = the treatment list is still a proposal and the page says so. */
  confirmed: boolean;
  meta: { title: string; description: string };
  /** Which sections appear, in order. */
  order: ServiceSectionKey[];
  hero: HeroContent;
  intro?: IntroContent;
  offerings: OfferingsContent;
  info?: InfoContent;
  gallery: GallerySectionContent;
  faqs: FaqItem[];
  cta: CtaContent;
}

export interface Testimonial {
  quote: string;
  name: string;
  service?: string;
  source?: string;
  /** The client agreed to be quoted; entries without it are never shown. */
  permission?: boolean;
}

export interface InstagramPost {
  src: string;
  alt: string;
  url: string;
}
