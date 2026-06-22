/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { auth, googleProvider, isConfigured } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!(isConfigured && auth));

  // Monitor Firebase Auth state if configured
  useEffect(() => {
    if (!isConfigured || !auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Google sign in helper
  const loginWithGoogle = async () => {
    setLoading(true);
    if (isConfigured && auth && googleProvider) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
      } catch (error) {
        console.error("Firebase Login Error:", error);
        setLoading(false);
        throw error;
      }
    } else {
      // Simulate Google Sign-In with a delay
      return new Promise((resolve) => {
        setTimeout(() => {
          const mockUser = {
            uid: 'google-mock-101',
            displayName: 'Google Designer (Simulated)',
            email: 'designer@google.com',
            photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'
          };
          setUser(mockUser);
          setLoading(false);
          resolve(mockUser);
        }, 800);
      });
    }
  };

  // Sign out helper
  const logout = async () => {
    setLoading(true);
    if (isConfigured && auth) {
      try {
        await firebaseSignOut(auth);
      } catch (error) {
        console.error("Firebase Signout Error:", error);
        setLoading(false);
        throw error;
      }
    } else {
      setUser(null);
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    loginWithGoogle,
    logout,
    isFirebaseReal: isConfigured
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}
