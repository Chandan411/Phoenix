import React, { useState } from 'react';
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import Dashboard from './components/Dashboard';
import InvoiceForm from './components/InvoiceForm';
import InvoiceList from './components/InvoiceList';
import Login from './components/Login';
import { useAuth } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';

const navLinkStyle = (active) => ({
  color: '#fff',
  fontWeight: 600,
  fontSize: '1.08rem',
  textDecoration: 'none',
  padding: '8px 16px',
  borderRadius: 8,
  transition: 'background 0.2s',
  background: active ? 'rgba(255,255,255,0.10)' : 'transparent',
});

export default function App() {
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [refreshList, setRefreshList] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const refreshAndGoToDashboard = () => {
    setRefreshList((r) => !r);
    navigate('/dashboard');
  };

  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} />
      <header
        className="app-header"
        style={{
          background: 'linear-gradient(90deg, #4F8CFF 60%, #6FCF97 100%)',
          color: '#fff',
          boxShadow: '0 2px 12px rgba(79,140,255,0.10)',
          borderRadius: '0 0 18px 18px',
          padding: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px 12px 24px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ background: '#fff', borderRadius: '12px', padding: 6, display: 'flex', alignItems: 'center', boxShadow: '0 2px 8px #E3E8EE' }}>
              <ReceiptLongOutlinedIcon sx={{ color: '#4F8CFF', fontSize: 36 }} />
            </span>
            <span>
              <span
                className="bill-e-zee-title"
                style={{ color: '#222B45', fontFamily: 'Inter, Segoe UI, Arial, sans-serif', fontWeight: 800, fontSize: '2rem', letterSpacing: 2 }}
              >
                Vistar Enterprises
              </span>
              <div style={{ fontSize: '1rem', color: '#e3f2fd', fontWeight: 500, letterSpacing: 1, marginTop: 2 }}>
                Smart Billing Software
              </div>
            </span>
          </span>

          {user && location.pathname !== '/' && (
            <nav className="app-nav" style={{ display: 'flex', gap: 18, marginLeft: 'auto', alignItems: 'center' }}>
              <Link to="/dashboard" className="app-nav-link" style={navLinkStyle(location.pathname === '/dashboard')}>
                Dashboard
              </Link>
              <Link to="/invoices" className="app-nav-link" style={navLinkStyle(location.pathname === '/invoices')}>
                Invoices
              </Link>
              <Link to="/invoices/new" className="app-nav-link" style={navLinkStyle(location.pathname === '/invoices/new')}>
                Create Invoice
              </Link>
              <button
                onClick={handleLogout}
                style={{
                  color: '#fff',
                  background: 'transparent',
                  border: '1px solid #fff',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontWeight: 600,
                  fontSize: '1.08rem',
                  cursor: 'pointer',
                  marginLeft: 8,
                }}
              >
                Logout
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard refresh={refreshList} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/invoices"
            element={
              <ProtectedRoute>
                <InvoiceList onEdit={setEditingInvoice} refresh={refreshList} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/invoices/new"
            element={
              <ProtectedRoute>
                <InvoiceForm invoice={null} onDone={refreshAndGoToDashboard} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/invoices/:id/edit"
            element={
              <ProtectedRoute>
                <InvoiceForm
                  invoice={editingInvoice}
                  onDone={() => {
                    setEditingInvoice(null);
                    refreshAndGoToDashboard();
                  }}
                />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} replace />} />
        </Routes>
      </main>
    </>
  );
}