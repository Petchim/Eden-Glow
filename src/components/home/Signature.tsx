import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { BOOK_PATH, EXPERIENCE_FEATURES } from '../../data/content.ts';
import { HOME_IMAGES as IMAGES } from '../../data/images.ts';
import { BUSINESS } from '../../config/business.ts';
import { useParallax } from '../../hooks/useUi.ts';
import Img from '../ui/Img.tsx';
import Reveal from '../ui/Reveal.tsx';
import SectionTitle from '../ui/SectionTitle.tsx';
import Button from '../ui/Button.tsx';
import Icon from '../ui/Icon.tsx';

/* Studio action: plays the studio video when one is configured, otherwise opens the salon photos. */
function StudioLink() {
  const inner = (label: string) => (
    <>
      <Icon name="play" size={30} stroke={1} />
      <span>{label}</span>
    </>
  );
  if (BUSINESS.studioVideoUrl) {
    return (
      <a className="studio-link" href={BUSINESS.studioVideoUrl} target="_blank" rel="noopener noreferrer">
        {inner('Watch Our Studio')}
      </a>
    );
  }
  return (
    <Link className="studio-link" to="/gallery?category=Salon%20Interior">
      {inner('Tour Our Studio')}
    </Link>
  );
}

// Claims the studio has not confirmed yet (`confirmed: false`) are left out.
const FEATURES = EXPERIENCE_FEATURES.filter((f) => f.confirmed !== false);

/* The signature experience: a full-bleed portrait meeting an editorial text panel. */
export default function Signature() {
  const media = useRef<HTMLDivElement>(null);
  useParallax(media, 0.05);

  return (
    <section className="xp" aria-labelledby="sig-title">
      <Reveal variant="curtain" className="xp-media">
        <div className="xp-media-in">
          <div className="xp-parallax" ref={media}>
            <Img {...IMAGES.signature} sizes="(max-width: 900px) 100vw, 50vw" />
          </div>
          <span className="xp-frame" aria-hidden="true" />
          <p className="xp-caption" aria-hidden="true">Look good · Feel good · Be you</p>
        </div>
      </Reveal>

      <div className="xp-body">
        <SectionTitle eyebrow="The Eden Glow experience" lines={['Elevate Your', 'Everyday *Beauty.*']} id="sig-title" />
        <Reveal delay={140}>
          <p className="lede xp-story">
            Beauty, for us, is less about changing who you are and more about making room to enjoy it — an hour that is
            entirely yours, to be listened to, cared for, and to leave feeling quietly confident in your own skin.
          </p>
        </Reveal>
        <ul className="xp-features">
          {FEATURES.map((f, i) => (
            <Reveal as="li" key={f.title} delay={200 + i * 90}>
              <Icon name={f.icon} size={26} stroke={1} className="xp-icon" />
              <b>{f.title}</b>
              <span>{f.text}</span>
            </Reveal>
          ))}
        </ul>
        <Reveal delay={560} className="ctas xp-ctas">
          <Button to={BOOK_PATH} arrow>Book Appointment</Button>
          <StudioLink />
        </Reveal>
      </div>
    </section>
  );
}
