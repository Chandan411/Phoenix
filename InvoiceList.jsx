import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listInvoices, invoicePdfUrl, getInvoice } from '../api';
import CurrencyFormat from '../utils/CurrencyFormat.jsx';
import EditIcon from '@mui/icons-material/EditOutlined';

export default function InvoiceList({ onEdit, refresh }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [customerFilter, setCustomerFilter] = useState('');
  const navigate = useNavigate();

  async function fetchInvoices() {
    setLoading(true);
    try {
      const data = await listInvoices({});
      setInvoices(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvoices();
  }, [refresh]);

  const uniqueCustomers = Array.from(new Set(invoices.map(inv => inv.customer_name).filter(Boolean)));

  // Filter invoices by invoice number, customer name, total, customer, and date range
  const filteredInvoices = invoices.filter(inv => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      inv.invoice_number?.toLowerCase().includes(searchLower) ||
      inv.customer_name?.toLowerCase().includes(searchLower) ||
      (inv.total !== undefined && inv.total !== null && inv.total.toString().includes(search));
    let matchesDate = true;
    if (dateFrom) {
      matchesDate = matchesDate && inv.invoice_date >= dateFrom;
    }
    if (dateTo) {
      matchesDate = matchesDate && inv.invoice_date <= dateTo;
    }
    let matchesCustomer = true;
    if (customerFilter) {
      matchesCustomer = inv.customer_name === customerFilter;
    }
    return matchesSearch && matchesDate && matchesCustomer;
  });

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 20 }}>
      <div className="vibrant-header">
        <div className="vibrant-header-title">All Invoices</div>
        <div className="vibrant-header-subtitle">Your complete billing history</div>
      </div>
      <div style={{
        marginBottom: 28,
        display: 'flex',
        flexWrap: 'nowrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 18,
        maxWidth: 900,
        marginLeft: 'auto',
        marginRight: 'auto',
        background: 'rgba(240,245,255,0.7)',
        borderRadius: 18,
        boxShadow: '0 2px 8px rgba(33,150,243,0.08)',
        padding: '18px 16px',
        overflowX: 'auto',
      }}>
        <input
          type="text"
          placeholder="🔍 Search invoices..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '12px 22px',
            borderRadius: '18px',
            border: '2px solid #2563eb',
            fontSize: '1.15rem',
            width: '100%',
            maxWidth: 340, // Increased width
            background: 'linear-gradient(90deg, #f8fbff 60%, #eaf3fa 100%)',
            color: '#222B45',
            boxShadow: '0 4px 16px rgba(33,150,243,0.10)',
            outline: 'none',
            transition: 'border 0.2s, box-shadow 0.2s',
            flex: '0 0 300px', // Increased flex-basis
          }}
        />
        <select
          value={customerFilter || ''}
          onChange={e => setCustomerFilter(e.target.value)}
          style={{
            padding: '12px 16px',
            borderRadius: '14px',
            border: '2px solid #2563eb',
            fontSize: '1.08rem',
            width: '100%',
            maxWidth: 180,
            background: '#f8fbff',
            color: '#222B45',
            boxShadow: '0 2px 8px rgba(33,150,243,0.08)',
            outline: 'none',
            flex: '0 0 140px',
          }}
        >
          <option value="">All Customers</option>
          {uniqueCustomers.map(cust => (
            <option key={cust} value={cust}>{cust}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom || ''}
          onChange={e => setDateFrom(e.target.value)}
          style={{
            padding: '12px 16px',
            borderRadius: '14px',
            border: '2px solid #2563eb',
            fontSize: '1.08rem',
            width: '100%',
            maxWidth: 140,
            background: '#f8fbff',
            color: '#222B45',
            boxShadow: '0 2px 8px rgba(33,150,243,0.08)',
            outline: 'none',
            flex: '0 0 120px',
          }}
          placeholder="From"
        />
        <input
          type="date"
          value={dateTo || ''}
          onChange={e => setDateTo(e.target.value)}
          style={{
            padding: '12px 16px',
            borderRadius: '14px',
            border: '2px solid #2563eb',
            fontSize: '1.08rem',
            width: '100%',
            maxWidth: 140,
            background: '#f8fbff',
            color: '#222B45',
            boxShadow: '0 2px 8px rgba(33,150,243,0.08)',
            outline: 'none',
            flex: '0 0 120px',
          }}
          placeholder="To"
        />
      </div>
      {loading ? <>
        <div className="skeleton" style={{ width: 200, height: 32, marginBottom: 16 }} />
        <div className="skeleton" style={{ width: '100%', height: 40, marginBottom: 8 }} />
      </> : (
        invoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#888', fontSize: '1.1rem' }}>No invoices to display</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Total</th>
                <th>PDF</th>
                <th>Edit</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map(inv => (
                <tr key={inv.id}>
                  <td>{inv.id}</td>
                  <td>{inv.invoice_number}</td>
                  <td>{inv.invoice_date}</td>
                  <td>{inv.customer_name}</td>
                  <td>
                    <CurrencyFormat value={inv.total} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <a href={invoicePdfUrl(inv.id)} target="_blank" rel="noopener noreferrer">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg" alt="PDF" style={{ width: 20, height: 20, marginRight: 4, verticalAlign: 'middle' }} />
                    </a>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={async () => {
                        const fullInvoice = await getInvoice(inv.id); // This fetches the latest data
                        onEdit(fullInvoice);
                        navigate(`/invoices/${inv.id}/edit`);
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      title="Edit"
                    >
                      <EditIcon style={{ color: '#4F8CFF', fontSize: 22 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}