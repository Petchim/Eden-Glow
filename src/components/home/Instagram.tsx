import { INSTAGRAM_POSTS } from '../../data/content.ts';
import { BUSINESS } from '../../config/business.ts';
import Img from '../ui/Img.tsx';
import Reveal from '../ui/Reveal.tsx';
import SectionTitle from '../ui/SectionTitle.tsx';
import Button from '../ui/Button.tsx';
import Icon from '../ui/Icon.tsx';

/* Instagram strip: rendered on the home page only once `instagramUrl` is set. Shows the studio's
   own posts from data/content.ts when there are any; otherwise just the follow link. */
export default function Instagram() {
  const posts = INSTAGRAM_POSTS.filter((p) => p.src && p.url).slice(0, 6);
  const handle = BUSINESS.instagramHandle || 'Instagram';

  return (
    <section className="section section--alt igs" aria-labelledby="igs-title">
      <div className="wrap">
        <div className="igs-head">
          <SectionTitle eyebrow="On Instagram" lines={['Follow the', '*glow.*']} id="igs-title" />
          <Reveal delay={120} className="igs-follow">
            <Button href={BUSINESS.instagramUrl} variant="line" icon="instagram" aria-label={`${handle} on Instagram (opens in a new tab)`}>
              {handle}
            </Button>
          </Reveal>
        </div>
        {posts.length > 0 && (
          <ul className="igs-grid">
            {posts.map((p, i) => (
              <Reveal as="li" key={p.url} variant="curtain" delay={i * 80}>
                <a className="igs-tile" href={p.url} target="_blank" rel="noopener noreferrer">
                  <Img src={p.src} alt={p.alt} sizes="(max-width: 700px) 50vw, 16vw" />
                  <span className="igs-icon" aria-hidden="true"><Icon name="instagram" size={20} /></span>
                </a>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
