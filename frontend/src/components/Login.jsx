import React, { useState, useEffect } from 'react';
import { Box, Button, TextField, Typography, Link, Paper, Alert, CircularProgress, InputAdornment, IconButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';

const Login = ({ sendDataToParent }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('https://phoenix-cy09.onrender.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (sendDataToParent) sendDataToParent(data.user);
        navigate('/dashboard');
      } else {
        if (sendDataToParent) sendDataToParent(false);
        setError(data.error || 'Login failed.');
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    alert('Forgot password functionality coming soon!');
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      p: { xs: 2, md: 4 },
      bgcolor: 'background.default',
      background: 'linear-gradient(135deg, #F5F7FA 0%, #E4EBF5 100%)'
    }}>
      <Paper elevation={3} sx={{ 
        maxWidth: 440, 
        width: '100%', 
        p: { xs: 4, md: 5 }, 
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
      }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ 
            mx: 'auto', 
            mb: 3, 
            width: 72, 
            height: 72, 
            borderRadius: 3, 
            background: 'linear-gradient(135deg, #4F8CFF 0%, #6FCF97 100%)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(79, 140, 255, 0.3)'
          }}>
            <ReceiptLongOutlinedIcon sx={{ color: 'white', fontSize: 36 }} />
          </Box>
          <Typography variant="h4" fontWeight={700} sx={{ color: 'text.primary', mb: 1 }}>
            Welcome Back
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Sign in to Vistar Enterprises
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            label="Email Address"
            type="email"
            fullWidth
            margin="normal"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            autoFocus
            required
            autoComplete="email"
            disabled={loading}
            InputProps={{
              startAdornment: <InputAdornment position="start"><EmailOutlinedIcon sx={{ color: 'text.secondary' }} /></InputAdornment>,
            }}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            required
            autoComplete="current-password"
            disabled={loading}
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockOutlinedIcon sx={{ color: 'text.secondary' }} /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    sx={{ color: 'text.secondary' }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    disabled={loading}
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 1 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <input type="checkbox" id="remember" sx={{ width: 16, height: 16, mr: 1, accentColor: 'primary.main' }} disabled={loading} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Remember me</Typography>
            </Box>
            <Typography 
              variant="body2" 
              onClick={handleForgotPassword} 
              sx={{ color: 'primary.main', fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Forgot password?
            </Typography>
          </Box>

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            sx={{ py: 1.5, mb: 3, borderRadius: 2 }}
          >
            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <CircularProgress size={24} color="inherit" sx={{ width: 24, height: 24 }} />
                <span>Signing in...</span>
              </Box>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

export default Login;