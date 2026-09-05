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

const ALLOWED_ADMIN_EMAILS = [
  'admin@slidepapers.com',
  'infernapeshashank@gmail.com',
  'jasondomnic@gmail.com',
  'jasondomnii@gmail.com',
  'jasondomnic5@gmail.com',
  'jasondomnic025@gmail.com'
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const isAdminSession = localStorage.getItem('slidepapers_admin_session') === 'true';
    if (isAdminSession) {
      return {
        uid: 'admin-mock-999',
        displayName: 'Infernape',
        email: 'admin@slidepapers.com'
      };
    }
    return null;
  });
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('slidepapers_admin_session') === 'true';
  });
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
          setUser(prev => {
            if (!prev) return null;
            return {
              ...prev,
              uid: data.user.uid || prev.uid,
              email: data.user.email || prev.email,
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
        setUser(prev => ({
          uid: 'admin-mock-999',
          displayName: 'Infernape',
          email: 'admin@slidepapers.com',
          photoURL: prev?.photoURL || userProfile?.photoURL || undefined
        }));
        setIsAdmin(true);
        setInitialLoading(false);
        return;
      }

      setUser(currentUser);
      if (currentUser) {
        const emailClean = (currentUser.email || '').trim().toLowerCase();
        const isEmailPassword = currentUser.providerData.some(p => p.providerId === 'password');
        const computedAdmin = ALLOWED_ADMIN_EMAILS.includes(emailClean) || isAdminSession;
        
        console.log('[AuthContext] User exists. computedAdmin:', computedAdmin);
        setIsAdmin(computedAdmin);

        // Only clear mock session if they are NOT an allowed admin
        if (!ALLOWED_ADMIN_EMAILS.includes(emailClean) && isAdminSession) {
          localStorage.removeItem('slidepapers_admin_session');
          setIsAdmin(false);
        }
      } else {
        console.log('[AuthContext] User is null. Setting isAdmin = false');
        setIsAdmin(false);
      }
      setInitialLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync user profile with backend database whenever user state changes
  useEffect(() => {
    if (user) {
      // If the currently synced profile doesn't match the active user, we need to re-sync
      // This happens when transitioning from the mock-admin initial state to a real Firebase user
      const isMismatch = userProfile && userProfile.uid !== user.uid;
      
      if (!hasSynced.current || isMismatch) {
        hasSynced.current = false; // Reset it so it can sync again
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
            photoURL: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>'
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
      const googleUser = await loginWithGoogle();
      const emailClean = (googleUser.email || '').trim().toLowerCase();
      
      const isMockUser = googleUser.uid === 'google-mock-101';
      if (!ALLOWED_ADMIN_EMAILS.includes(emailClean) && !isMockUser) {
        if (isConfigured && auth) {
          await firebaseSignOut(auth);
        }
        setUser(null);
        setIsAdmin(false);
        localStorage.removeItem('slidepapers_admin_session');
        throw new Error('This Google Account is not registered as an Admin.');
      }
      
      localStorage.setItem('slidepapers_admin_session', 'true');
      setIsAdmin(true);
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

    let emailClean = (email || '').trim().toLowerCase();

    // Normalize shorthands
    if (emailClean === 'admin') {
      emailClean = 'admin@slidepapers.com';
    }

    // 2. Local admin account bypass
    if (emailClean === 'admin@slidepapers.com') {
      if (password === 'Javierdx5' || password === 'admin') {
        console.log('[AuthContext] Match mock admin login credentials. Bypassing Firebase.');
        localStorage.setItem('slidepapers_admin_session', 'true');
        setIsAdmin(true);
        return new Promise((resolve) => {
          setTimeout(() => {
            const adminUser = {
              uid: 'admin-mock-999',
              displayName: 'Infernape',
              email: 'admin@slidepapers.com'
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

    // 2. Custom local check for jasondomnic025@gmail.com
    if (emailClean === 'jasondomnic025@gmail.com') {
      if (password === 'Javierdx5') {
        return new Promise((resolve) => {
          setTimeout(() => {
            const mockUser = {
              uid: 'jasondomnic025',
              displayName: 'Jason Domnic',
              email: 'jasondomnic025@gmail.com'
            };
            setUser(mockUser);
            setIsAdmin(true);
            localStorage.setItem('slidepapers_admin_session', 'true');
            setLoading(false);
            resolve(mockUser);
          }, 800);
        });
      } else {
        setLoading(false);
        throw new Error(`Incorrect password for ${emailClean}.`);
      }
    }

    // 3. Let Firebase handle real email/password authentication
    if (isConfigured && auth) {
      try {
        console.log('[AuthContext] Attempting Firebase signInWithEmailAndPassword for:', emailClean);
        const result = await signInWithEmailAndPassword(auth, emailClean, password);
        console.log('[AuthContext] Firebase signInWithEmailAndPassword success:', result.user.email);
        setLoading(false);
        return result.user;
      } catch (error) {
        console.warn('[AuthContext] Firebase signIn failed with code:', error.code, 'Attempting auto-registration...');
        
        // If user is not found or credentials not created yet in Firebase Auth, attempt auto-registration
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
    hasSynced.current = false;
    setUserProfile(null);
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
