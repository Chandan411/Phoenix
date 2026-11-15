import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Box, Button, Collapse, Grid, IconButton, InputAdornment, MenuItem, Paper, Skeleton, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip,
  Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { listInvoices, openInvoicePdf, getInvoice } from '../api';
import CurrencyFormat from '../utils/CurrencyFormat.jsx';
import InvoiceCard from './InvoiceCard.jsx';

export default function InvoiceList({ onEdit, refresh }) {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('md'));
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchInvoices() {
      setLoading(true);
      try {
        setInvoices(await listInvoices({}));
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

  const activeFilterCount = [dateFrom, dateTo, customerFilter].filter(Boolean).length;
  const hasFilters = search || activeFilterCount > 0;
  const clearFilters = () => { setSearch(''); setDateFrom(''); setDateTo(''); setCustomerFilter(''); };

  const openPdf = (inv) => openInvoicePdf(inv.id).catch(() => toast.error('Could not open PDF'));

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
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4">All Invoices</Typography>
          <Typography color="text.secondary">Your complete billing history</Typography>
        </Box>
        <Button
          component={RouterLink} to="/invoices/new" variant="contained" size="large"
          sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
        >
          + New Invoice
        </Button>
      </Box>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <TextField
            fullWidth size="small" placeholder="Search invoice no, customer or total"
            value={search} onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start"><SearchOutlinedIcon fontSize="small" /></InputAdornment>
                ),
              },
            }}
            sx={{ maxWidth: { md: 360 } }}
          />
          {isPhone && (
            <Button
              variant={activeFilterCount ? 'contained' : 'outlined'}
              color={activeFilterCount ? 'primary' : 'inherit'}
              onClick={() => setShowFilters((s) => !s)}
              startIcon={<TuneIcon />}
              sx={{ flexShrink: 0 }}
            >
              Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
            </Button>
          )}
          {!isPhone && (
            <Button size="small" disabled={!hasFilters} onClick={clearFilters} sx={{ ml: 'auto' }}>
              Clear
            </Button>
          )}
        </Box>

        <Collapse in={!isPhone || showFilters} unmountOnExit={false}>
          <Grid container spacing={1.5} sx={{ mt: 1.5 }}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                select fullWidth size="small" label="Customer"
                value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
              >
                <MenuItem value="">All customers</MenuItem>
                {uniqueCustomers.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, sm: 3, md: 4 }}>
              <TextField
                type="date" fullWidth size="small" label="From"
                value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3, md: 4 }}>
              <TextField
                type="date" fullWidth size="small" label="To"
                value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            {isPhone && (
              <Grid size={12}>
                <Button fullWidth size="small" disabled={!hasFilters} onClick={clearFilters}>
                  Clear all filters
                </Button>
              </Grid>
            )}
          </Grid>
        </Collapse>
      </Paper>

      {loading ? (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={48} />)}
        </Paper>
      ) : filteredInvoices.length === 0 ? (
        <Paper variant="outlined" sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <ReceiptLongOutlinedIcon sx={{ fontSize: 44, opacity: 0.4 }} />
          <Typography>{invoices.length === 0 ? 'No invoices to display' : 'No invoices match your filters'}</Typography>
        </Paper>
      ) : isPhone ? (
        <Stack spacing={1.5}>
          {filteredInvoices.map((inv) => (
            <InvoiceCard key={inv.id} inv={inv} onPdf={openPdf} onEdit={handleEdit} />
          ))}
          <Typography variant="body2" color="text.secondary" align="center" sx={{ pt: 1 }}>
            Showing {filteredInvoices.length} of {invoices.length} invoices
          </Typography>
        </Stack>
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice No</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="center">PDF</TableCell>
                  <TableCell align="center">Edit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredInvoices.map((inv) => (
                  <TableRow key={inv.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{inv.invoice_number}</TableCell>
                    <TableCell>{inv.invoice_date}</TableCell>
                    <TableCell>{inv.customer_name}</TableCell>
                    <TableCell align="right"><CurrencyFormat value={inv.total} /></TableCell>
                    <TableCell align="center">
                      <Tooltip title="Open PDF">
                        <IconButton color="error" onClick={() => openPdf(inv)}>
                          <PictureAsPdfOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit">
                        <IconButton color="primary" onClick={() => handleEdit(inv)}>
                          <EditOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredInvoices.length} of {invoices.length} invoices
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
}