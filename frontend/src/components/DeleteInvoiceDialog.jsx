import React, { useState } from 'react';
import {
  Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, IconButton, InputAdornment, TextField,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { toast } from 'react-toastify';
import { useAuth } from '../auth/AuthContext';
import { deleteInvoice } from '../api';

const passwordMessage = (code) =>
  ({
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect password.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
  }[code] || 'Could not verify your password. Please try again.');

export default function DeleteInvoiceDialog({ invoice, onClose, onDeleted }) {
  const { verifyPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => { setPassword(''); setError(''); setShowPassword(false); };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Enter your password to continue.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      await verifyPassword(password);
    } catch (err) {
      setError(passwordMessage(err.code));
      setLoading(false);
      return;
    }

    try {
      await deleteInvoice(invoice.id);
      toast.success(`Invoice ${invoice.invoice_number} deleted`);
      reset();
      onDeleted(invoice);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete the invoice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={Boolean(invoice)} onClose={handleClose} fullWidth maxWidth="xs">
      <form onSubmit={handleDelete}>
        <DialogTitle>Delete invoice?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This permanently deletes <b>{invoice?.invoice_number}</b> ({invoice?.customer_name}) and its PDF.
            The invoice number will not be reused. Enter your password to confirm.
          </DialogContentText>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            autoFocus
            fullWidth
            autoComplete="current-password"
            disabled={loading}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      disabled={loading}
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} color="inherit" disabled={loading}>Cancel</Button>
          <Button type="submit" color="error" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={22} color="inherit" /> : 'Delete'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}