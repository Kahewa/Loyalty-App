import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db, isConfigured } from './firebase';
import { DEFAULT_TEMPLATES } from './templates';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [initialising, setInitialising] = useState(true);

  useEffect(() => {
    if (!isConfigured) {
      setInitialising(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitialising(false);
    });
  }, []);

  // Live-subscribe to the owner's business document once signed in.
  useEffect(() => {
    if (!user) {
      setBusiness(null);
      return;
    }
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setBusiness(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  }, [user]);

  const value = {
    user,
    business,
    initialising,
    signIn: (email, password) =>
      signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password),
    resetPassword: (email) => sendPasswordResetEmail(auth, email.trim().toLowerCase()),
    signOut: () => fbSignOut(auth),
    async register(email, password, businessName) {
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );
      const ref = doc(db, 'users', cred.user.uid);
      const existing = await getDoc(ref);
      if (!existing.exists()) {
        await setDoc(ref, {
          businessName: businessName.trim(),
          ownerEmail: email.trim().toLowerCase(),
          logoUrl: '',
          ...DEFAULT_TEMPLATES,
          createdAt: serverTimestamp(),
        });
      }
      // The world-readable half, so the join page can greet people by shop name
      // without being able to see the owner's email or message templates.
      await setDoc(
        doc(db, 'users', cred.user.uid, 'public', 'profile'),
        { businessName: businessName.trim(), logoUrl: '' },
        { merge: true }
      );
      return cred.user;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
