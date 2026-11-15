import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true until Firebase restores the session

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); }), []);

  const value = {
    user,
    loading,
    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    logout: () => signOut(auth),
    resetPassword: (email) => sendPasswordResetEmail(auth, email),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}