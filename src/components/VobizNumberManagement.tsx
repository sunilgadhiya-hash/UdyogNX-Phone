import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, setDoc, getDoc } from 'firebase/firestore';
import { VobizConfig, Tenant } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';

const VobizNumberManagement: React.FC = () => {
  const [numbers, setNumbers] = useState<VobizConfig[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<VobizConfig>>({
    authId: '',
    authSecret: '',
    username: '',
    password: '',
    sipUri: 'sip.vobiz.ai',
    did: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const numbersSnapshot = await getDocs(collection(db, 'vobiz_numbers'));
      const tenantsSnapshot = await getDocs(collection(db, 'tenants'));
      
      setNumbers(numbersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VobizConfig)));
      setTenants(tenantsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tenant)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'vobiz_numbers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'vobiz_numbers', editingId), formData);
        toast.success('VOBIZ Number updated');
      } else {
        const newDocRef = doc(collection(db, 'vobiz_numbers'));
        await setDoc(newDocRef, {
          ...formData,
          id: newDocRef.id,
          assignedToTenantId: null
        });
        toast.success('VOBIZ Number added');
      }
      setIsAdding(false);
      setEditingId(null);
      setFormData({
        authId: '',
        authSecret: '',
        username: '',
        password: '',
        sipUri: 'sip.vobiz.ai',
        did: ''
      });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'vobiz_numbers');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this VOBIZ number?')) return;
    try {
      await deleteDoc(doc(db, 'vobiz_numbers', id));
      toast.success('VOBIZ Number deleted');
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'vobiz_numbers');
    }
  };

  const handleAssign = async (numberId: string, tenantId: string | null) => {
    try {
      // 1. Update the VobizNumber record
      await updateDoc(doc(db, 'vobiz_numbers', numberId), {
        assignedToTenantId: tenantId
      });

      // 2. Update the Tenant record
      if (tenantId) {
        const number = numbers.find(n => n.id === numberId);
        if (number) {
          try {
            const response = await fetch('/api/vobiz/provision', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...number, tenantId })
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              console.error("Failed to provision on Vobiz", errorData);
              toast.error(`Failed to auto-provision endpoint on Vobiz: ${errorData.error?.error || errorData.error || 'Unknown error'}`);
              return; // Stop assignment if provisioning fails
            }
          } catch (e) {
            console.error("Failed to provision on Vobiz", e);
            toast.error('Failed to auto-provision endpoint on Vobiz');
            return; // Stop assignment if provisioning fails
          }

          await updateDoc(doc(db, 'tenants', tenantId), {
            vobizNumberId: numberId,
            vobizConfig: {
              authId: number.authId,
              authSecret: number.authSecret,
              username: number.username,
              password: number.password,
              sipUri: number.sipUri,
              did: number.did
            }
          });
        }
      } else {
        // If unassigning, fetch the current state from Firestore to avoid stale local state
        const numberDoc = await getDoc(doc(db, 'vobiz_numbers', numberId));
        if (numberDoc.exists()) {
          const currentAssignedTenantId = numberDoc.data().assignedToTenantId;
          if (currentAssignedTenantId) {
            await updateDoc(doc(db, 'tenants', currentAssignedTenantId), {
              vobizNumberId: null,
              vobizConfig: null
            });
          }
        }
      }
      
      toast.success('Assignment updated');
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'assignment');
    }
  };

  if (loading) return <div>Loading VOBIZ Management...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">VOBIZ Number Pool</h2>
        <Button onClick={() => setIsAdding(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Number
        </Button>
      </div>

      {(isAdding || editingId) && (
        <form onSubmit={handleSubmit} className="sleek-card p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>DID (Phone Number)</Label>
            <Input 
              value={formData.did} 
              onChange={e => setFormData({...formData, did: e.target.value})}
              placeholder="e.g. +1234567890"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input 
              value={formData.username} 
              onChange={e => setFormData({...formData, username: e.target.value})}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input 
              type="password"
              value={formData.password} 
              onChange={e => setFormData({...formData, password: e.target.value})}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>SIP Domain</Label>
            <Input 
              value={formData.sipUri} 
              onChange={e => setFormData({...formData, sipUri: e.target.value})}
              placeholder="e.g. sip.vobiz.ai"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Auth ID</Label>
            <Input 
              value={formData.authId} 
              onChange={e => setFormData({...formData, authId: e.target.value})}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Auth Secret</Label>
            <Input 
              value={formData.authSecret} 
              onChange={e => setFormData({...formData, authSecret: e.target.value})}
              required
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2 mt-4">
            <Button type="button" variant="ghost" onClick={() => { setIsAdding(false); setEditingId(null); }}>
              Cancel
            </Button>
            <Button type="submit">
              {editingId ? 'Update' : 'Save'} Number
            </Button>
          </div>
        </form>
      )}

      <div className="sleek-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DID</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {numbers.map(num => (
              <TableRow key={num.id}>
                <TableCell className="font-bold">{num.did}</TableCell>
                <TableCell>{num.username}</TableCell>
                <TableCell>
                  <select 
                    className="bg-bg border border-border rounded-lg px-2 py-1 text-sm"
                    value={num.assignedToTenantId || ''}
                    onChange={(e) => handleAssign(num.id, e.target.value || null)}
                  >
                    <option value="">Unassigned</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => {
                    setEditingId(num.id);
                    setFormData(num);
                  }}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDelete(num.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {numbers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-text-muted">
                  No VOBIZ numbers configured.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default VobizNumberManagement;
