import React from 'react';
import { Box, IconButton, Paper, Typography } from '@mui/material';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CurrencyFormat from '../utils/CurrencyFormat.jsx';

export default function InvoiceCard({ inv, onPdf, onEdit, onDelete }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
        <Typography fontWeight={700} noWrap>{inv.invoice_number}</Typography>
        <Typography fontWeight={700} color="primary" sx={{ flexShrink: 0 }}>
          <CurrencyFormat value={inv.total} />
        </Typography>
      </Box>
      <Typography variant="body2" noWrap sx={{ mt: 0.5 }}>{inv.customer_name}</Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{inv.invoice_date}</Typography>
        <Box sx={{ mr: -1 }}>
          <IconButton color="error" aria-label="Open PDF" onClick={() => onPdf(inv)}>
            <PictureAsPdfOutlinedIcon fontSize="small" />
          </IconButton>
          {onEdit && (
            <IconButton color="primary" aria-label="Edit invoice" onClick={() => onEdit(inv)}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          )}
          {onDelete && (
            <IconButton color="error" aria-label="Delete invoice" onClick={() => onDelete(inv)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>
    </Paper>
  );
}