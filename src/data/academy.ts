/* =====================================================================
   ACADEMY — keep everything as placeholders until confirmed.
   ---------------------------------------------------------------------
   Do not add course names, fees, durations, eligibility, certificates
   or accreditation unless they are real and confirmed. Anything in
   [square brackets] is displayed as a labelled placeholder.
   ===================================================================== */
import type { FaqItem, HeroContent, IntroContent, Photo } from '../types/content.ts';
import { ACADEMY_IMAGES } from './images.ts';

export interface AcademyCourse {
  name: string;
  duration: string;
  fee: string;
  eligibility: string;
  certificate: string;
  info: string;
}
export interface AcademyContent {
  meta: { title: string; description: string };
  hero: HeroContent;
  intro: IntroContent;
  /** `status` is '' once a course is confirmed. */
  categories: { title: string; text: string; image: Photo; status: string }[];
  courses: AcademyCourse[];
  interests: string[];
  faqs: FaqItem[];
}

export const ACADEMY: AcademyContent = {
  meta: {
    title: 'Beauty Academy & Training',
    description: 'Eden Glow Academy — hands-on beauty education in makeup, hair, nails, lashes and skin. Course details are being finalised; send a training enquiry.',
  },
  hero: {
    variant: 'framed',
    eyebrow: 'Eden Glow Academy',
    title: ['Learn the', 'art of *beauty.*'],
    text: 'Hands-on beauty education for aspiring professionals and enthusiasts, taught in a real studio setting.',
    image: ACADEMY_IMAGES.hero,
  },
  intro: {
    eyebrow: 'Beauty education',
    title: ['Skills you learn', '*by doing.*'],
    paragraphs: [
      'The academy is for people who want to understand beauty properly — the technique, the hygiene, the client conversation and the finishing details that make the difference.',
      'Course details are being finalised. Send an enquiry to register your interest and hear about upcoming programmes first.',
    ],
    image: ACADEMY_IMAGES.intro,
  },

  // Training areas. Set `status` to '' once a course is confirmed.
  categories: [
    { title: 'Makeup artistry', text: '[Short description — to be confirmed]', image: ACADEMY_IMAGES.categories.makeup, status: 'Details coming soon' },
    { title: 'Hair styling', text: '[Short description — to be confirmed]', image: ACADEMY_IMAGES.categories.hair, status: 'Details coming soon' },
    { title: 'Nail technology', text: '[Short description — to be confirmed]', image: ACADEMY_IMAGES.categories.nails, status: 'Details coming soon' },
    { title: 'Lash styling', text: '[Short description — to be confirmed]', image: ACADEMY_IMAGES.categories.lashes, status: 'Details coming soon' },
    { title: 'Skin care', text: '[Short description — to be confirmed]', image: ACADEMY_IMAGES.categories.skin, status: 'Details coming soon' },
  ],

  // Course details. Replace each [placeholder] once confirmed.
  courses: [
    { name: '[Course name]', duration: '[Duration — to be confirmed]', fee: '[Fee — to be confirmed]', eligibility: '[Eligibility — to be confirmed]', certificate: '[Certificate — to be confirmed]', info: '[Short course description]' },
    { name: '[Course name]', duration: '[Duration — to be confirmed]', fee: '[Fee — to be confirmed]', eligibility: '[Eligibility — to be confirmed]', certificate: '[Certificate — to be confirmed]', info: '[Short course description]' },
  ],

  // Shown in the enquiry form
  interests: ['Makeup artistry', 'Hair styling', 'Nail technology', 'Lash styling', 'Skin care', 'Not sure yet'],

  faqs: [
    { q: 'When do courses start?', a: 'Dates are being finalised. Send an enquiry and the studio will let you know about upcoming programmes.' },
    { q: 'Do I need previous experience?', a: 'Eligibility will be confirmed for each course. Mention your current experience in your enquiry so the studio can guide you.' },
    { q: 'Will I receive a certificate?', a: 'Certificate details will be confirmed for each course before enrolment. Please ask in your enquiry.' },
    { q: 'What are the fees?', a: 'Fees will be shared once course details are confirmed.' },
  ],
};
