import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, limit, getDocs } from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            
            // Migration/Fix: Ensure Tenant doc exists for Admin and Tenant roles
            if (data.role === 'admin' || data.role === 'tenant') {
              const tenantDoc = await getDoc(doc(db, 'tenants', firebaseUser.uid));
              if (!tenantDoc.exists()) {
                await setDoc(doc(db, 'tenants', firebaseUser.uid), {
                  id: firebaseUser.uid,
                  name: firebaseUser.displayName || 'My Organization',
                  createdAt: serverTimestamp(),
                  settings: { callRecordingEnabled: false }
                });
              }
            }

            // Migration: Ensure Admin has a tenantId if missing
            if (data.role === 'admin' && !data.tenantId) {
              const updatedProfile = { ...data, tenantId: firebaseUser.uid };
              await updateDoc(userDocRef, { tenantId: firebaseUser.uid });
              setProfile({ ...data, tenantId: firebaseUser.uid });
            } else {
              setProfile(data);
            }
          } else {
            // Check if this is the first user ever
            const usersQuery = query(collection(db, 'users'), limit(1));
            const usersSnapshot = await getDocs(usersQuery);
            
            let role: UserRole = 'tenant';
            // Bootstrap admin by email or if no users exist
            if (usersSnapshot.empty || firebaseUser.email === 'sunil.gadhiya@gmail.com') {
              role = 'admin';
            }

            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: role,
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL || '',
              createdAt: serverTimestamp(),
              tenantId: firebaseUser.uid // Both Admin and Tenant get their own tenantId
            };

            await setDoc(userDocRef, newProfile);
            
            // Create tenant doc for both Admin and Tenant
            await setDoc(doc(db, 'tenants', firebaseUser.uid), {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'My Organization',
              createdAt: serverTimestamp(),
              settings: { callRecordingEnabled: false }
            });

            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'users');
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
