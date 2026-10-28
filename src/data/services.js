/* =====================================================================
   SERVICE PAGES — Hair, Skin, Nails, Lashes, Makeup.
   ---------------------------------------------------------------------
   Everything on these pages comes from here. The treatment lists are a
   PROPOSED menu: confirm, rename or remove items to match what the
   studio actually offers. While `confirmed` is false, each page shows
   a short note that treatments are subject to confirmation.

   `order` decides which sections appear and in what order, and each
   section has a `variant` so the pages don't all look the same.
   Title lines: wrap a word in *asterisks* to set it in gold italic.
   `price` on a treatment (optional): the real starting price exactly as it
   should appear, e.g. 'From ₹1,500'. Left empty, no price is shown.
   ===================================================================== */
import { HAIR_IMAGES, SKIN_IMAGES, NAILS_IMAGES, LASH_IMAGES, MAKEUP_IMAGES } from './images.js';

export const SERVICE_PAGES = {
  hair: {
    slug: 'hair',
    name: 'Hair',
    booking: 'Hair',
    confirmed: false,
    meta: {
      title: 'Hair Styling, Cuts & Colour',
      description: 'Haircuts, styling, hair colour, hair-care treatments and occasion hairstyling at Eden Glow Studio. Send a hair appointment enquiry on WhatsApp.',
    },
    order: ['intro', 'offerings', 'gallery', 'faqs', 'cta'],
    hero: {
      variant: 'arch',
      eyebrow: 'Hair at Eden Glow',
      title: ['Hair that feels', 'like *you.*'],
      text: 'Cuts, colour, care and styling — shaped around your texture, your routine and the way you like to wear it.',
      image: HAIR_IMAGES.hero,
    },
    intro: {
      eyebrow: 'Our approach',
      title: ['Start with a', '*conversation.*'],
      paragraphs: [
        'Good hair begins long before the scissors come out. We talk through your hair’s texture and history, how much time you spend styling it, and what you’d love it to do.',
        'From there we suggest what will genuinely suit you — whether that’s a fresh shape, a softer colour, a little care, or simply a beautiful blow-dry.',
      ],
      image: HAIR_IMAGES.intro,
    },
    offerings: {
      variant: 'rows',
      eyebrow: 'Hair services',
      title: ['Four ways to', '*refresh.*'],
      items: [
        {
          title: 'Haircuts & styling',
          text: 'Precision cuts and finishing styles shaped around your face, texture and lifestyle.',
          price: '',
          includes: ['Consultation and cut', 'Wash, cut and blow-dry', 'Blow-dry and finish'],
          image: HAIR_IMAGES.cut,
        },
        {
          title: 'Hair colouring',
          text: 'Colour chosen with your skin tone and maintenance in mind — from a subtle refresh to a bolder change.',
          price: '',
          includes: ['Root and all-over colour', 'Highlights and soft blends', 'Colour consultation'],
          image: HAIR_IMAGES.colour,
        },
        {
          title: 'Hair treatments',
          text: 'Nourishing in-salon care to help hair feel softer, smoother and easier to manage.',
          price: '',
          includes: ['Conditioning treatments', 'Scalp-care rituals', 'Advice for home care'],
          image: HAIR_IMAGES.treatment,
        },
        {
          title: 'Occasion hairstyling',
          text: 'Updos, curls and polished styles for weddings, celebrations and evenings out.',
          price: '',
          includes: ['Updos and braids', 'Curls and waves', 'Bridal and guest styling'],
          image: HAIR_IMAGES.occasion,
        },
      ],
    },
    gallery: { eyebrow: 'Hair gallery', title: ['Texture, colour', 'and *shape.*'], cat: 'Hair' },
    faqs: [
      { q: 'How long does a hair appointment take?', a: 'It depends on the service and your hair. When the studio confirms your appointment, they’ll let you know how much time to allow.' },
      { q: 'Should I come with clean hair?', a: 'For most cuts and styling, arriving with hair as you normally wear it helps us see how it behaves. The studio will advise if your service needs anything different.' },
      { q: 'Can I bring reference photos?', a: 'Yes, please do. Photos are one of the easiest ways to show what you like — and what you don’t.' },
      { q: 'Do I need a consultation before colouring?', a: 'For bigger colour changes, a conversation beforehand helps plan the right approach. Mention it in your enquiry and the studio will advise.' },
    ],
    cta: { title: ['Ready for a', '*hair refresh?*'], text: 'Tell us what you have in mind and the studio will reply to confirm availability.', label: 'Book Hair Appointment' },
  },

  skin: {
    slug: 'skin',
    name: 'Skin',
    booking: 'Skin',
    confirmed: false,
    meta: {
      title: 'Facials & Skincare Treatments',
      description: 'Facials, cleansing, hydrating and masking treatments in a calm studio setting at Eden Glow Studio. Send a skin appointment enquiry on WhatsApp.',
    },
    order: ['intro', 'offerings', 'info', 'gallery', 'faqs', 'cta'],
    hero: {
      variant: 'full',
      eyebrow: 'Skin at Eden Glow',
      title: ['Unhurried care', 'for *your skin.*'],
      text: 'Facials and skincare treatments in a calm, quiet setting — an hour to breathe, unwind and leave feeling refreshed.',
      image: SKIN_IMAGES.hero,
    },
    intro: {
      eyebrow: 'Our approach',
      title: ['Gentle, considered', '*skincare.*'],
      paragraphs: [
        'Every skin is different, so every treatment starts by understanding yours — how it feels day to day, your current routine, and anything it’s sensitive to.',
        'Treatments are chosen to leave skin feeling clean, comfortable and cared for. We don’t promise miracles; we focus on a relaxing experience and sensible advice you can continue at home.',
      ],
      image: SKIN_IMAGES.intro,
    },
    offerings: {
      variant: 'grid',
      eyebrow: 'Facials & skincare',
      title: ['Treatments,', '*thoughtfully chosen.*'],
      items: [
        { title: 'Signature facial', text: 'A relaxing facial with cleansing, gentle exfoliation, massage and a mask chosen for your skin.', price: '', image: SKIN_IMAGES.facial },
        { title: 'Cleansing facial', text: 'A deep-cleansing treatment for skin that feels congested or tired.', price: '', image: SKIN_IMAGES.cleanse },
        { title: 'Hydrating masks', text: 'Soothing masks and massage for skin that feels dry or dull.', price: '', image: SKIN_IMAGES.mask },
        { title: 'Skin consultation', text: 'A conversation about your routine with suggestions for caring for your skin at home.', price: '', image: SKIN_IMAGES.homecare },
      ],
    },
    info: {
      variant: 'steps',
      eyebrow: 'What to expect',
      title: ['Your treatment,', '*step by step.*'],
      items: [
        { title: 'Consultation', text: 'A short chat about your skin, routine and any sensitivities or allergies.' },
        { title: 'Cleanse & prepare', text: 'Skin is gently cleansed so the treatment can begin on a fresh base.' },
        { title: 'Treatment', text: 'Your chosen facial, with time to rest while masks and products work.' },
        { title: 'Aftercare', text: 'Simple advice on what to use — and avoid — over the next few days.' },
      ],
      note: 'Please mention any skin conditions, allergies, pregnancy or recent treatments in your enquiry. Treatments are for relaxation and skin care and are not a substitute for medical advice.',
    },
    gallery: { eyebrow: 'Skin gallery', title: ['Calm, clean', '*and glowing.*'], cat: 'Skin' },
    faqs: [
      { q: 'Which facial is right for me?', a: 'If you’re unsure, choose “Not sure yet” in your enquiry. The studio can suggest an option after a short conversation about your skin.' },
      { q: 'Should I wear makeup to my appointment?', a: 'It’s easiest to arrive with minimal or no makeup, but don’t worry if you can’t — skin is cleansed at the start of every treatment.' },
      { q: 'I have sensitive skin. Can I still book?', a: 'Please mention it in your enquiry along with any allergies or reactions you’ve had. The studio will advise whether a treatment is suitable before going ahead.' },
      { q: 'Will I see results straight away?', a: 'Many people find their skin feels fresh and comfortable after a facial, but everyone’s skin responds differently, so we don’t promise specific results.' },
    ],
    cta: { title: ['Time for a', '*little calm?*'], text: 'Send a skin appointment enquiry and the studio will reply to confirm availability.', label: 'Book Skin Appointment' },
  },

  nails: {
    slug: 'nails',
    name: 'Nails',
    booking: 'Nails',
    confirmed: false,
    meta: {
      title: 'Manicure, Pedicure & Nail Art',
      description: 'Manicures, pedicures, gel polish and hand-painted nail art at Eden Glow Studio. Send a nail appointment enquiry on WhatsApp.',
    },
    order: ['offerings', 'gallery', 'info', 'faqs', 'cta'],
    hero: {
      variant: 'framed',
      eyebrow: 'Nails at Eden Glow',
      title: ['The details,', '*done beautifully.*'],
      text: 'Manicures, pedicures and nail art with a clean, considered finish — from a classic nude to hand-painted detail.',
      image: NAILS_IMAGES.hero,
    },
    offerings: {
      variant: 'cards',
      eyebrow: 'Nail services',
      title: ['Hands and feet,', '*cared for.*'],
      intro: 'Every appointment includes careful prep — shaping, cuticle care and a tidy finish — so your colour looks its best and lasts.',
      items: [
        { title: 'Manicure', text: 'Shaping, cuticle care, hand massage and classic polish.', price: '', image: NAILS_IMAGES.manicure },
        { title: 'Pedicure', text: 'A soak, foot care and polish for feet that feel refreshed.', price: '', image: NAILS_IMAGES.pedicure },
        { title: 'Gel polish', text: 'Glossy, long-wearing colour cured under a lamp.', price: '', image: NAILS_IMAGES.gel },
        { title: 'Nail art', text: 'From fine lines to hand-painted designs — bring your inspiration.', price: '', image: NAILS_IMAGES.art },
      ],
    },
    gallery: { eyebrow: 'Nail art gallery', title: ['Colour, shine', 'and *detail.*'], cat: 'Nails', variant: 'masonry' },
    info: {
      variant: 'columns',
      eyebrow: 'Nail care',
      title: ['Make it', '*last longer.*'],
      columns: [
        { title: 'Before your visit', items: ['Remove old gel or extensions only if you’re confident doing it safely — otherwise mention it in your enquiry.', 'Bring photos of designs or colours you love.', 'Let us know about any nail or skin concerns.'] },
        { title: 'After your visit', items: ['Wear gloves for cleaning and washing up.', 'Moisturise hands and cuticles daily.', 'Use your nails as jewels, not tools — avoid prising or scraping.'] },
      ],
    },
    faqs: [
      { q: 'How long does gel polish last?', a: 'Wear time varies with nail type and daily activities. The studio can advise on what to expect for your nails.' },
      { q: 'Can I bring my own nail art design?', a: 'Yes — share photos in your enquiry so the studio can let you know what’s possible and how much time to allow.' },
    ],
    cta: { title: ['Treat your', '*hands to it.*'], text: 'Send a nail appointment enquiry and the studio will reply to confirm availability.', label: 'Book Nail Appointment' },
  },

  lashes: {
    slug: 'lashes',
    name: 'Lashes',
    booking: 'Lashes',
    confirmed: false,
    meta: {
      title: 'Lash Styling & Enhancement',
      description: 'Lash styling and enhancement at Eden Glow Studio — natural to defined looks, with clear preparation and aftercare advice. Send a lash appointment enquiry.',
    },
    order: ['intro', 'offerings', 'gallery', 'info', 'faqs', 'cta'],
    hero: {
      variant: 'split',
      eyebrow: 'Lashes at Eden Glow',
      title: ['Frame your eyes,', '*softly.*'],
      text: 'Lash styling designed around your eye shape — from barely-there definition to a fuller, more striking look.',
      image: LASH_IMAGES.hero,
    },
    intro: {
      eyebrow: 'Our approach',
      title: ['Made for', '*your eye shape.*'],
      paragraphs: [
        'No two sets of eyes are the same. Before we begin, we look at your natural lashes and eye shape and talk about how you want to look — on an ordinary Tuesday and on your best day.',
        'Lash appointments are calm and comfortable: you lie back with your eyes closed while each detail is placed with care.',
      ],
      image: LASH_IMAGES.intro,
    },
    offerings: {
      variant: 'index',
      eyebrow: 'Lash services',
      title: ['Find your', '*lash look.*'],
      image: LASH_IMAGES.technician,
      items: [
        { title: 'Natural lash styling', text: 'Soft, subtle definition that looks like your lashes on a very good day.', price: '' },
        { title: 'Fuller, defined looks', text: 'More density and drama for a striking, polished finish.', price: '' },
        { title: 'Lash lift & tint', text: 'A curl and colour for your own natural lashes — no extensions.', price: '' },
        { title: 'Lash refills', text: 'Maintenance appointments to keep your set looking full.', price: '' },
      ],
    },
    gallery: { eyebrow: 'Close-up', title: ['In the', '*details.*'], cat: 'Lashes', variant: 'strip' },
    info: {
      variant: 'columns',
      eyebrow: 'Care & preparation',
      title: ['Before and', '*after.*'],
      columns: [
        { title: 'Preparing for your appointment', items: ['Arrive with clean eyes — no mascara or eye makeup.', 'Remove contact lenses, or bring your case.', 'Avoid caffeine just before, so it’s easier to relax with eyes closed.', 'Mention any allergies, sensitivity or eye conditions in your enquiry.'] },
        { title: 'Aftercare', items: ['Keep lashes dry for the time your stylist advises.', 'Avoid oil-based products around the eyes.', 'Brush lashes gently each morning with a clean spoolie.', 'Don’t pull or pick at lashes — book a refill or removal instead.'] },
      ],
    },
    faqs: [
      { q: 'How long does a lash appointment take?', a: 'It depends on the look you choose. The studio will tell you how much time to allow when confirming your appointment.' },
      { q: 'Will lash styling damage my natural lashes?', a: 'Careful application and good aftercare help protect your natural lashes. Please follow your stylist’s aftercare advice and avoid pulling at lashes.' },
      { q: 'I have sensitive eyes. Can I still book?', a: 'Please mention it in your enquiry. The studio may suggest a patch test or a different option before going ahead.' },
      { q: 'How often will I need a refill?', a: 'It varies from person to person as natural lashes shed. Your stylist can advise on timing for you.' },
    ],
    cta: { title: ['Ready to', '*flutter?*'], text: 'Send a lash appointment enquiry and the studio will reply to confirm availability.', label: 'Book Lash Appointment' },
  },
};

/* Makeup page — its own layout (bridal / occasion / enquiry). */
export const MAKEUP_PAGE = {
  booking: 'Makeup',
  confirmed: false,
  meta: {
    title: 'Bridal, Party & Occasion Makeup',
    description: 'Bridal, party and occasion makeup artistry at Eden Glow Studio — looks designed around your features, outfit and day. Send a makeup enquiry on WhatsApp.',
  },
  hero: {
    variant: 'full',
    eyebrow: 'Makeup artistry',
    title: ['Every occasion,', 'your kind of *beautiful.*'],
    text: 'Soft and luminous or full glamour — makeup designed around your features, your outfit and the way you want to feel.',
    image: MAKEUP_IMAGES.hero,
  },
  bridal: {
    eyebrow: 'Bridal makeup',
    title: ['For the day', 'you’ll *always remember.*'],
    paragraphs: [
      'Your wedding makeup should look like you — just at your most radiant. We plan your look together, considering your outfit, jewellery, skin and the light you’ll be photographed in.',
      'Looks are built to feel comfortable and to last through the ceremony and celebrations.',
    ],
    points: ['Pre-wedding consultation', 'Wedding-day makeup', 'Pre-wedding and reception looks', 'Makeup for family and bridesmaids'],
    image: MAKEUP_IMAGES.bridal,
    detail: MAKEUP_IMAGES.bridalDetail,
  },
  occasion: {
    eyebrow: 'Party & occasion',
    title: ['Ready for', '*the evening.*'],
    paragraphs: [
      'Festive gatherings, family functions, parties and photoshoots — makeup that suits the moment, from fresh and natural to bold and glamorous.',
    ],
    points: ['Party makeup', 'Festive and family occasions', 'Engagement and reception', 'Photoshoot makeup'],
    image: MAKEUP_IMAGES.occasion,
    detail: MAKEUP_IMAGES.occasionDetail,
  },
  enquiry: {
    eyebrow: 'Makeup enquiry',
    title: ['Tell us about', '*your occasion.*'],
    text: 'For weddings and events, share the date, location, number of people needing makeup and your preferred look. The studio will reply with availability and details.',
    checklist: ['Occasion and date', 'Getting-ready location', 'Number of people', 'Outfit colours or inspiration photos'],
    image: MAKEUP_IMAGES.enquiry,
  },
  faqs: [
    { q: 'How early should I enquire for bridal makeup?', a: 'As early as you can, especially for busy wedding seasons. The studio will confirm availability for your date.' },
    { q: 'Do you offer a trial?', a: 'Ask about a pre-wedding consultation in your enquiry, and the studio will let you know what’s available.' },
    { q: 'Can you do makeup for my family or bridal party?', a: 'Mention how many people need makeup in your enquiry so the studio can plan the timing.' },
  ],
  cta: { title: ['Let’s plan', '*your look.*'], text: 'Send a makeup enquiry and the studio will reply to confirm availability.', label: 'Book Makeup Appointment' },
};
