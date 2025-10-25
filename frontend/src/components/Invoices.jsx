import React, { useState, useEffect } from 'react';
import { listInvoices, invoicePdfUrl } from '../api';
import CurrencyFormat from '../utils/CurrencyFormat';
import {
  Box, Paper, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, TextField, Stack
} from '@mui/material';

export default function Invoices({ refresh }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchInvoices();
  }, [refresh]);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const data = await listInvoices({});
      setInvoices(data);
    } finally {
      setLoading(false);
    }
  }

  // Filter invoices by invoice number, customer name, or total
  const filteredInvoices = invoices.filter(inv => {
    const searchLower = search.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(searchLower) ||
      inv.customer_name?.toLowerCase().includes(searchLower) ||
      (inv.total !== undefined && inv.total !== null && inv.total.toString().includes(search))
    );
  });

  return (
    <Box maxWidth={980} mx="auto" p={3}>
      <Typography variant="h4" fontWeight={700} mb={3}>All Invoices</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
        <TextField
          label="Search by Invoice No, Customer, or Total"
          value={search}
          onChange={e => setSearch(e.target.value)}
          variant="outlined"
          size="small"
          fullWidth
        />
      </Stack>
      {loading ? (
        <Typography>Loading...</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Invoice No</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>PDF</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredInvoices.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.id}</TableCell>
                  <TableCell>{inv.invoice_number}</TableCell>
                  <TableCell>{inv.invoice_date}</TableCell>
                  <TableCell>{inv.customer_name}</TableCell>
                  <TableCell>
                    <CurrencyFormat value={inv.total} />
                  </TableCell>
                  <TableCell>
                    <Button
                      href={invoicePdfUrl(inv.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      variant="outlined"
                    >
                      View PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}