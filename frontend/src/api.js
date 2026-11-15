import axios from 'axios';
import { auth } from './firebase';

// Same-origin in production (Hosting rewrites /api/** to the Cloud Function)
const api = axios.create({ baseURL: '/api', timeout: 30000 });

// Attach a fresh Firebase ID token to every request
api.interceptors.request.use(async (config) => {
  const token = await auth.currentUser?.getIdToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const createInvoice = (payload) => api.post('/invoices', payload).then((r) => r.data);
export const updateInvoice = (id, payload) => api.put(`/invoices/${id}`, payload).then((r) => r.data);
export const listInvoices = (params) => api.get('/invoices', { params }).then((r) => r.data);
export const getInvoice = (id) => api.get(`/invoices/${id}`).then((r) => r.data);
export const getPartyByGst = (gst) => api.get(`/invoices/party/${gst}`).then((r) => r.data);
export const getProductByName = (name) =>
  api.get(`/invoices/product/${encodeURIComponent(name)}`).then((r) => r.data);

// PDFs need the auth header, so fetch as a blob and open it
export async function openInvoicePdf(id) {
  const win = window.open('', '_blank'); // open synchronously to avoid popup blockers
  try {
    const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
    win.location.href = URL.createObjectURL(res.data);
  } catch (e) {
    win?.close();
    throw e;
  }
}