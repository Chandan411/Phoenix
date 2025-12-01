import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, TextField, Button, MenuItem, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Stack, Autocomplete
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { createInvoice, updateInvoice, listInvoices, getPartyByGst, getProductByName } from '../api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import CurrencyFormat from '../utils/CurrencyFormat.jsx';

const cgstSgstOptions = [2.5, 9, 14];
const igstOptions = [5, 18, 28];

const emptyItem = () => ({
  product_name: '',
  hsn_sac: '',
  quantity: 1,
  unit_price: 0,
  cgst_rate: 0,
  sgst_rate: 0,
  igst_rate: 0
});

export default function InvoiceForm({ invoice, onDone }) {
  const [items, setItems] = useState([emptyItem()]);
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGst, setCustomerGst] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [gstOptions, setGstOptions] = useState([]);
  const [gstType, setGstType] = useState('IGST');
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchGsts() {
      const allInvoices = await listInvoices({});
      const uniqueGsts = Array.from(
        new Set(allInvoices.map(inv => (inv.customer_gst || '').trim()).filter(Boolean))
      );
      setGstOptions(uniqueGsts);
    }
    fetchGsts();
  }, []);

  useEffect(() => {
    if (invoice) {
      setInvoiceDate(invoice.invoice_date || new Date().toISOString().slice(0, 10));
      setCustomerName(invoice.customer_name || '');
      setCustomerAddress(invoice.customer_address || '');
      setCustomerGst(invoice.customer_gst || '');
      const isCgstSgst = (invoice.customer_gst || '').startsWith('27');
      setGstType(isCgstSgst ? 'CGST_SGST' : 'IGST');
      // Fetch HSN/SAC for each item if missing or empty
      const fetchHSN = async () => {
        if (invoice.items && invoice.items.length > 0) {
          const updatedItems = await Promise.all(invoice.items.map(async it => {
            let hsn_sac = it.hsn_sac;
            if (!hsn_sac && it.product_name) {
              try {
                const product = await getProductByName(it.product_name);
                if (product && product.hsn_sac) {
                  hsn_sac = product.hsn_sac;
                }
              } catch(e){
                console.error('Error fetching product for HSN/SAC:', e);
              }
            }
            if (isCgstSgst) {
              return { ...it, hsn_sac, cgst_rate: Number(it.cgst_rate) || 0, sgst_rate: Number(it.sgst_rate) || 0, igst_rate: 0 };
            } else {
              return { ...it, hsn_sac, igst_rate: Number(it.igst_rate) || 0, cgst_rate: 0, sgst_rate: 0 };
            }
          }));
          setItems(updatedItems);
        } else {
          setItems([emptyItem()]);
        }
      };
      fetchHSN();
    } else {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setInvoiceDate(`${yyyy}-${mm}-${dd}`);
      setCustomerName('');
      setCustomerAddress('');
      setCustomerGst('');
      setItems([emptyItem()]);
      setGstType('IGST');
    }
  }, [invoice]);

  function updateItem(i, field, value) {
    const copy = [...items];
    if (["cgst_rate", "sgst_rate", "igst_rate", "quantity", "unit_price"].includes(field)) {
      copy[i][field] = Number(value) || 0;
    } else {
      copy[i][field] = value;
    }
    // If product_name is changed, fetch HSN/SAC
    if (field === 'product_name') {
      getProductByName(value).then(product => {
        if (product && product.hsn_sac) {
          copy[i].hsn_sac = product.hsn_sac;
          setItems([...copy]);
        }
      }).catch(() => {
        // If not found, clear hsn_sac
        copy[i].hsn_sac = '';
        setItems([...copy]);
      });
    } else {
      setItems(copy);
    }
    // If CGST is changed, auto-set SGST to the same value
    if (gstType === 'CGST_SGST' && field === 'cgst_rate') {
      copy[i]['sgst_rate'] = Number(value) || 0;
      setItems(copy);
    }
  }
  function addRow() { setItems([...items, emptyItem()]); }
  function removeRow(i) { setItems(items.filter((_, idx) => idx !== i)); }

  function totals() {
    let subtotal = 0, totalGst = 0;
    items.forEach(it => {
      const line = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
      let gstRate = 0;
      if (gstType === 'CGST_SGST') {
        gstRate = (Number(it.cgst_rate) || 0) + (Number(it.sgst_rate) || 0);
      } else {
        gstRate = Number(it.igst_rate) || 0;
      }
      subtotal += line;
      totalGst += line * (gstRate / 100);
    });
    const total = subtotal + totalGst;
    const roundedTotal = Math.round(total);
    const roundOff = +(roundedTotal - total).toFixed(2);
    return { subtotal, totalGst, total, roundedTotal, roundOff };
  }

  const validateFields = () => {
    const errors = {};
    const gstRegex = /^[A-Z0-9]{15}$/;

    if (!String(customerName || '').trim()) errors.customerName = "Customer name is required";
    if (!customerGst) {
      errors.customerGst = "Customer GST is required";
    } else if (!gstRegex.test(String(customerGst || '').trim())) {
      errors.customerGst = "GST must be 15 uppercase alphanumeric characters";
    }
    items.forEach((item, idx) => {
      if (!String(item.product_name || '').trim()) errors[`item_product_name_${idx}`] = "Product name required";
      if (!String(item.hsn_sac || '').trim()) errors[`item_hsn_sac_${idx}`] = "HSN/SAC code is required";
      if (!item.quantity || item.quantity <= 0) errors[`item_quantity_${idx}`] = "Quantity must be > 0";
      if (!item.unit_price || item.unit_price < 0) errors[`item_unit_price_${idx}`] = "Unit price required";
      if (gstType === 'CGST_SGST') {
        if (item.cgst_rate === undefined || item.cgst_rate === null || item.cgst_rate === '' || Number(item.cgst_rate) === 0) {
          errors[`item_cgst_rate_${idx}`] = "CGST rate is required";
        }
        if (item.sgst_rate === undefined || item.sgst_rate === null || item.sgst_rate === '' || Number(item.sgst_rate) === 0) {
          errors[`item_sgst_rate_${idx}`] = "SGST rate is required";
        }
      } else {
        if (item.igst_rate === undefined || item.igst_rate === null || item.igst_rate === '' || Number(item.igst_rate) === 0) {
          errors[`item_igst_rate_${idx}`] = "IGST rate is required";
        }
      }
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleGstChange = async (val) => {
    const v = String(val || '').toUpperCase();
    setCustomerGst(v);
    setFieldErrors(errors => ({ ...errors, customerGst: undefined }));
    setGstType(v.startsWith('27') ? 'CGST_SGST' : 'IGST');
    // Auto-populate party details if GST is valid
    if (/^[A-Z0-9]{15}$/.test(v)) {
      try {
        const party = await getPartyByGst(v);
        if (party) {
          setCustomerName(party.name || '');
          setCustomerAddress(party.address || '');
        }
      } catch {
        // Party not found, do nothing
        setCustomerName('');
        setCustomerAddress('');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateFields()) return;
    setLoading(true);
    try {
      const payload = {
        invoice_date: invoiceDate,
        customer_name: customerName,
        customer_address: customerAddress,
        customer_gst: customerGst,
        items: items.map(it => {
          if (gstType === 'CGST_SGST') {
            return {
              ...it,
              cgst_rate: Number(it.cgst_rate) || 0,
              sgst_rate: Number(it.sgst_rate) || 0,
              igst_rate: 0
            };
          } else {
            return {
              ...it,
              igst_rate: Number(it.igst_rate) || 0,
              cgst_rate: 0,
              sgst_rate: 0
            };
          }
        })
      };
      if (invoice && invoice.id) {
        await updateInvoice(invoice.id, payload);
        toast.success('Invoice updated successfully!');
      } else {
        await createInvoice(payload);
        toast.success('Invoice created successfully!');
      }
      // Open generated PDF in new tab
      try {
        //window.open(invoicePdfUrl(result.id), '_blank');
      } catch {
        // ignore in non-browser environments
      }
      if (onDone) onDone();
      navigate('/dashboard'); // <-- Fix: redirect to dashboard after creation
    } catch (err) {
      toast.error('Failed to create/update invoice');
      console.error('Create invoice error:', err);
    } finally {
      setLoading(false);
    }
  };

  const t = totals();
  const showBackendTotals = invoice && typeof invoice.rounded_total !== 'undefined' && typeof invoice.round_off !== 'undefined';

  return (
    <Box maxWidth={1800} mx="auto" mt={4}>  {/* Increased maxWidth for wider form */}
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" color="primary" gutterBottom align="center">
          {invoice ? 'Edit Invoice' : 'Create Invoice'}
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate autoComplete="off">
          <Stack spacing={3}>
            <TextField
              label="Invoice Date"
              type="date"
              value={invoiceDate}
              onChange={e => setInvoiceDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ maxWidth: 220 }}
            />
            <Paper variant="outlined" sx={{ p: 2, background: "#f5faff" }}>
              <Typography variant="subtitle1" color="primary" fontWeight={600} mb={2}>
                Party Details
              </Typography>
              <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }} alignItems="flex-start">
                <Autocomplete
                  freeSolo
                  clearOnBlur={false}
                  options={gstOptions}
                  value={customerGst}
                  onInputChange={(_, val) => handleGstChange((val || '').slice(0, 15))}
                  renderInput={params => (
                    <TextField
                      {...params}
                      label="GST (Type or Search)"
                      variant="outlined"
                      error={!!fieldErrors.customerGst}
                      helperText={fieldErrors.customerGst}
                      inputProps={{
                        ...params.inputProps,
                        maxLength: 15,
                        style: { textTransform: 'uppercase' }
                      }}
                    />
                  )}
                  sx={{ minWidth: 250 }}
                />
                <TextField
                  label="Customer Name"
                  value={customerName}
                  onChange={e => {
                    setCustomerName(e.target.value.toUpperCase());
                    setFieldErrors(errors => ({ ...errors, customerName: undefined }));
                  }}
                  error={!!fieldErrors.customerName}
                  helperText={fieldErrors.customerName}
                  variant="outlined"
                  sx={{ minWidth: 250 }}
                />
                <TextField
                  label="Address"
                  value={customerAddress}
                  onChange={e => setCustomerAddress(e.target.value)}
                  multiline
                  minRows={3}
                  variant="outlined"
                  sx={{ minWidth: 250 }}
                />
              </Stack>
            </Paper>
            <Box>
              <Typography variant="h6" color="primary" mb={1}>Items</Typography>
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <TableContainer component={Paper} variant="outlined" sx={{ minWidth: 900, borderRadius: 2, boxShadow: 0, padding: '0%' }}>
                  <Table size="small" sx={{ tableLayout: 'fixed', minWidth: 900 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 40 }}>Sr No.</TableCell>
                        <TableCell sx={{ width: 220 }}>Product</TableCell>
                        <TableCell sx={{ width: 120 }}>HSN/SAC</TableCell>
                        <TableCell sx={{ width: 80 }}>Qty</TableCell>
                        <TableCell sx={{ width: 120 }}>Unit Price</TableCell>
                        {gstType === 'CGST_SGST' ? (
                          <>
                            <TableCell sx={{ width: 100 }}>CGST %</TableCell>
                            <TableCell sx={{ width: 100 }}>SGST %</TableCell>
                          </>
                        ) : (
                          <TableCell sx={{ width: 100 }}>IGST %</TableCell>
                        )}
                        <TableCell sx={{ width: 120 }}>Line Total</TableCell>
                        <TableCell sx={{ width: 60 }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {items.map((it, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell sx={{ verticalAlign: 'middle', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 220 }}>
                            <TextField
                              value={it.product_name}
                              onChange={e => {
                                updateItem(idx, 'product_name', e.target.value.toUpperCase());
                                setFieldErrors(errors => ({ ...errors, [`item_product_name_${idx}`]: undefined }));
                              }}
                              error={!!fieldErrors[`item_product_name_${idx}`]}
                              helperText={fieldErrors[`item_product_name_${idx}`]}
                              size="small"
                              fullWidth
                              variant="outlined"
                              placeholder="Product Name"              
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              value={it.hsn_sac || ''}
                              onChange={e => {
                                updateItem(idx, 'hsn_sac', e.target.value);
                                setFieldErrors(errors => ({ ...errors, [`item_hsn_sac_${idx}`]: undefined }));
                              }}
                              error={!!fieldErrors[`item_hsn_sac_${idx}`]}
                              helperText={fieldErrors[`item_hsn_sac_${idx}`]}
                              size="small"
                              fullWidth
                              variant="outlined"
                              placeholder="HSN/SAC"
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={it.quantity}
                              onChange={e => {
                                updateItem(idx, 'quantity', e.target.value);
                                setFieldErrors(errors => ({ ...errors, [`item_quantity_${idx}`]: undefined }));
                              }}
                              error={!!fieldErrors[`item_quantity_${idx}`]}
                              helperText={fieldErrors[`item_quantity_${idx}`]}
                              size="small"
                              fullWidth
                              variant="outlined"
                              placeholder="Qty"
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={it.unit_price}
                              onChange={e => {
                                updateItem(idx, 'unit_price', e.target.value);
                                setFieldErrors(errors => ({ ...errors, [`item_unit_price_${idx}`]: undefined }));
                              }}
                              error={!!fieldErrors[`item_unit_price_${idx}`]}
                              helperText={fieldErrors[`item_unit_price_${idx}`]}
                              size="small"
                              fullWidth
                              variant="outlined"
                              placeholder="Unit Price"
                            />
                          </TableCell>
                          {gstType === 'CGST_SGST' ? (
                            <>
                              <TableCell>
                                <TextField
                                  select
                                  value={it.cgst_rate || ''}
                                  onChange={e => updateItem(idx, 'cgst_rate', e.target.value)}
                                  size="small"
                                  fullWidth
                                  variant="outlined"
                                  error={!!fieldErrors[`item_cgst_rate_${idx}`]}
                                  helperText={fieldErrors[`item_cgst_rate_${idx}`] || ''}
                                >
                                  <MenuItem value="">Select</MenuItem>
                                  {cgstSgstOptions.map(opt => (
                                    <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                                  ))}
                                </TextField>
                              </TableCell>
                              <TableCell>
                                <TextField
                                  select
                                  value={it.sgst_rate || ''}
                                  onChange={e => updateItem(idx, 'sgst_rate', e.target.value)}
                                  size="small"
                                  fullWidth
                                  variant="outlined"
                                  error={!!fieldErrors[`item_sgst_rate_${idx}`]}
                                  helperText={fieldErrors[`item_sgst_rate_${idx}`] || ''}
                                >
                                  <MenuItem value="">Select</MenuItem>
                                  {cgstSgstOptions.map(opt => (
                                    <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                                  ))}
                                </TextField>
                              </TableCell>
                            </>
                          ) : (
                            <TableCell>
                              <TextField
                                select
                                value={it.igst_rate || ''}
                                onChange={e => updateItem(idx, 'igst_rate', e.target.value)}
                                size="small"
                                fullWidth
                                variant="outlined"
                                error={!!fieldErrors[`item_igst_rate_${idx}`]}
                                helperText={fieldErrors[`item_igst_rate_${idx}`] || ''}
                              >
                                <MenuItem value="">Select</MenuItem>
                                {igstOptions.map(opt => (
                                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                                ))}
                              </TextField>
                            </TableCell>
                          )}
                          <TableCell>
                            {(() => {
                              const line = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
                              let gstRate = 0;
                              if (gstType === 'CGST_SGST') {
                                gstRate = (Number(it.cgst_rate) || 0) + (Number(it.sgst_rate) || 0);
                              } else {
                                gstRate = Number(it.igst_rate) || 0;
                              }
                              return (line * (1 + gstRate / 100)).toFixed(2);
                            })()}
                          </TableCell>
                          <TableCell>
                            <IconButton
                              onClick={() => removeRow(idx)}
                              disabled={items.length === 1}
                              color="error"
                            >
                              <RemoveIcon />
                            </IconButton>
                            {idx === items.length - 1 && (
                              <IconButton onClick={addRow} color="primary">
                                <AddIcon />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>
            </Box>
            <Box mt={2} mb={2}>
              <Typography>Subtotal: <CurrencyFormat value={showBackendTotals ? Number(invoice.subtotal) : t.subtotal} /></Typography>
              <Typography>Total GST: <CurrencyFormat value={showBackendTotals ? Number(invoice.total_gst) : t.totalGst} /></Typography>
              <Typography>
                Round Off: {showBackendTotals
                  ? (invoice.round_off >= 0 ? '+' : '') + Number(invoice.round_off).toFixed(2)
                  : (t.roundOff >= 0 ? '+' : '') + t.roundOff.toFixed(2)}
              </Typography>
              <Typography fontWeight={700}>
                Grand Total: <CurrencyFormat value={showBackendTotals ? Number(invoice.rounded_total) : t.roundedTotal} />
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              <Button type="submit" variant="contained" color="primary" disabled={loading}>
                {loading ? (invoice ? 'Updating...' : 'Generating...') : (invoice ? 'Update Invoice' : 'Create & Generate PDF')}
              </Button>
              {onDone && (
                <Button type="button" variant="outlined" onClick={onDone}>
                  Cancel
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}