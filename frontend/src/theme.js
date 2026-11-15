// frontend/src/theme.js
// File cleared to undo MUI theme integration.import { createTheme, responsiveFontSizes } from '@mui/material/styles';

let theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2563eb', dark: '#1d4ed8', light: '#60a5fa' },
    secondary: { main: '#0d9488' },
    success: { main: '#16a34a' },
    background: { default: '#f4f6fb', paper: '#ffffff' },
    text: { primary: '#0f172a', secondary: '#64748b' },
    divider: '#e2e8f0',
    action: { hover: '#f1f5f9' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, minHeight: 40 },
        sizeLarge: { minHeight: 46 },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { '@media (max-width:600px)': { padding: 10 } } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 10, backgroundColor: '#fff' },
        input: { '@media (max-width:600px)': { fontSize: 16 } },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 600, color: '#475569', backgroundColor: '#f8fafc', whiteSpace: 'nowrap' },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: { root: { minWidth: 0, paddingTop: 8 } },
    },
  },
});

theme = responsiveFontSizes(theme);
export default theme;