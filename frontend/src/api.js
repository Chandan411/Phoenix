// simple API wrapper
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';
const api = axios.create({ baseURL: API_BASE, timeout: 20000 });

export const createInvoice = (payload) => api.post('/invoices', payload).then(r => r.data);
export const updateInvoice = (id, payload) => api.put(`/invoices/${id}`, payload).then(r => r.data);
export const listInvoices  = (params) => api.get('/invoices', { params }).then(r => r.data);
export const invoicePdfUrl = (id) => `${API_BASE}/invoices/${id}/pdf`;
export const getInvoice = (id) => api.get(`/invoices/${id}`).then(r => r.data);
export const getPartyByGst = (gst) => api.get(`/invoices/party/${gst}`).then(r => r.data);
export const getProductByName = (product_name) => api.get(`/invoices/product/${product_name}`).then(r => r.data);
