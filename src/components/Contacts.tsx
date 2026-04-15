import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { Contact, Tenant } from '../types';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { getDoc } from 'firebase/firestore';
import { 
  Search, 
  UserPlus, 
  Mail, 
  Phone, 
  Trash2, 
  RefreshCw,
  ExternalLink,
  Settings as SettingsIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

import { Badge } from './ui/badge';

const Contacts: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!profile?.tenantId) return;

    const q = query(
      collection(db, 'contacts'),
      where('tenantId', '==', profile.tenantId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contactList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Contact[];
      setContacts(contactList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'contacts');
    });

    return () => unsubscribe();
  }, [profile]);

  const handleGoogleSync = async () => {
    if (!profile?.tenantId) return;
    
    setSyncing(true);
    try {
      // 1. Check if Google is connected
      const tenantDoc = await getDoc(doc(db, 'tenants', profile.tenantId));
      const tenantData = tenantDoc.data() as Tenant;

      if (!tenantData?.googleConnection?.refreshToken) {
        toast.error('Google account not connected. Please connect it in Settings.', {
          action: {
            label: 'Go to Settings',
            onClick: () => navigate('/settings')
          }
        });
        return;
      }

      // 2. Trigger backend sync
      const response = await fetch('/api/contacts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: profile.tenantId })
      });

      const result = await response.json();
      if (result.success) {
        toast.success(`Successfully synced ${result.count} contacts from Google!`);
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Sync Error:', error);
      toast.error('Failed to sync contacts from Google');
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'contacts', id));
      toast.success('Contact deleted');
    } catch (error) {
      toast.error('Failed to delete contact');
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text-main tracking-tight">Contacts</h1>
          <p className="text-text-muted mt-1">Manage your business and synced contacts</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={handleGoogleSync} 
            variant="outline" 
            disabled={syncing}
            className="rounded-lg border-border hover:bg-bg gap-2 font-semibold"
          >
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            {syncing ? 'Syncing...' : 'Sync Google'}
          </Button>
          <Button className="rounded-lg bg-primary hover:bg-primary-dark text-white gap-2 font-semibold shadow-lg shadow-primary/20">
            <UserPlus className="w-4 h-4" />
            Add Contact
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
        <Input 
          placeholder="Search by name or number..." 
          className="pl-10 h-12 bg-surface border-border rounded-xl shadow-sm focus-visible:ring-primary/20"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-20 text-text-muted">Loading contacts...</div>
        ) : filteredContacts.length === 0 ? (
          <div className="col-span-full text-center py-20 text-text-muted sleek-card border-dashed">
            No contacts found.
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <div key={contact.id} className="sleek-card p-6 group hover:border-primary/50 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-bg rounded-full flex items-center justify-center text-primary font-bold text-lg border border-border">
                    {contact.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-text-main group-hover:text-primary transition-colors">{contact.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
                      {contact.googleId && <span className="sleek-badge bg-blue-50 text-primary border-none text-[10px]">Google Synced</span>}
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-text-muted hover:text-danger hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(contact.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-text-main bg-bg p-2 rounded-lg">
                  <Phone className="w-4 h-4 text-primary" />
                  <span className="font-mono">{contact.phone}</span>
                </div>
                {contact.email && (
                  <div className="flex items-center gap-3 text-sm text-text-muted p-2">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{contact.email}</span>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-border flex gap-2">
                <Button className="flex-1 bg-primary hover:bg-primary-dark text-white h-9 rounded-lg gap-2 font-semibold">
                  <Phone className="w-3.5 h-3.5" />
                  Call
                </Button>
                <Button variant="outline" className="flex-1 h-9 rounded-lg gap-2 border-border hover:bg-bg font-semibold">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Details
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Contacts;
