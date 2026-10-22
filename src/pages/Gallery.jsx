import { useSearchParams } from 'react-router-dom';
import { GALLERY_CATEGORIES, GALLERY_IMAGES } from '../data/images.js';
import { BOOK_PATH } from '../data/content.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import GalleryGrid from '../components/GalleryGrid.jsx';
import CtaBand from '../components/CtaBand.jsx';
import SectionTitle from '../components/ui/SectionTitle.jsx';
import Reveal from '../components/ui/Reveal.jsx';
import { Link } from 'react-router-dom';

export default function Gallery() {
  usePageMeta('Beauty Gallery', 'Browse hair, skin, nail, lash, makeup and salon interior photography from Eden Glow Studio’s beauty gallery.');
  const [params, setParams] = useSearchParams();
  const requested = params.get('category');
  const filter = GALLERY_CATEGORIES.includes(requested) ? requested : 'All';

  // The filter lives in the URL, so a filtered gallery can be linked to and survives refresh.
  const onFilter = (f) => setParams(f === 'All' ? {} : { category: f }, { replace: true, preventScrollReset: true });

  return (
    <>
      <section className="section gpage" aria-labelledby="page-title">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <ol>
              <li><Link to="/">Home</Link></li>
              <li aria-current="page">Gallery</li>
            </ol>
          </nav>
          <div className="gpage-head">
            <SectionTitle as="h1" eyebrow="Beauty gallery" lines={['A glimpse of', '*the glow.*']} id="page-title" className="gpage-title" />
            <Reveal delay={100}>
              <p className="lede">Hair, skin, nails, lashes, makeup and the spaces in between. Choose a category, then tap any photo to view it larger.</p>
            </Reveal>
          </div>
          <GalleryGrid items={GALLERY_IMAGES} filters filter={filter} onFilter={onFilter} />
        </div>
      </section>
      <CtaBand title={['Seen something', '*you love?*']} text="Share it in your enquiry and we’ll talk about your look." to={BOOK_PATH} />
    </>
  );
}
