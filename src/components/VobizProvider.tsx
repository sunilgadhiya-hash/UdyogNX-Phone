import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthProvider';
import { db } from '../firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { VobizService } from '../services/vobizService';
import { Tenant } from '../types';
import { toast } from 'sonner';

type VobizStatus = 'idle' | 'connecting' | 'connected' | 'registered' | 'failed' | 'disconnected';

interface VobizContextType {
  service: VobizService | null;
  status: VobizStatus;
}

const VobizContext = createContext<VobizContextType | undefined>(undefined);

export const VobizProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [service, setService] = useState<VobizService | null>(null);
  const [status, setStatus] = useState<VobizStatus>('idle');
  const serviceRef = useRef<VobizService | null>(null);

  useEffect(() => {
    if (!profile?.tenantId) {
      if (serviceRef.current) {
        // Cleanup if needed
        serviceRef.current = null;
        setService(null);
        setStatus('idle');
      }
      return;
    }

    // Listen to tenant config changes in real-time
    const unsubscribe = onSnapshot(doc(db, 'tenants', profile.tenantId), (snapshot) => {
      if (snapshot.exists()) {
        const tenantData = snapshot.data() as Tenant;
        if (tenantData.vobizConfig) {
          const configStr = JSON.stringify(tenantData.vobizConfig);
          
          // Only re-initialize if config changed or not yet initialized
          if (!serviceRef.current || serviceRef.current.lastConfig !== configStr) {
            if (serviceRef.current) {
              serviceRef.current.stop();
            }
            
            const newService = new VobizService(tenantData.vobizConfig);
            newService.lastConfig = configStr;

            newService.onStatusChange = (newStatus) => {
              setStatus(newStatus as VobizStatus);
              if (newStatus === 'failed') {
                console.error('Vobiz registration failed. Please check your credentials.');
                toast.error('Vobiz connection failed. Please check your configuration.');
              }
            };
            newService.connect();
            serviceRef.current = newService;
            setService(newService);
            setStatus('connecting');
          }
        } else {
          if (serviceRef.current) {
            serviceRef.current.stop();
            serviceRef.current = null;
            setService(null);
          }
          setStatus('idle');
        }
      }
    });

    return () => {
      unsubscribe();
      if (serviceRef.current) {
        serviceRef.current.stop();
        serviceRef.current = null;
      }
    };
  }, [profile?.tenantId]);

  return (
    <VobizContext.Provider value={{ service, status }}>
      {children}
    </VobizContext.Provider>
  );
};

export const useVobiz = () => {
  const context = useContext(VobizContext);
  if (context === undefined) {
    throw new Error('useVobiz must be used within a VobizProvider');
  }
  return context;
};
