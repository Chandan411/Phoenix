import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { listInvoices, openInvoicePdf, getInvoice } from '../api';
import CurrencyFormat from '../utils/CurrencyFormat.jsx';
import EditIcon from '@mui/icons-material/EditOutlined';

const filterBase = {
  borderRadius: '14px',
  border: '2px solid #2563eb',
  background: '#f8fbff',
  color: '#222B45',
  boxShadow: '0 2px 8px rgba(33,150,243,0.08)',
  outline: 'none',
};

export default function InvoiceList({ onEdit, refresh }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchInvoices() {
      setLoading(true);
      try {
        const data = await listInvoices({});
        setInvoices(data);
      } catch {
        toast.error('Could not load invoices');
      } finally {
        setLoading(false);
      }
    }
    fetchInvoices();
  }, [refresh]);

  const uniqueCustomers = Array.from(new Set(invoices.map((inv) => inv.customer_name).filter(Boolean)));

  const filteredInvoices = invoices.filter((inv) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      inv.invoice_number?.toLowerCase().includes(searchLower) ||
      inv.customer_name?.toLowerCase().includes(searchLower) ||
      (inv.total !== undefined && inv.total !== null && inv.total.toString().includes(search));
    const matchesFrom = !dateFrom || inv.invoice_date >= dateFrom;
    const matchesTo = !dateTo || inv.invoice_date <= dateTo;
    const matchesCustomer = !customerFilter || inv.customer_name === customerFilter;
    return matchesSearch && matchesFrom && matchesTo && matchesCustomer;
  });

  async function handleEdit(inv) {
    try {
      const fullInvoice = await getInvoice(inv.id);
      onEdit(fullInvoice);
      navigate(`/invoices/${inv.id}/edit`);
    } catch {
      toast.error('Could not load invoice');
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 20 }}>
      <div className="vibrant-header">
        <div className="vibrant-header-title">All Invoices</div>
        <div className="vibrant-header-subtitle">Your complete billing history</div>
      </div>

      <div
        style={{
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
        }}
      >
        <input
          type="text"
          placeholder="🔍 Search invoices..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            ...filterBase,
            padding: '12px 22px',
            borderRadius: '18px',
            fontSize: '1.15rem',
            width: '100%',
            maxWidth: 340,
            background: 'linear-gradient(90deg, #f8fbff 60%, #eaf3fa 100%)',
            boxShadow: '0 4px 16px rgba(33,150,243,0.10)',
            flex: '0 0 300px',
          }}
        />
        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          style={{ ...filterBase, padding: '12px 16px', fontSize: '1.08rem', width: '100%', maxWidth: 180, flex: '0 0 140px' }}
        >
          <option value="">All Customers</option>
          {uniqueCustomers.map((cust) => (
            <option key={cust} value={cust}>{cust}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title="From date"
          style={{ ...filterBase, padding: '12px 16px', fontSize: '1.08rem', width: '100%', maxWidth: 140, flex: '0 0 120px' }}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title="To date"
          style={{ ...filterBase, padding: '12px 16px', fontSize: '1.08rem', width: '100%', maxWidth: 140, flex: '0 0 120px' }}
        />
      </div>

      {loading ? (
        <>
          <div className="skeleton" style={{ width: 200, height: 32, marginBottom: 16 }} />
          <div className="skeleton" style={{ width: '100%', height: 40, marginBottom: 8 }} />
        </>
      ) : filteredInvoices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#888', fontSize: '1.1rem' }}>
          No invoices to display
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Total</th>
              <th>PDF</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.invoice_number}</td>
                <td>{inv.invoice_date}</td>
                <td>{inv.customer_name}</td>
                <td>
                  <CurrencyFormat value={inv.total} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => openInvoicePdf(inv.id).catch(() => toast.error('Could not open PDF'))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    title="Open PDF"
                  >
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg"
                      alt="PDF"
                      style={{ width: 20, height: 20, verticalAlign: 'middle' }}
                    />
                  </button>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => handleEdit(inv)}
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
      )}
    </div>
  );
}