import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '../Header.jsx';
import Footer from '../Footer.jsx';
import MobileBookBar from '../MobileBookBar.jsx';

/* Shared shell for every route: header, page area with a soft entrance, footer. */
export default function Layout() {
  const { pathname, hash } = useLocation();
  const mainRef = useRef(null);
  const first = useRef(true);

  // New page: start at the top (or at #hash) and move focus to the content for screen readers.
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname, hash]);

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main" ref={mainRef} tabIndex={-1}>
        <div className="page" key={pathname}>
          <Outlet />
        </div>
      </main>
      <Footer />
      <MobileBookBar />
    </>
  );
}
