import { NAV, BOOK_PATH } from '../data/content.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import Leaf from '../components/ui/Leaf.jsx';

export default function NotFound() {
  usePageMeta('Page Not Found', 'The page you were looking for could not be found.', { noindex: true });

  return (
    <section className="section nf" aria-labelledby="page-title">
      <div className="wrap nf-in">
        <Leaf className="nf-leaf" stroke={0.8} />
        <p className="eyebrow">Error 404</p>
        <h1 className="h2" id="page-title">This page has <em>wandered off.</em></h1>
        <p className="lede nf-text">The page you’re looking for doesn’t exist or may have moved. Try one of these instead:</p>
        <ul className="nf-links">
          {NAV.map((l) => <li key={l.to}><Link to={l.to}>{l.label}</Link></li>)}
        </ul>
        <div className="ctas nf-ctas">
          <Button to="/" arrow>Back to Home</Button>
          <Button to={BOOK_PATH} variant="line">Book Appointment</Button>
        </div>
      </div>
    </section>
  );
}
