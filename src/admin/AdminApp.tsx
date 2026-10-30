import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAdmin } from './auth.tsx';
import AdminLayout from './components/AdminLayout.tsx';
import Login from './pages/Login.tsx';
import Dashboard from './pages/Dashboard.tsx';
import './admin.css';

const Invoices = lazy(() => import('./pages/Invoices.tsx'));
const CreateBill = lazy(() => import('./pages/CreateBill.tsx'));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail.tsx'));
const Customers = lazy(() => import('./pages/Customers.tsx'));
const Appointments = lazy(() => import('./pages/Appointments.tsx'));
const Services = lazy(() => import('./pages/Services.tsx'));
const Expenses = lazy(() => import('./pages/Expenses.tsx'));
const Reports = lazy(() => import('./pages/Reports.tsx'));
const Settings = lazy(() => import('./pages/Settings.tsx'));

const page = (el: ReactNode) => <Suspense fallback={<div className="ad-boot" aria-busy="true" />}>{el}</Suspense>;

/* Everything under /admin. Kept apart from the public site's layout, header and footer. */
export default function AdminApp() {
  useEffect(() => {
    // The admin is never meant to appear in search results.
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex, nofollow';
    document.head.appendChild(m);
    document.body.classList.add('is-admin');
    return () => {
      m.remove();
      document.body.classList.remove('is-admin');
    };
  }, []);

  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="invoices" element={page(<Invoices />)} />
          <Route path="invoices/new" element={page(<CreateBill />)} />
          <Route path="invoices/:id" element={page(<InvoiceDetail />)} />
          <Route path="customers" element={page(<Customers />)} />
          <Route path="appointments" element={page(<Appointments />)} />
          <Route path="services" element={page(<Services />)} />
          <Route path="expenses" element={page(<Expenses />)} />
          <Route path="reports" element={page(<Reports />)} />
          <Route path="settings" element={page(<Settings />)} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
