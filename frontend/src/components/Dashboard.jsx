import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listInvoices, invoicePdfUrl } from '../api';
import '../App.css';
import CurrencyFormat from '../utils/CurrencyFormat.jsx';

export default function Dashboard({ refresh }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const data = await listInvoices({});
      setInvoices(data);
      setLoading(false);
    }
    fetchData();
  }, [refresh]);

  const totalInvoices = invoices.length;
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const formattedRevenue = <CurrencyFormat value={totalRevenue} />;
  const recentInvoices = invoices.slice(0, 5);

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="dashboard-cards">
        <Link to="/invoices" className="dashboard-card">
          <div className="dashboard-card-title">Total Invoices</div>
          <div className="dashboard-card-value">{loading ? '--' : totalInvoices}</div>
        </Link>
        <div className="dashboard-card dashboard-card-revenue">
          <div className="dashboard-card-title">Total Revenue</div>
          <div className="dashboard-card-value">{loading ? '--' : formattedRevenue}</div>
        </div>
      </div>
      <div>
        <div className="vibrant-header">
          <div className="vibrant-header-title">Recent Invoices</div>
          <div className="vibrant-header-subtitle">Last 5 created bills</div>
        </div>
        {loading ? (
          <>
            <div className="skeleton" style={{ width: 200, height: 32, marginBottom: 16 }} />
            <div className="skeleton" style={{ width: '100%', height: 40, marginBottom: 8 }} />
          </>
        ) : (
          recentInvoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#888', fontSize: '1.1rem' }}>No invoices to display</div>
          ) : (
            <div className="vibrant-table-container" style={{ maxWidth: 700, margin: '0 auto' }}>
              <table className="vibrant-table" style={{ fontSize: '0.98rem', width: '100%', textAlign: 'center' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center', width: 40, background: '#4F8CFF', color: '#fff' }}>ID</th>
                    <th style={{ textAlign: 'left', width: 120, background: '#4F8CFF', color: '#fff' }}>Invoice No</th>
                    <th style={{ textAlign: 'center', width: 90, background: '#4F8CFF', color: '#fff' }}>Date</th>
                    <th style={{ textAlign: 'left', width: 120, background: '#4F8CFF', color: '#fff' }}>Customer</th>
                    <th style={{ textAlign: 'right', width: 90, background: '#4F8CFF', color: '#fff' }}>Total</th>
                    <th style={{ textAlign: 'center', width: 60, background: '#4F8CFF', color: '#fff' }}>PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((inv, idx) => (
                    <tr key={inv.id} className={idx % 2 === 0 ? 'even-row' : 'odd-row'}>
                      <td style={{ textAlign: 'center' }}>{inv.id}</td>
                      <td style={{ textAlign: 'left' }}>{inv.invoice_number}</td>
                      <td style={{ textAlign: 'center' }}>{inv.invoice_date}</td>
                      <td style={{ textAlign: 'left' }}>{inv.customer_name}</td>
                      <td style={{ textAlign: 'right' }}><CurrencyFormat value={inv.total} /></td>
                      <td style={{ textAlign: 'center' }}>
                        <a href={invoicePdfUrl(inv.id)} target="_blank" rel="noopener noreferrer">
                          <img src="https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg" alt="PDF" style={{ width: 20, height: 20, marginRight: 4, verticalAlign: 'middle' }} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}