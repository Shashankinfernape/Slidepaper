/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
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

// These are the real Firebase-authenticated admin accounts.
// Role is also enforced server-side in sync-profile.
const ALLOWED_ADMIN_EMAILS = [
  'infernapeshashank@gmail.com',
  'jasondomnic5@gmail.com'
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!(isConfigured && auth));
  const [loading, setLoading] = useState(false);

  const hasSynced = useRef(false);
  const [userProfile, setUserProfile] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);

  const toggleSubscriptionLocal = (authorUid) => {
    setSubscriptions(prev => {
      if (prev.includes(authorUid)) {
        return prev.filter(uid => uid !== authorUid);
      } else {
        return [...prev, authorUid];
      }
    });
  };

  const updateUserProfileState = (updatedProfile) => {
    setUserProfile(updatedProfile);
    setUser(prev => {
      if (!prev) return null;
      return {
        ...prev,
        displayName: updatedProfile.displayName || prev.displayName,
        photoURL: updatedProfile.photoURL || prev.photoURL
      };
    });
  };

  const syncUserProfile = async (currentUser) => {
    if (!currentUser) return;
    try {
      const cleanPhoto = (currentUser.photoURL && !currentUser.photoURL.startsWith('data:image/svg')) ? currentUser.photoURL : undefined;
      const res = await fetch(`${API_URL}/api/users/sync-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser.uid,
          displayName: currentUser.displayName,
          email: currentUser.email,
          photoURL: cleanPhoto
        })
      });
      if (res.ok) {
        const data = await res.json();
        console.log('[AuthContext] Profile synced successfully.', data);
        if (data.success && data.user) {
          hasSynced.current = true;
          setUserProfile(data.user);
          if (data.subscriptions) {
            setSubscriptions(data.subscriptions);
          }
          // Set isAdmin from what the DATABASE says — this is the source of truth
          const dbRole = data.user.role;
          setIsAdmin(dbRole === 'admin');
          setUser(prev => {
            if (!prev) return null;
            return {
              ...prev,
              displayName: data.user.displayName || prev.displayName,
              photoURL: data.user.photoURL || prev.photoURL
            };
          });
        }
      }
    } catch (err) {
      console.error('[AuthContext] Failed to sync user profile with backend:', err);
    }
  };

  // Monitor Firebase Auth state
  useEffect(() => {
    if (!isConfigured || !auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('[AuthContext] onAuthStateChanged fired. User:', currentUser ? currentUser.email : 'null');

      setUser(currentUser);
      if (currentUser) {
        const emailClean = (currentUser.email || '').trim().toLowerCase();
        // Optimistic admin flag while DB sync is in-flight
        setIsAdmin(ALLOWED_ADMIN_EMAILS.includes(emailClean));
      } else {
        setIsAdmin(false);
        hasSynced.current = false;
        setUserProfile(null);
      }
      setInitialLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync user profile with backend database whenever user state changes
  useEffect(() => {
    if (user) {
      const isMismatch = userProfile && userProfile.uid !== user.uid;
      if (!hasSynced.current || isMismatch) {
        hasSynced.current = false;
        syncUserProfile(user);
      }
    } else {
      hasSynced.current = false;
      setUserProfile(null);
    }
  }, [user]);

  const loginWithGoogle = async () => {
    setLoading(true);
    if (isConfigured && auth) {
      try {
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await signInWithPopup(auth, provider);
        setLoading(false);
        return result.user;
      } catch (error) {
        console.error('Firebase Login Error:', error);
        setLoading(false);
        throw error;
      }
    } else {
      setLoading(false);
      throw new Error('Firebase is not configured.');
    }
  };

  // Admin Google sign in — validates the email is an allowed admin account
  const loginAdminWithGoogle = async () => {
    setLoading(true);
    try {
      const googleUser = await loginWithGoogle();
      const emailClean = (googleUser.email || '').trim().toLowerCase();
      if (!ALLOWED_ADMIN_EMAILS.includes(emailClean)) {
        if (isConfigured && auth) {
          await firebaseSignOut(auth);
        }
        setUser(null);
        setIsAdmin(false);
        throw new Error('This Google Account is not registered as an Admin.');
      }
      setLoading(false);
      return googleUser;
    } catch (error) {
      setIsAdmin(false);
      setLoading(false);
      throw error;
    }
  };

  // Email/password login — goes directly through Firebase for all accounts
  const loginWithEmail = async (email, password) => {
    setLoading(true);
    const emailClean = (email || '').trim().toLowerCase();

    if (isConfigured && auth) {
      try {
        console.log('[AuthContext] Attempting Firebase signInWithEmailAndPassword for:', emailClean);
        const result = await signInWithEmailAndPassword(auth, emailClean, password);
        console.log('[AuthContext] Firebase signInWithEmailAndPassword success:', result.user.email);
        setLoading(false);
        return result.user;
      } catch (error) {
        console.warn('[AuthContext] Firebase signIn failed:', error.code);

        // Auto-register if the account doesn't exist in Firebase yet
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-email') {
          try {
            const createResult = await createUserWithEmailAndPassword(auth, emailClean, password);
            console.log('[AuthContext] Firebase createUserWithEmailAndPassword success:', createResult.user.email);
            setLoading(false);
            return createResult.user;
          } catch (createErr) {
            console.error('[AuthContext] Firebase Registration Error:', createErr);
            setLoading(false);
            if (createErr.code === 'auth/email-already-in-use') {
              throw new Error(`Incorrect password for ${emailClean}.`);
            } else if (createErr.code === 'auth/weak-password') {
              throw new Error('Password should be at least 6 characters.');
            }
            throw new Error(createErr.message || 'Authentication failed.');
          }
        }

        setLoading(false);
        throw new Error(`Incorrect password for ${emailClean}.`);
      }
    } else {
      setLoading(false);
      throw new Error('Firebase is not configured. Cannot sign in.');
    }
  };

  // Sign out
  const logout = async () => {
    setLoading(true);
    setIsAdmin(false);
    hasSynced.current = false;
    setUserProfile(null);
    if (isConfigured && auth) {
      try {
        await firebaseSignOut(auth);
        setLoading(false);
      } catch (error) {
        console.error('Firebase Signout Error:', error);
        setLoading(false);
        throw error;
      }
    } else {
      setUser(null);
      setLoading(false);
    }
  };

  const isCurator = isAdmin || userProfile?.role === 'curator' || userProfile?.role === 'admin' || userProfile?.curatorStatus === 'approved';
  const userRole = isAdmin ? 'admin' : (userProfile?.role || 'user');

  const value = {
    user,
    userProfile,
    updateUserProfileState,
    isAdmin,
    isCurator,
    userRole,
    loading,
    loginWithGoogle,
    loginAdminWithGoogle,
    loginWithEmail,
    logout,
    isFirebaseReal: isConfigured,
    subscriptions,
    toggleSubscriptionLocal
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
