import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, TextField, Button, MenuItem, IconButton, Stack, Autocomplete, Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { createInvoice, updateInvoice, listInvoices, listProducts, getPartyByGst, getProductByName } from '../api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import CurrencyFormat from '../utils/CurrencyFormat.jsx';

const cgstSgstOptions = [2.5, 9, 14];
const igstOptions = [5, 18, 28];
const QUANTITY_UNITS = ['Pieces', 'Packet', 'Kg'];
const NUMERIC_FIELDS = ['cgst_rate', 'sgst_rate', 'igst_rate', 'quantity', 'unit_price'];
const INVOICE_NUMBER_PATTERN = /^INV-\d{4}-(0[1-9]|1[0-2])-\d{4}$/;
const INVOICE_NUMBER_ERROR = 'Invoice number must follow the format INV-YYYY-MM-XXXX';

const emptyItem = () => ({
  product_name: '',
  hsn_sac: '',
  quantity: 1,
  quantity_unit: 'Pieces',
  unit_price: 0,
  cgst_rate: 0,
  sgst_rate: 0,
  igst_rate: 0,
});

const todayStr = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

function Section({ title, children }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h6" sx={{ mb: 2 }}>{title}</Typography>
      {children}
    </Paper>
  );
}

export default function InvoiceForm({ invoice, onDone }) {
  const [items, setItems] = useState([emptyItem()]);
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGst, setCustomerGst] = useState('');
  const [challanNo, setChallanNo] = useState('');
  const [poNo, setPoNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayStr());
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [gstOptions, setGstOptions] = useState([]);
  const [customerOptions, setCustomerOptions] = useState([]);
  const [products, setProducts] = useState({});
  const [gstType, setGstType] = useState('IGST');
  const navigate = useNavigate();

  const clearError = (key) => setFieldErrors((errors) => ({ ...errors, [key]: undefined }));

  useEffect(() => {
    async function fetchGsts() {
      try {
        const allInvoices = await listInvoices({});
        const uniqueGsts = Array.from(
          new Set(allInvoices.map((inv) => (inv.customer_gst || '').trim()).filter(Boolean))
        );
        setGstOptions(uniqueGsts);
        setCustomerOptions(
          Array.from(
            new Set(
              allInvoices
                .map((inv) => (inv.customer_name || '').trim().toUpperCase())
                .filter(Boolean)
            )
          )
        );
      } catch {
        // suggestions are optional
      }
    }
    fetchGsts();
  }, []);

  useEffect(() => {
    let active = true;
    listProducts()
      .then((productList) => {
        if (!active) return;
        setProducts(
          Object.fromEntries(
            productList
              .filter((product) => product.product_name)
              .map((product) => [product.product_name.trim().toUpperCase(), product.hsn_sac])
          )
        );
      })
      .catch(() => {
        // Product suggestions are optional.
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (invoice) {
      setInvoiceDate(invoice.invoice_date || todayStr());
      setInvoiceNumber(invoice.invoice_number || '');
      setCustomerName(invoice.customer_name || '');
      setCustomerAddress(invoice.customer_address || '');
      setCustomerGst(invoice.customer_gst || '');
      setChallanNo(invoice.challan_no || '');
      setPoNo(invoice.po_no || '');
      const isCgstSgst = (invoice.customer_gst || '').startsWith('27');
      setGstType(isCgstSgst ? 'CGST_SGST' : 'IGST');
      // Fetch HSN/SAC for each item if missing or empty
      const fetchHSN = async () => {
        if (invoice.items && invoice.items.length > 0) {
          const updatedItems = await Promise.all(
            invoice.items.map(async (it) => {
              let hsn_sac = it.hsn_sac;
              if (!hsn_sac && it.product_name) {
                try {
                  const product = await getProductByName(it.product_name);
                  if (product && product.hsn_sac) hsn_sac = product.hsn_sac;
                } catch (e) {
                  console.error('Error fetching product for HSN/SAC:', e);
                }
              }
              const quantity_unit = it.quantity_unit || 'Pieces';
              if (isCgstSgst) {
                return { ...it, hsn_sac, quantity_unit, cgst_rate: Number(it.cgst_rate) || 0, sgst_rate: Number(it.sgst_rate) || 0, igst_rate: 0 };
              }
              return { ...it, hsn_sac, quantity_unit, igst_rate: Number(it.igst_rate) || 0, cgst_rate: 0, sgst_rate: 0 };
            })
          );
          setItems(updatedItems);
        } else {
          setItems([emptyItem()]);
        }
      };
      fetchHSN();
    } else {
      setInvoiceDate(todayStr());
      setInvoiceNumber('');
      setCustomerName('');
      setCustomerAddress('');
      setCustomerGst('');
      setItems([emptyItem()]);
      setGstType('IGST');
      setChallanNo('');
      setPoNo('');
    }
  }, [invoice]);

  function patchItem(i, patch) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function updateItem(i, field, value) {
    const patch = {};
    if (NUMERIC_FIELDS.includes(field)) {
      let numVal = Number(value) || 0;
      if (field === 'unit_price') numVal = Math.round(numVal * 100) / 100; // 2 decimals
      patch[field] = numVal;
    } else {
      patch[field] = value;
    }
    // In CGST/SGST mode, SGST follows CGST
    if (gstType === 'CGST_SGST' && field === 'cgst_rate') {
      patch.sgst_rate = Number(value) || 0;
    }

    if (field === 'product_name') {
      const hsn = products[String(value).trim().toUpperCase()];
      if (hsn) patch.hsn_sac = hsn;
    }
    patchItem(i, patch);
  }

  function addRow() { setItems((prev) => [...prev, emptyItem()]); }
  function removeRow(i) { setItems((prev) => prev.filter((_, idx) => idx !== i)); }

  const gstRateOf = (it) =>
    gstType === 'CGST_SGST'
      ? (Number(it.cgst_rate) || 0) + (Number(it.sgst_rate) || 0)
      : Number(it.igst_rate) || 0;

  function totals() {
    let subtotal = 0, totalGst = 0;
    items.forEach((it) => {
      const line = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
      subtotal += line;
      totalGst += line * (gstRateOf(it) / 100);
    });
    const total = subtotal + totalGst;
    const roundedTotal = Math.round(total);
    const roundOff = +(roundedTotal - total).toFixed(2);
    return { subtotal, totalGst, total, roundedTotal, roundOff };
  }

  const validateFields = () => {
    const errors = {};
    const gstRegex = /^[A-Z0-9]{15}$/;

    if (!String(customerName || '').trim()) errors.customerName = 'Customer name is required';
    const enteredInvoiceNumber = String(invoiceNumber || '').trim().toUpperCase();
    const existingInvoiceNumber = String(invoice?.invoice_number || '').trim().toUpperCase();
    if (
      enteredInvoiceNumber &&
      !INVOICE_NUMBER_PATTERN.test(enteredInvoiceNumber) &&
      enteredInvoiceNumber !== existingInvoiceNumber
    ) {
      errors.invoiceNumber = INVOICE_NUMBER_ERROR;
    }
    if (!customerGst) {
      errors.customerGst = 'Customer GST is required';
    } else if (!gstRegex.test(String(customerGst || '').trim())) {
      errors.customerGst = 'GST must be 15 uppercase alphanumeric characters';
    }
    items.forEach((item, idx) => {
      if (!String(item.product_name || '').trim()) errors[`item_product_name_${idx}`] = 'Product name required';
      if (!String(item.hsn_sac || '').trim()) errors[`item_hsn_sac_${idx}`] = 'HSN/SAC code is required';
      if (!item.quantity || item.quantity <= 0) errors[`item_quantity_${idx}`] = 'Quantity must be > 0';
      if (!item.unit_price || item.unit_price < 0) errors[`item_unit_price_${idx}`] = 'Unit price required';
      if (!item.quantity_unit || !QUANTITY_UNITS.includes(item.quantity_unit)) {
        errors[`item_quantity_unit_${idx}`] = 'Valid quantity unit is required';
      }
      if (gstType === 'CGST_SGST') {
        if (!Number(item.cgst_rate)) errors[`item_cgst_rate_${idx}`] = 'CGST rate is required';
        if (!Number(item.sgst_rate)) errors[`item_sgst_rate_${idx}`] = 'SGST rate is required';
      } else if (!Number(item.igst_rate)) {
        errors[`item_igst_rate_${idx}`] = 'IGST rate is required';
      }
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleGstChange = async (val) => {
    const v = String(val || '').toUpperCase();
    setCustomerGst(v);
    clearError('customerGst');
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
        // Party not found
        setCustomerName('');
        setCustomerAddress('');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateFields()) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    setLoading(true);
    try {
      const t = totals();
      const payload = {
        invoice_date: invoiceDate,
        customer_name: customerName,
        customer_address: customerAddress,
        customer_gst: customerGst,
        challan_no: challanNo || undefined,
        po_no: String(poNo || '').trim() || null,
        round_off: t.roundOff,
        subtotal: t.subtotal,
        total_gst: t.totalGst,
        invoice_number: invoiceNumber || undefined,
        items: items.map((it) =>
          gstType === 'CGST_SGST'
            ? { ...it, cgst_rate: Number(it.cgst_rate) || 0, sgst_rate: Number(it.sgst_rate) || 0, igst_rate: 0 }
            : { ...it, igst_rate: Number(it.igst_rate) || 0, cgst_rate: 0, sgst_rate: 0 }
        ),
      };
      if (invoice && invoice.id) {
        await updateInvoice(invoice.id, payload);
        toast.success('Invoice updated successfully!');
      } else {
        await createInvoice(payload);
        toast.success('Invoice created successfully!');
      }
      if (onDone) onDone();
      navigate('/dashboard');
    } catch (err) {
      toast.error('Failed to create/update invoice');
      console.error('Create invoice error:', err);
    } finally {
      setLoading(false);
    }
  };

  const t = totals();
  const showBackendTotals = invoice && typeof invoice.rounded_total !== 'undefined' && typeof invoice.round_off !== 'undefined';
  const roundOffValue = showBackendTotals ? Number(invoice.round_off) : t.roundOff;

  return (
    <Box>
      <Typography variant="h4">{invoice ? 'Edit Invoice' : 'Create Invoice'}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {invoice ? 'Update the details and regenerate the PDF' : 'Fill in the details to generate a GST invoice'}
      </Typography>

      <Box component="form" onSubmit={handleSubmit} noValidate autoComplete="off">
        <Stack spacing={2.5}>
          {/* ---------- Invoice details ---------- */}
          <Section title="Invoice details">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Invoice Date"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Invoice Number (Optional)"
                  value={invoiceNumber}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    setInvoiceNumber(value);
                    const unchangedLegacyNumber =
                      value.trim() === String(invoice?.invoice_number || '').trim().toUpperCase();
                    setFieldErrors((errors) => ({
                      ...errors,
                      invoiceNumber:
                        value.trim() && !INVOICE_NUMBER_PATTERN.test(value.trim()) && !unchangedLegacyNumber
                          ? INVOICE_NUMBER_ERROR
                          : undefined,
                    }));
                  }}
                  error={!!fieldErrors.invoiceNumber}
                  fullWidth
                  placeholder="Auto-generated if left empty"
                  slotProps={{ htmlInput: { maxLength: 30, style: { textTransform: 'uppercase' } } }}
                  helperText={fieldErrors.invoiceNumber || 'Leave empty for auto-generation (INV-YYYY-MM-XXXX)'}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="PO No. (Optional)"
                  value={poNo}
                  onChange={(e) => setPoNo(e.target.value)}
                  fullWidth
                />
              </Grid>
            </Grid>
          </Section>

          {/* ---------- Party details ---------- */}
          <Section title="Party details">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Autocomplete
                  freeSolo
                  clearOnBlur={false}
                  options={gstOptions}
                  value={customerGst}
                  onInputChange={(_, val) => handleGstChange((val || '').slice(0, 15))}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="GST (Type or Search)"
                      variant="outlined"
                      error={!!fieldErrors.customerGst}
                      helperText={fieldErrors.customerGst}
                      inputProps={{
                        ...params.inputProps,
                        maxLength: 15,
                        style: { textTransform: 'uppercase', overflowWrap: 'break-word' },
                      }}
                      fullWidth
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 8 }}>
                <Autocomplete
                  freeSolo
                  options={customerOptions}
                  value={customerName || ''}
                  onChange={(_, value) => {
                    setCustomerName((value || '').toUpperCase());
                    clearError('customerName');
                  }}
                  onInputChange={(_, value) => {
                    setCustomerName((value || '').toUpperCase());
                    clearError('customerName');
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Customer Name"
                      error={!!fieldErrors.customerName}
                      helperText={fieldErrors.customerName}
                      fullWidth
                    />
                  )}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="Address"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Challan No (optional)"
                  value={challanNo}
                  onChange={(e) => setChallanNo(e.target.value)}
                  slotProps={{ htmlInput: { maxLength: 30 } }}
                  helperText="Used in the PDF if provided"
                  fullWidth
                />
              </Grid>
            </Grid>
          </Section>

          {/* ---------- Items ---------- */}
          <Section title="Items">
            <Stack spacing={2}>
              {items.map((it, idx) => {
                const line = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
                const lineTotal = line * (1 + gstRateOf(it) / 100);
                return (
                  <Paper key={idx} variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'background.default' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Typography fontWeight={700}>Item {idx + 1}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Line total{' '}
                          <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
                            <CurrencyFormat value={lineTotal} />
                          </Box>
                        </Typography>
                        <IconButton
                          onClick={() => removeRow(idx)}
                          disabled={items.length === 1}
                          color="error"
                          size="small"
                          aria-label={`Remove item ${idx + 1}`}
                        >
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Box>
                    </Box>

                    <Grid container spacing={1.5}>
                      <Grid size={{ xs: 12, md: 5 }}>
                        <Autocomplete
                          freeSolo
                          options={Object.keys(products)}
                          value={it.product_name || ''}
                          onChange={(_, value) => {
                            updateItem(idx, 'product_name', (value || '').toUpperCase());
                            clearError(`item_product_name_${idx}`);
                          }}
                          onInputChange={(_, value) => {
                            updateItem(idx, 'product_name', (value || '').toUpperCase());
                            clearError(`item_product_name_${idx}`);
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Product"
                              size="small"
                              placeholder="Product Name"
                              error={!!fieldErrors[`item_product_name_${idx}`]}
                              helperText={fieldErrors[`item_product_name_${idx}`]}
                            />
                          )}
                        />
                      </Grid>
                      <Grid size={{ xs: 6, md: 3 }}>
                        <TextField
                          label="HSN/SAC"
                          value={it.hsn_sac || ''}
                          onChange={(e) => {
                            updateItem(idx, 'hsn_sac', e.target.value);
                            clearError(`item_hsn_sac_${idx}`);
                          }}
                          error={!!fieldErrors[`item_hsn_sac_${idx}`]}
                          helperText={fieldErrors[`item_hsn_sac_${idx}`]}
                          size="small"
                          fullWidth
                        />
                      </Grid>
                      <Grid size={{ xs: 6, md: 2 }}>
                        <TextField
                          label="Qty"
                          type="number"
                          value={it.quantity}
                          onChange={(e) => {
                            updateItem(idx, 'quantity', e.target.value);
                            clearError(`item_quantity_${idx}`);
                          }}
                          error={!!fieldErrors[`item_quantity_${idx}`]}
                          helperText={fieldErrors[`item_quantity_${idx}`]}
                          size="small"
                          fullWidth
                          slotProps={{ htmlInput: { step: 'any', inputMode: 'decimal' } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 6, md: 2 }}>
                        <TextField
                          select
                          label="Unit"
                          value={it.quantity_unit || 'Pieces'}
                          onChange={(e) => updateItem(idx, 'quantity_unit', e.target.value)}
                          error={!!fieldErrors[`item_quantity_unit_${idx}`]}
                          size="small"
                          fullWidth
                        >
                          {QUANTITY_UNITS.map((unit) => (
                            <MenuItem key={unit} value={unit}>{unit}</MenuItem>
                          ))}
                        </TextField>
                      </Grid>

                      <Grid size={{ xs: 6, md: 4 }}>
                        <TextField
                          label="Unit Price"
                          type="number"
                          value={it.unit_price}
                          onChange={(e) => {
                            updateItem(idx, 'unit_price', e.target.value);
                            clearError(`item_unit_price_${idx}`);
                          }}
                          onBlur={(e) => {
                            const val = Number(e.target.value) || 0;
                            const formatted = Math.round(val * 100) / 100;
                            if (formatted !== val) updateItem(idx, 'unit_price', formatted);
                          }}
                          error={!!fieldErrors[`item_unit_price_${idx}`]}
                          helperText={fieldErrors[`item_unit_price_${idx}`]}
                          size="small"
                          fullWidth
                          slotProps={{ htmlInput: { step: '0.01', min: '0', inputMode: 'decimal' } }}
                        />
                      </Grid>

                      {gstType === 'CGST_SGST' ? (
                        <>
                          <Grid size={{ xs: 6, md: 4 }}>
                            <TextField
                              select
                              label="CGST %"
                              value={it.cgst_rate || ''}
                              onChange={(e) => {
                                updateItem(idx, 'cgst_rate', e.target.value);
                                clearError(`item_cgst_rate_${idx}`);
                              }}
                              size="small"
                              fullWidth
                              error={!!fieldErrors[`item_cgst_rate_${idx}`]}
                              helperText={fieldErrors[`item_cgst_rate_${idx}`] || ''}
                            >
                              <MenuItem value="">Select</MenuItem>
                              {cgstSgstOptions.map((opt) => (
                                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                              ))}
                            </TextField>
                          </Grid>
                          <Grid size={{ xs: 6, md: 4 }}>
                            <TextField
                              select
                              label="SGST %"
                              value={it.sgst_rate || ''}
                              onChange={(e) => {
                                updateItem(idx, 'sgst_rate', e.target.value);
                                clearError(`item_sgst_rate_${idx}`);
                              }}
                              size="small"
                              fullWidth
                              error={!!fieldErrors[`item_sgst_rate_${idx}`]}
                              helperText={fieldErrors[`item_sgst_rate_${idx}`] || ''}
                            >
                              <MenuItem value="">Select</MenuItem>
                              {cgstSgstOptions.map((opt) => (
                                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                              ))}
                            </TextField>
                          </Grid>
                        </>
                      ) : (
                        <Grid size={{ xs: 6, md: 4 }}>
                          <TextField
                            select
                            label="IGST %"
                            value={it.igst_rate || ''}
                            onChange={(e) => {
                              updateItem(idx, 'igst_rate', e.target.value);
                              clearError(`item_igst_rate_${idx}`);
                            }}
                            size="small"
                            fullWidth
                            error={!!fieldErrors[`item_igst_rate_${idx}`]}
                            helperText={fieldErrors[`item_igst_rate_${idx}`] || ''}
                          >
                            <MenuItem value="">Select</MenuItem>
                            {igstOptions.map((opt) => (
                              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                      )}
                    </Grid>
                  </Paper>
                );
              })}

              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addRow}
                sx={{ borderStyle: 'dashed', py: 1.2 }}
              >
                Add item
              </Button>
            </Stack>
          </Section>

          {/* ---------- Totals ---------- */}
          <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
            <Paper variant="outlined" sx={{ p: 2.5, width: { xs: '100%', sm: 340 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography color="text.secondary">Subtotal</Typography>
                <CurrencyFormat value={showBackendTotals ? Number(invoice.subtotal) : t.subtotal} />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography color="text.secondary">Total GST</Typography>
                <CurrencyFormat value={showBackendTotals ? Number(invoice.total_gst) : t.totalGst} />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography color="text.secondary">Round Off</Typography>
                <span>{(roundOffValue >= 0 ? '+' : '') + roundOffValue.toFixed(2)}</span>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                <Typography fontWeight={700}>Grand Total</Typography>
                <Typography fontWeight={700} color="primary">
                  <CurrencyFormat value={showBackendTotals ? Number(invoice.rounded_total) : t.roundedTotal} />
                </Typography>
              </Box>
            </Paper>
          </Box>

          {/* ---------- Actions ---------- */}
          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1.5} justifyContent="flex-end">
            {onDone && (
              <Button type="button" variant="outlined" color="inherit" size="large" onClick={onDone}>
                Cancel
              </Button>
            )}
            <Button type="submit" variant="contained" size="large" disabled={loading}>
              {loading
                ? invoice ? 'Updating...' : 'Generating...'
                : invoice ? 'Update Invoice' : 'Create & Generate PDF'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}