/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { auth, isConfigured } from '../firebase';

let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Automatically upgrade HTTP to HTTPS in production to avoid mixed content block on mobile
if (
  typeof window !== 'undefined' &&
  window.location.protocol === 'https:' &&
  API_URL.startsWith('http://') &&
  !API_URL.includes('localhost') &&
  !API_URL.includes('127.0.0.1')
) {
  API_URL = API_URL.replace('http://', 'https://');
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const isAdminSession = localStorage.getItem('slidepapers_admin_session') === 'true';
    if (isAdminSession) {
      return {
        uid: 'admin-mock-999',
        displayName: 'Admin (Local Bypass)',
        email: 'admin@slidepapers.com',
        photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80'
      };
    }
    return null;
  });
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('slidepapers_admin_session') === 'true';
  });
  const [initialLoading, setInitialLoading] = useState(!!(isConfigured && auth));
  const [loading, setLoading] = useState(false);

  const syncUserProfile = async (currentUser) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_URL}/api/users/sync-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser.uid,
          displayName: currentUser.displayName,
          email: currentUser.email,
          photoURL: currentUser.photoURL
        })
      });
      if (res.ok) {
        console.log('[AuthContext] Profile synced successfully.');
      }
    } catch (err) {
      console.error('[AuthContext] Failed to sync user profile with backend:', err);
    }
  };

  // Monitor Firebase Auth state if configured
  useEffect(() => {
    if (!isConfigured || !auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const isAdminSession = localStorage.getItem('slidepapers_admin_session') === 'true';
      console.log('[AuthContext] onAuthStateChanged fired. User:', currentUser ? currentUser.email : 'null', 'isAdminSession:', isAdminSession);

      // If mock admin session is active and no real Firebase user is signed in, preserve mock user
      if (isAdminSession && (!currentUser || currentUser.email === 'admin@slidepapers.com')) {
        console.log('[AuthContext] Preserving mock admin session and setting user state');
        setUser({
          uid: 'admin-mock-999',
          displayName: 'Admin (Local Bypass)',
          email: 'admin@slidepapers.com',
          photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80'
        });
        setIsAdmin(true);
        setInitialLoading(false);
        return;
      }

      setUser(currentUser);
      if (currentUser) {
        syncUserProfile(currentUser);
        const isEmailPassword = currentUser.providerData.some(p => p.providerId === 'password');
        const computedAdmin = isEmailPassword || currentUser.email === 'admin@slidepapers.com' || isAdminSession;
        console.log('[AuthContext] User exists. computedAdmin:', computedAdmin);
        setIsAdmin(computedAdmin);
      } else {
        console.log('[AuthContext] User is null. Setting isAdmin = false');
        setIsAdmin(false);
      }
      setInitialLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Google sign in helper
  const loginWithGoogle = async () => {
    setLoading(true);
    if (isConfigured && auth) {
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await signInWithPopup(auth, provider);
        setLoading(false);
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
          syncUserProfile(mockUser);
          setIsAdmin(false);
          setLoading(false);
          resolve(mockUser);
        }, 800);
      });
    }
  };

  // Google Admin sign in helper (sets admin session flag)
  const loginAdminWithGoogle = async () => {
    setLoading(true);
    try {
      localStorage.setItem('slidepapers_admin_session', 'true');
      setIsAdmin(true);
      const googleUser = await loginWithGoogle();
      setLoading(false);
      return googleUser;
    } catch (error) {
      localStorage.removeItem('slidepapers_admin_session');
      setIsAdmin(false);
      setLoading(false);
      throw error;
    }
  };

  // Admin email/password login helper
  const loginWithEmail = async (email, password) => {
    setLoading(true);

    const ALLOWED_ADMIN_EMAILS = [
      'admin',
      'admin@slidepapers.com',
      'infernapeshashank',
      'infernapeshashank@gmail.com',
      'jasondomnic',
      'jasondomnic@gmail.com',
      'jasondomnii',
      'jasondomnii@gmail.com'
    ];

    let emailClean = (email || '').trim().toLowerCase();
    console.error('[AuthContext DIAGNOSTIC] emailClean value:', emailClean, 'length:', emailClean.length);

    // Normalize shorthands
    if (emailClean === 'admin') {
      emailClean = 'admin@slidepapers.com';
    } else if (emailClean === 'infernapeshashank') {
      emailClean = 'infernapeshashank@gmail.com';
    } else if (emailClean === 'jasondomnic') {
      emailClean = 'jasondomnic@gmail.com';
    } else if (emailClean === 'jasondomnii') {
      emailClean = 'jasondomnii@gmail.com';
    }

    // 1. Validate if the email exists in the whitelisted admin list
    if (!ALLOWED_ADMIN_EMAILS.includes(emailClean)) {
      console.log('[AuthContext] Email is not a whitelisted admin:', emailClean);
      setLoading(false);
      throw new Error('This Admin ID/Email is not registered.');
    }

    // 2. Local admin account bypass
    if (emailClean === 'admin@slidepapers.com') {
      if (password === 'admin123') {
        console.log('[AuthContext] Match mock admin login credentials. Bypassing Firebase.');
        localStorage.setItem('slidepapers_admin_session', 'true');
        setIsAdmin(true);
        return new Promise((resolve) => {
          setTimeout(() => {
            const adminUser = {
              uid: 'admin-mock-999',
              displayName: 'Admin (Local Bypass)',
              email: 'admin@slidepapers.com',
              photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80'
            };
            console.log('[AuthContext] Local mock admin logged in successfully. Setting user.');
            setUser(adminUser);
            setLoading(false);
            resolve(adminUser);
          }, 800);
        });
      } else {
        console.log('[AuthContext] Incorrect password for local bypass account.');
        setLoading(false);
        throw new Error('Incorrect password for admin@slidepapers.com.');
      }
    }

    // 3. Real Firebase Authentication
    if (isConfigured && auth) {
      try {
        console.error('[AuthContext DIAGNOSTIC] Calling Firebase signInWithEmailAndPassword for email:', emailClean, 'with password length:', password ? password.length : 0);
        const result = await signInWithEmailAndPassword(auth, emailClean, password);
        console.log('[AuthContext] Firebase signInWithEmailAndPassword success:', result.user.email);
        localStorage.setItem('slidepapers_admin_session', 'true');
        setIsAdmin(true);
        setLoading(false);
        return result.user;
      } catch (error) {
        console.error("[AuthContext] Firebase signInWithEmailAndPassword Error:", error);
        localStorage.removeItem('slidepapers_admin_session');
        setIsAdmin(false);
        setLoading(false);
        
        // Since the email exists in the whitelist, any Firebase authentication error represents an incorrect password
        let cleanMessage = `Incorrect password for ${emailClean}.`;
        
        if (error.code === 'auth/user-not-found') {
          // Fallback if not created in Firebase Console yet
          cleanMessage = `This Admin ID exists in the whitelist but has not been created in your Firebase Console tab yet.`;
        }
        
        throw new Error(cleanMessage);
      }
    } else {
      console.log('[AuthContext] Firebase not configured or auth not initialized.');
      setLoading(false);
      throw new Error(`Firebase is not configured. Use admin@slidepapers.com / admin123 to log in locally.`);
    }
  };

  // Sign out helper
  const logout = async () => {
    setLoading(true);
    setIsAdmin(false);
    localStorage.removeItem('slidepapers_admin_session');
    if (isConfigured && auth) {
      try {
        await firebaseSignOut(auth);
        setLoading(false);
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
    isAdmin,
    loading,
    loginWithGoogle,
    loginAdminWithGoogle,
    loginWithEmail,
    logout,
    isFirebaseReal: isConfigured
  };

  return (
    <AuthContext.Provider value={value}>
      {!initialLoading && children}
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
