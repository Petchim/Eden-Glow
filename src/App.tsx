import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout.tsx';
import Home from './pages/Home.tsx';

// Pages other than Home load on demand, keeping the first visit light.
const Hair = lazy(() => import('./pages/Hair.tsx'));
const Skin = lazy(() => import('./pages/Skin.tsx'));
const Nails = lazy(() => import('./pages/Nails.tsx'));
const Lashes = lazy(() => import('./pages/Lashes.tsx'));
const Makeup = lazy(() => import('./pages/Makeup.tsx'));
const Academy = lazy(() => import('./pages/Academy.tsx'));
const Gallery = lazy(() => import('./pages/Gallery.tsx'));
const Contact = lazy(() => import('./pages/Contact.tsx'));
const BookAppointment = lazy(() => import('./pages/BookAppointment.tsx'));
const NotFound = lazy(() => import('./pages/NotFound.tsx'));
// Owner's admin panel: its own chunk and layout, never loaded by public visitors.
const AdminApp = lazy(() => import('./admin/AdminApp.tsx'));

const page = (el: ReactNode) => <Suspense fallback={<div className="page-loading" aria-hidden="true" />}>{el}</Suspense>;

export default function App() {
  return (
    <Routes>
      <Route path="admin/*" element={page(<AdminApp />)} />
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
