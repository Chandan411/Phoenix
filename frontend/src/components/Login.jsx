import React, { useState, useEffect } from 'react';
import { Box, Button, TextField, Typography, Link, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

const Login = ({ onLogin, sendDataToParent }) => {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if redirected back from SSO with token
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('sso_token');
    if (ssoToken) {
      // TODO: Validate token with backend and log in user
      if (onLogin) onLogin('sso', ssoToken);
      navigate('/dashboard');
    }
  }, [onLogin, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (onLogin) onLogin(data.user);
        sendDataToParent(true);
        navigate('/dashboard');
      } else {
        sendDataToParent(false);
        setError(data.error || 'Login failed.');
      }
    } catch (err) {
      setError('Network error.');
    }
  };

  const handleForgotPassword = () => {
    // TODO: Implement forgot password logic
    alert('Forgot password functionality coming soon!');
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: theme.palette.background.default, display: 'flex', alignItems: 'center', justifyContent: 'start' }}>
      <Paper elevation={4} sx={{ p: 4, maxWidth: 400, width: '100%', borderRadius: 3 }}>
        <Typography variant="h5" color={theme.palette.primary.main} fontWeight={700} mb={2} align="center">
          Login
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
            required
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <Typography color="error" variant="body2" mt={1}>{error}</Typography>}
          <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 2, mb: 1 }}>
            Login
          </Button>
          <Box sx={{ textAlign: 'right' }}>
            <Link component="button" variant="body2" onClick={handleForgotPassword} color="secondary">
              Forgot password?
            </Link>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default Login;
