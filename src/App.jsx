import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx';
import Home from './pages/Home.jsx';

// Pages other than Home load on demand, keeping the first visit light.
const Hair = lazy(() => import('./pages/Hair.jsx'));
const Skin = lazy(() => import('./pages/Skin.jsx'));
const Nails = lazy(() => import('./pages/Nails.jsx'));
const Lashes = lazy(() => import('./pages/Lashes.jsx'));
const Makeup = lazy(() => import('./pages/Makeup.jsx'));
const Academy = lazy(() => import('./pages/Academy.jsx'));
const Gallery = lazy(() => import('./pages/Gallery.jsx'));
const Contact = lazy(() => import('./pages/Contact.jsx'));
const BookAppointment = lazy(() => import('./pages/BookAppointment.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

const page = (el) => <Suspense fallback={<div className="page-loading" aria-hidden="true" />}>{el}</Suspense>;

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="hair" element={page(<Hair />)} />
        <Route path="skin" element={page(<Skin />)} />
        <Route path="nails" element={page(<Nails />)} />
        <Route path="lashes" element={page(<Lashes />)} />
        <Route path="makeup" element={page(<Makeup />)} />
        <Route path="academy" element={page(<Academy />)} />
        <Route path="gallery" element={page(<Gallery />)} />
        <Route path="contact" element={page(<Contact />)} />
        <Route path="book-appointment" element={page(<BookAppointment />)} />
        <Route path="*" element={page(<NotFound />)} />
      </Route>
    </Routes>
  );
}
