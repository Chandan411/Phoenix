import { Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from './AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}><CircularProgress /></Box>;
  }
  return user ? children : <Navigate to="/" replace />;
}