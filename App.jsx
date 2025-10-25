import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Dashboard from './components/Dashboard';
import InvoiceForm from './components/InvoiceForm';
import InvoiceList from './components/InvoiceList';
import Login from './components/Login';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';

export default function App() {
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [refreshList, setRefreshList] = useState(false);
  // Persist login state using localStorage
  const [isLogin, setIsLogin] = useState(() => localStorage.getItem('isLogin') === 'true');
  const navigate = useNavigate();
  const location = useLocation();

  // Called from Login component after successful login
  const handleDataFromChild = (data) => {
    setIsLogin(data);
    localStorage.setItem('isLogin', data ? 'true' : 'false');
  };

  const handleLogout = () => {
    setIsLogin(false);
    localStorage.removeItem('isLogin');
    navigate('/');
  };

  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} />
      <header className="app-header" style={{ background: 'linear-gradient(90deg, #4F8CFF 60%, #6FCF97 100%)', color: '#fff', boxShadow: '0 2px 12px rgba(79,140,255,0.10)', borderRadius: '0 0 18px 18px', padding: '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px 12px 24px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ background: '#fff', borderRadius: '12px', padding: 6, display: 'flex', alignItems: 'center', boxShadow: '0 2px 8px #E3E8EE' }}>
              <ReceiptLongOutlinedIcon sx={{ color: '#4F8CFF', fontSize: 36 }} />
            </span>
            <span>
              <span className="bill-e-zee-title" style={{ color: '#222B45', fontFamily: 'Inter, Segoe UI, Arial, sans-serif', fontWeight: 800, fontSize: '2rem', letterSpacing: 2 }}>Phoenix Enterprises</span>
              <div style={{ fontSize: '1rem', color: '#e3f2fd', fontWeight: 500, letterSpacing: 1, marginTop: 2 }}>Smart Billing Software</div>
            </span>
          </span>
          {
            isLogin && location.pathname !== '/' && (
              <nav className="app-nav" style={{ display: 'flex', gap: 18, marginLeft: 'auto', alignItems: 'center' }}>
                <Link to="/dashboard" className="app-nav-link" style={{ color: '#fff', fontWeight: 600, fontSize: '1.08rem', textDecoration: 'none', padding: '8px 16px', borderRadius: 8, transition: 'background 0.2s', background: location.pathname === '/dashboard' ? 'rgba(255,255,255,0.10)' : 'transparent' }}>Dashboard</Link>
                <Link to="/invoices" className="app-nav-link" style={{ color: '#fff', fontWeight: 600, fontSize: '1.08rem', textDecoration: 'none', padding: '8px 16px', borderRadius: 8, transition: 'background 0.2s', background: location.pathname === '/invoices' ? 'rgba(255,255,255,0.10)' : 'transparent' }}>Invoices</Link>
                <Link to="/invoices/new" className="app-nav-link" style={{ color: '#fff', fontWeight: 600, fontSize: '1.08rem', textDecoration: 'none', padding: '8px 16px', borderRadius: 8, background: location.pathname === '/invoices/new' ? 'rgba(255,255,255,0.10)' : 'transparent' }}>Create Invoice</Link>
                <button onClick={handleLogout} style={{ color: '#fff', background: 'transparent', border: '1px solid #fff', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: '1.08rem', cursor: 'pointer', marginLeft: 8 }}>Logout</button>
              </nav>
            )
          }
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Login sendDataToParent={handleDataFromChild} />} />
          <Route path="/dashboard" element={<Dashboard refresh={refreshList} />} />
          <Route path="/invoices" element={
            <InvoiceList
              onEdit={inv => {
                setEditingInvoice(inv);
                // navigate to edit page
              }}
              refresh={refreshList}
            />
          } />
          <Route path="/invoices/new" element={
            <InvoiceForm
              invoice={null}
              onDone={() => {
                setRefreshList(r => !r);
                navigate('/dashboard'); // Redirect to dashboard after creation
              }}
            />
          } />
          <Route path="/invoices/:id/edit" element={
            <InvoiceForm
              invoice={editingInvoice}
              onDone={() => {
                setEditingInvoice(null);
                setRefreshList(r => !r);
                navigate('/dashboard'); // Redirect to dashboard after edit
              }}
            />
          } />
        </Routes>
      </main>
      <style>{`
        .app-header {
          padding: 16px;
          background: #0b5fff;
          color: #fff;
        }
        .app-title {
          margin: 0;
        }
        .app-nav {
          margin-top: 8px;
        }
        .app-nav-link {
          margin-right: 16px;
          color: #fff;
          text-decoration: none;
          font-weight: 500;
          font-size: 1.08rem;
        }
        .app-nav-link:last-child {
          margin-right: 0;
        }
        .app-main {
          padding: 16px;
        }
      `}</style>
    </>
  );
}