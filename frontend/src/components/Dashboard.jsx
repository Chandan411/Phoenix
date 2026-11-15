import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Box, Button, Grid, IconButton, Paper, Skeleton, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import { listInvoices, openInvoicePdf } from '../api';
import CurrencyFormat from '../utils/CurrencyFormat.jsx';
import InvoiceCard from './InvoiceCard.jsx';

function StatCard({ title, value, icon, color, loading, to }) {
  const linkProps = to ? { component: RouterLink, to } : {};
  return (
    <Paper
      variant="outlined"
      {...linkProps}
      sx={{
        p: { xs: 1.75, sm: 2.5 }, display: 'flex', alignItems: 'center', gap: 2,
        textDecoration: 'none', color: 'inherit', height: '100%',
        transition: 'box-shadow .2s', '&:hover': to ? { boxShadow: 3 } : undefined,
      }}
    >
      <Box
        sx={{
          width: 48, height: 48, borderRadius: 2, placeItems: 'center', flexShrink: 0,
          display: { xs: 'none', sm: 'grid' }, bgcolor: `${color}1A`, color,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary" noWrap>{title}</Typography>
        {loading ? (
          <Skeleton width={80} height={30} />
        ) : (
          <Typography noWrap sx={{ typography: { xs: 'subtitle1', sm: 'h5' }, fontWeight: 700 }}>
            {value}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

function MonthlyChart({ invoices, loading }) {
  const data = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, label: d.toLocaleString('en-IN', { month: 'short' }), total: 0 });
    }
    invoices.forEach((inv) => {
      const m = months.find((x) => x.key === (inv.invoice_date || '').slice(0, 7));
      if (m) m.total += Number(inv.total) || 0;
    });
    return months;
  }, [invoices]);

  const max = Math.max(...data.map((m) => m.total), 1);
  const short = (n) =>
    n >= 100000 ? `${(n / 100000).toFixed(1)}L` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, height: '100%' }}>
      <Typography variant="h6" gutterBottom>Revenue, last 6 months</Typography>
      {loading ? (
        <Skeleton variant="rounded" height={180} />
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 0.75, sm: 2 }, height: 200, pt: 2 }}>
          {data.map((m) => (
            <Box
              key={m.key}
              sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, visibility: m.total ? 'visible' : 'hidden' }}>
                {short(m.total)}
              </Typography>
              <Tooltip title={<CurrencyFormat value={m.total} />} arrow>
                <Box
                  sx={{
                    width: '100%', maxWidth: 48, borderRadius: '8px 8px 0 0',
                    height: `${Math.max((m.total / max) * 140, m.total ? 6 : 3)}px`,
                    bgcolor: m.total ? 'primary.main' : 'divider', transition: 'height .3s',
                  }}
                />
              </Tooltip>
              <Typography variant="caption" sx={{ mt: 0.75 }}>{m.label}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}

export default function Dashboard({ refresh }) {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        setInvoices(await listInvoices({}));
      } catch {
        toast.error('Could not load invoices');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [refresh]);

  const openPdf = (inv) => openInvoicePdf(inv.id).catch(() => toast.error('Could not open PDF'));

  const totalInvoices = invoices.length;
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const thisMonthKey = new Date().toISOString().slice(0, 7);
  const thisMonthRevenue = invoices
    .filter((i) => (i.invoice_date || '').startsWith(thisMonthKey))
    .reduce((s, i) => s + (i.total || 0), 0);
  const average = totalInvoices ? totalRevenue / totalInvoices : 0;
  const recentInvoices = invoices.slice(0, 5);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4">Dashboard</Typography>
          <Typography color="text.secondary">Overview of your billing</Typography>
        </Box>
        <Button
          component={RouterLink} to="/invoices/new" variant="contained" size="large"
          sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
        >
          + New Invoice
        </Button>
      </Box>

      <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, lg: 3 }}>
          <StatCard title="Total Invoices" value={totalInvoices} icon={<ReceiptLongOutlinedIcon />} color="#2563eb" loading={loading} to="/invoices" />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <StatCard title="Total Revenue" value={<CurrencyFormat value={totalRevenue} />} icon={<CurrencyRupeeIcon />} color="#16a34a" loading={loading} />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <StatCard title="This Month" value={<CurrencyFormat value={thisMonthRevenue} />} icon={<CalendarMonthOutlinedIcon />} color="#0d9488" loading={loading} />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <StatCard title="Average Invoice" value={<CurrencyFormat value={average} />} icon={<TrendingUpIcon />} color="#d97706" loading={loading} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <MonthlyChart invoices={invoices} loading={loading} />
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <Paper variant="outlined" sx={{ height: '100%' }}>
            <Box sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h6">Recent Invoices</Typography>
                <Typography variant="body2" color="text.secondary">Last 5 created bills</Typography>
              </Box>
              <Button component={RouterLink} to="/invoices" size="small">View all</Button>
            </Box>

            {loading ? (
              <Box sx={{ p: 2.5, pt: 0 }}>
                {[0, 1, 2].map((i) => <Skeleton key={i} height={44} />)}
              </Box>
            ) : recentInvoices.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <ReceiptLongOutlinedIcon sx={{ fontSize: 40, opacity: 0.4 }} />
                <Typography>No invoices yet</Typography>
              </Box>
            ) : isPhone ? (
              <Stack spacing={1.5} sx={{ p: 2, pt: 0 }}>
                {recentInvoices.map((inv) => (
                  <InvoiceCard key={inv.id} inv={inv} onPdf={openPdf} />
                ))}
              </Stack>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Invoice No</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="center">PDF</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentInvoices.map((inv) => (
                      <TableRow key={inv.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{inv.invoice_number}</TableCell>
                        <TableCell>{inv.invoice_date}</TableCell>
                        <TableCell>{inv.customer_name}</TableCell>
                        <TableCell align="right"><CurrencyFormat value={inv.total} /></TableCell>
                        <TableCell align="center">
                          <Tooltip title="Open PDF">
                            <IconButton size="small" color="error" onClick={() => openPdf(inv)}>
                              <PictureAsPdfOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}