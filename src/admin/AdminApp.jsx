import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAdmin } from './auth.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import './admin.css';

const Invoices = lazy(() => import('./pages/Invoices.jsx'));
const CreateBill = lazy(() => import('./pages/CreateBill.jsx'));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail.jsx'));
const Customers = lazy(() => import('./pages/Customers.jsx'));
const Appointments = lazy(() => import('./pages/Appointments.jsx'));
const Services = lazy(() => import('./pages/Services.jsx'));
const Expenses = lazy(() => import('./pages/Expenses.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));

const page = (el) => <Suspense fallback={<div className="ad-boot" aria-busy="true" />}>{el}</Suspense>;

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
