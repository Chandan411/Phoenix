import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation, useParams } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  AppBar, Avatar, BottomNavigation, BottomNavigationAction, Box, Button, CircularProgress,
  Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Paper,
  Toolbar, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import Dashboard from './components/Dashboard';
import InvoiceForm from './components/InvoiceForm';
import InvoiceList from './components/InvoiceList';
import Login from './components/Login';
import { useAuth } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import { getInvoice } from './api';

const DRAWER_W = 290;

const NAV = [
  { label: 'Dashboard', short: 'Home', to: '/dashboard', icon: <DashboardOutlinedIcon />, match: (p) => p === '/dashboard' },
  {
    label: 'Invoices',
    short: 'Invoices',
    to: '/invoices',
    // icon: <ReceiptLongOutlinedIcon />,
    match: (p) => p === '/invoices' || /^\/invoices\/[^/]+\/edit$/.test(p),
  },
  { label: 'Create Invoice', short: 'New', to: '/invoices/new', icon: <AddCircleOutlineIcon />, match: (p) => p === '/invoices/new' },
];

function Brand({ compact }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
      <Box
        component="img"
        src="/vistar.svg"
        alt="Vistar"
        sx={{ width: compact ? 34 : 40, height: compact ? 34 : 40, flexShrink: 0, objectFit: 'contain' }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography fontWeight={800} lineHeight={1.2} noWrap>VISTAR ENTERPRISE</Typography>
        <Typography variant="caption" color="text.secondary">Made with ❤️ by Chandan</Typography>
      </Box>
    </Box>
  );
}

function Shell({ children }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // ---------- Desktop / large tablet: sidebar ----------
  if (isDesktop) {
    return (
      <Box sx={{ display: 'flex', flexGrow: 1 }}>
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_W, flexShrink: 0,
            '& .MuiDrawer-paper': { width: DRAWER_W, boxSizing: 'border-box', borderRight: 1, borderColor: 'divider' },
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ p: 2.5 }}><Brand /></Box>
            <Divider />
            <List sx={{ px: 1.5, py: 2, flexGrow: 1 }}>
              {NAV.map((item) => (
                <ListItemButton
                  key={item.to}
                  component={NavLink}
                  to={item.to}
                  selected={item.match(location.pathname)}
                  sx={{
                    borderRadius: 2, mb: 0.5,
                    '&.Mui-selected': { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } },
                    '&.Mui-selected .MuiListItemIcon-root': { color: '#fff' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600 }} />
                </ListItemButton>
              ))}
            </List>
            <Divider />
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.light', fontSize: 14 }}>
                  {(user?.email || '?')[0].toUpperCase()}
                </Avatar>
                <Typography variant="body2" noWrap title={user?.email} color="text.secondary">
                  {user?.email}
                </Typography>
              </Box>
              <Button fullWidth variant="outlined" color="inherit" startIcon={<LogoutOutlinedIcon />} onClick={handleLogout}>
                Logout
              </Button>
            </Box>
          </Box>
        </Drawer>

        <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: 4 }}>
          <Box sx={{ maxWidth: 1200, mx: 'auto' }}>{children}</Box>
        </Box>
      </Box>
    );
  }

  // ---------- Phone / small tablet: top bar + bottom navigation ----------
  const activeIndex = NAV.findIndex((n) => n.match(location.pathname));

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="sticky" color="inherit" elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider', pt: 'env(safe-area-inset-top)' }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', gap: 1 }}>
          <Brand compact />
          <IconButton onClick={handleLogout} aria-label="Logout" edge="end">
            <LogoutOutlinedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{ flexGrow: 1, minWidth: 0, p: 2, pb: 'calc(84px + env(safe-area-inset-bottom))' }}
      >
        {children}
      </Box>

      <Paper
        elevation={8}
        sx={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100,
          pb: 'env(safe-area-inset-bottom)', borderRadius: 0, borderTop: 1, borderColor: 'divider',
        }}
      >
        <BottomNavigation showLabels value={activeIndex} onChange={(_, v) => navigate(NAV[v].to)}>
          {NAV.map((item) => (
            <BottomNavigationAction key={item.to} label={item.short} icon={item.icon} />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}

// Loads the invoice from the URL when the page is refreshed or opened directly
function EditInvoiceRoute({ invoice, onDone }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(invoice && String(invoice.id) === id ? invoice : null);

  useEffect(() => {
    if (loaded) return;
    getInvoice(id)
      .then(setLoaded)
      .catch(() => {
        toast.error('Invoice not found');
        navigate('/invoices');
      });
  }, [id, loaded, navigate]);

  if (!loaded) {
    return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}><CircularProgress /></Box>;
  }
  return <InvoiceForm key={id} invoice={loaded} onDone={onDone} />;
}

export default function App() {
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [refreshList, setRefreshList] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const refreshAndGoToDashboard = () => {
    setRefreshList((r) => !r);
    navigate('/dashboard');
  };

  const page = (node) => (
    <ProtectedRoute>
      <Shell>{node}</Shell>
    </ProtectedRoute>
  );

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ToastContainer position="top-center" autoClose={3000} />
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/dashboard" element={page(<Dashboard refresh={refreshList} />)} />
          <Route path="/invoices" element={page(<InvoiceList onEdit={setEditingInvoice} refresh={refreshList} />)} />
          <Route path="/invoices/new" element={page(<InvoiceForm invoice={null} onDone={refreshAndGoToDashboard} />)} />
          <Route
            path="/invoices/:id/edit"
            element={page(
              <EditInvoiceRoute
                invoice={editingInvoice}
                onDone={() => {
                  setEditingInvoice(null);
                  refreshAndGoToDashboard();
                }}
              />
            )}
          />
          <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} replace />} />
        </Routes>
      </Box>
    </Box>
  );
}