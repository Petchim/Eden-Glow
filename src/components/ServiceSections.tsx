import { Link } from 'react-router-dom';
import type { GallerySectionContent, InfoContent, IntroContent, OfferingsContent } from '../types/content.ts';
import { bookLink } from '../data/content.ts';
import { galleryFor } from '../data/images.ts';
import GalleryGrid from './GalleryGrid.tsx';
import Img from './ui/Img.tsx';
import Icon from './ui/Icon.tsx';
import Leaf from './ui/Leaf.tsx';
import Reveal from './ui/Reveal.tsx';
import SectionTitle from './ui/SectionTitle.tsx';

const num = (i: number) => String(i + 1).padStart(2, '0');

/* Two-column introduction: copy + photo. `flip` puts the photo first. */
export function Intro({ data, id, flip = false }: { data: IntroContent; id: string; flip?: boolean }) {
  return (
    <section className="section intro" aria-labelledby={`${id}-intro`}>
      <div className={`wrap intro-grid ${flip ? 'intro-grid--flip' : ''}`}>
        <div className="intro-copy">
          <SectionTitle eyebrow={data.eyebrow} lines={data.title} id={`${id}-intro`} />
          <Reveal delay={120}>
            {data.paragraphs.map((p) => <p className="lede intro-p" key={p.slice(0, 24)}>{p}</p>)}
          </Reveal>
        </div>
        <div className="intro-art">
          <Reveal variant="curtain" className="intro-photo">
            <Img {...data.image} sizes="(max-width: 900px) 90vw, 42vw" />
          </Reveal>
          <span className="intro-frame" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

/* The treatment menu, in one of four layouts. */
export function Offerings({ data, id, booking, confirmed }: { data: OfferingsContent; id: string; booking: string; confirmed: boolean }) {
  const { variant, items } = data;
  return (
    <section className={`section section--alt offer offer--${variant}`} aria-labelledby={`${id}-offer`}>
      <div className="wrap">
        <div className="offer-head">
          <SectionTitle eyebrow={data.eyebrow} lines={data.title} id={`${id}-offer`} />
          <Reveal delay={100} className="offer-intro">
            {data.intro && <p className="lede">{data.intro}</p>}
            {!confirmed && <p className="fine">Treatments shown are a guide and subject to confirmation — please enquire to check availability.</p>}
          </Reveal>
        </div>

        {variant === 'rows' && (
          <div className="orows">
            {items.map((it, i) => (
              <Reveal as="article" className="orow" key={it.title}>
                {it.image && <div className="orow-img zoom-on-hover"><Img {...it.image} sizes="(max-width: 900px) 92vw, 46vw" /></div>}
                <div className="orow-body">
                  <span className="o-num">{num(i)}</span>
                  <h3 className="o-title">{it.title}</h3>
                  <p className="o-text">{it.text}</p>
                  {it.price && <p className="o-price">{it.price}</p>}
                  {it.includes && (
                    <ul className="o-list">{it.includes.map((x) => <li key={x}>{x}</li>)}</ul>
                  )}
                  <Link className="tlink" to={bookLink(booking, it.title)}><span>Enquire about {it.title.toLowerCase()}</span><Icon name="arrow" /></Link>
                </div>
              </Reveal>
            ))}
          </div>
        )}

        {(variant === 'grid' || variant === 'cards') && (
          <div className={`ogrid ogrid--${variant}`}>
            {items.map((it, i) => (
              <Reveal as="article" className="ocard" key={it.title} delay={(i % 4) * 90}>
                <Link to={bookLink(booking, it.title)} className="ocard-link">
                  {it.image && <div className="ocard-img zoom-on-hover"><Img {...it.image} sizes="(max-width: 700px) 92vw, (max-width: 1100px) 46vw, 25vw" /></div>}
                  <span className="o-num">{num(i)}</span>
                  <h3 className="o-title">{it.title}</h3>
                  <p className="o-text">{it.text}</p>
                  {it.price && <p className="o-price">{it.price}</p>}
                  <span className="tlink"><span>Enquire</span><Icon name="arrow" /></span>
                </Link>
              </Reveal>
            ))}
          </div>
        )}

        {variant === 'index' && (
          <div className="oindex">
            <ol className="oindex-list">
              {items.map((it, i) => (
                <Reveal as="li" key={it.title} delay={i * 80}>
                  <Link to={bookLink(booking, it.title)}>
                    <span className="o-num">{num(i)}</span>
                    <span className="oindex-body">
                      <span className="o-title">{it.title}</span>
                      <span className="o-text">{it.text}</span>
                      {it.price && <span className="o-price">{it.price}</span>}
                    </span>
                    <Icon name="arrow" />
                  </Link>
                </Reveal>
              ))}
            </ol>
            <div className="oindex-art">
              {data.image && <Reveal variant="curtain" className="oindex-photo"><Img {...data.image} sizes="(max-width: 900px) 90vw, 36vw" /></Reveal>}
              <Leaf className="oindex-leaf" stroke={0.8} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* Practical information: numbered steps or two lists side by side. */
export function Info({ data, id }: { data: InfoContent; id: string }) {
  return (
    <section className="section info" aria-labelledby={`${id}-info`}>
      <div className="wrap">
        <SectionTitle eyebrow={data.eyebrow} lines={data.title} id={`${id}-info`} />
        {data.variant === 'steps' ? (
          <ol className="isteps">
            {data.items.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 90}>
                <span className="isteps-num">{['i', 'ii', 'iii', 'iv', 'v'][i]}.</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </Reveal>
            ))}
          </ol>
        ) : (
          <div className="icols">
            {data.columns.map((c, i) => (
              <Reveal className="icol" key={c.title} delay={i * 120}>
                <h3>{c.title}</h3>
                <ul>{c.items.map((x) => <li key={x}>{x}</li>)}</ul>
              </Reveal>
            ))}
          </div>
        )}
        {data.note && <p className="fine info-note">{data.note}</p>}
      </div>
    </section>
  );
}

/* Category gallery with a link through to the full gallery. */
export function GallerySection({ data, id }: { data: GallerySectionContent; id: string }) {
  return (
    <section className="section gsection" aria-labelledby={`${id}-gallery`}>
      <div className="wrap">
        <div className="gsection-head">
          <SectionTitle eyebrow={data.eyebrow} lines={data.title} id={`${id}-gallery`} />
          <Link className="tlink" to={`/gallery?category=${encodeURIComponent(data.cat)}`}><span>View in full gallery</span><Icon name="arrow" /></Link>
        </div>
        <GalleryGrid items={galleryFor(data.cat)} variant={data.variant || 'masonry'} columns={[[1100, 4], [700, 3], [0, 2]]} />
      </div>
    </section>
  );
}
