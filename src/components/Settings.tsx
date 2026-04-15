import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, setDoc } from 'firebase/firestore';
import { Tenant, VobizConfig, UserProfile } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { 
  Building2, 
  Shield, 
  Users, 
  Save, 
  Info, 
  Copy, 
  CheckCircle2,
  PlusCircle,
  UserPlus,
  Mail,
  RefreshCw,
  LogOut,
  ExternalLink,
  PhoneCall
} from 'lucide-react';

import { Badge } from './ui/badge';

const Settings: React.FC = () => {
  const { profile } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [agents, setAgents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newAgentEmail, setNewAgentEmail] = useState('');

  const [vobizConfig, setVobizConfig] = useState<VobizConfig>({
    id: '',
    authId: '',
    authSecret: '',
    username: '',
    password: '',
    sipUri: '',
    did: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.tenantId) return;

      try {
        const tenantDoc = await getDoc(doc(db, 'tenants', profile.tenantId));
        if (tenantDoc.exists()) {
          const data = tenantDoc.data() as Tenant;
          setTenant(data);
          if (data.vobizConfig) setVobizConfig(data.vobizConfig);
        }

        const agentsQuery = query(
          collection(db, 'users'),
          where('tenantId', '==', profile.tenantId),
          where('role', '==', 'agent')
        );
        const agentsSnapshot = await getDocs(agentsQuery);
        setAgents(agentsSnapshot.docs.map(doc => doc.data() as UserProfile));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'tenants');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        toast.success('Google account connected successfully!');
        // Refresh tenant data
        if (profile?.tenantId) {
          getDoc(doc(db, 'tenants', profile.tenantId)).then(tenantDoc => {
            if (tenantDoc.exists()) {
              setTenant(tenantDoc.data() as Tenant);
            }
          });
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [profile]);

  const handleConnectGoogle = async () => {
    if (!profile?.tenantId) return;
    try {
      const response = await fetch(`/api/auth/google/url?tenantId=${profile.tenantId}`);
      const { url } = await response.json();
      window.open(url, 'google_auth', 'width=600,height=700');
    } catch (error) {
      toast.error('Failed to initiate Google connection');
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!profile?.tenantId) return;
    try {
      await updateDoc(doc(db, 'tenants', profile.tenantId), {
        googleConnection: null
      });
      setTenant(prev => prev ? { ...prev, googleConnection: undefined } : null);
      toast.success('Google account disconnected');
    } catch (error) {
      toast.error('Failed to disconnect Google account');
    }
  };

  const handleSaveConfig = async () => {
    if (!profile?.tenantId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'tenants', profile.tenantId), {
        vobizConfig: vobizConfig
      });
      toast.success('Vobiz configuration saved');
    } catch (error) {
      console.error('Save Config Error:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRecording = async (enabled: boolean) => {
    if (!profile?.tenantId) return;
    try {
      await updateDoc(doc(db, 'tenants', profile.tenantId), {
        'settings.callRecordingEnabled': enabled
      });
      setTenant(prev => prev ? { ...prev, settings: { ...prev.settings!, callRecordingEnabled: enabled } } : null);
      toast.success(`Call recording ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update recording setting');
    }
  };

  const handleToggleCallWaiting = async (enabled: boolean) => {
    if (!profile?.tenantId) return;
    try {
      await updateDoc(doc(db, 'tenants', profile.tenantId), {
        'settings.callWaitingEnabled': enabled
      });
      setTenant(prev => prev ? { ...prev, settings: { ...prev.settings!, callWaitingEnabled: enabled } } : null);
      toast.success(`Call waiting ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update call waiting setting');
    }
  };

  const handleAddAgent = async () => {
    if (!newAgentEmail || !profile?.tenantId) return;
    try {
      const newAgentRef = doc(collection(db, 'users'));
      await setDoc(newAgentRef, {
        uid: newAgentRef.id,
        email: newAgentEmail,
        role: 'agent',
        tenantId: profile.tenantId,
        createdAt: new Date(),
        displayName: newAgentEmail.split('@')[0]
      });
      toast.success('Agent added successfully');
      setNewAgentEmail('');
      
      // Refresh agents list
      const agentsQuery = query(
        collection(db, 'users'),
        where('tenantId', '==', profile.tenantId),
        where('role', '==', 'agent')
      );
      const agentsSnapshot = await getDocs(agentsQuery);
      setAgents(agentsSnapshot.docs.map(doc => doc.data() as UserProfile));
    } catch (error) {
      console.error('Error adding agent:', error);
      toast.error('Failed to add agent');
    }
  };

  const handleSaveOrgName = async () => {
    if (!profile?.tenantId || !tenant?.name) return;
    try {
      await updateDoc(doc(db, 'tenants', profile.tenantId), {
        name: tenant.name
      });
      toast.success('Organization name saved');
    } catch (error) {
      toast.error('Failed to save organization name');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const answerUrl = `${window.location.origin}/api/vobiz/answer`;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text-main tracking-tight">Settings</h1>
          <p className="text-text-muted mt-1">Configure your organization and VOIP provider</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="sleek-badge">System Active</span>
        </div>
      </div>

      <Tabs defaultValue="vobiz" className="w-full">
        <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none h-auto p-0 mb-8">
          <TabsTrigger value="vobiz" className="rounded-none border-b-2 border-transparent px-6 py-3 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent font-semibold">
            VOBIZ Integration
          </TabsTrigger>
          <TabsTrigger value="agents" className="rounded-none border-b-2 border-transparent px-6 py-3 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent font-semibold">
            Agents
          </TabsTrigger>
          <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent px-6 py-3 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent font-semibold">
            General
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vobiz" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 sleek-card p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-text-main">VOBIZ Integration</h3>
              {tenant?.vobizConfig?.did && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-primary rounded-full border border-blue-100">
                  <PhoneCall className="w-4 h-4" />
                  <span className="text-sm font-bold">{tenant.vobizConfig.did}</span>
                </div>
              )}
            </div>

            {profile?.role !== 'admin' ? (
              <div className="space-y-6">
                <div className="p-6 bg-bg border border-border rounded-xl">
                  <p className="text-sm text-text-muted mb-4">
                    Your VOBIZ connection is managed by the system administrator. 
                    If you need to change your credentials or number, please contact support.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-surface rounded-lg border border-border">
                      <p className="text-[0.7rem] font-bold text-text-muted uppercase tracking-wider mb-1">Assigned Number</p>
                      <p className="font-bold text-text-main">{tenant?.vobizConfig?.did || 'None'}</p>
                    </div>
                    <div className="p-4 bg-surface rounded-lg border border-border">
                      <p className="text-[0.7rem] font-bold text-text-muted uppercase tracking-wider mb-1">SIP Username</p>
                      <p className="font-bold text-text-main">{tenant?.vobizConfig?.username || 'None'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[0.75rem] font-bold text-text-muted uppercase tracking-wider">Auth ID</Label>
                    <Input 
                      value={vobizConfig.authId} 
                      onChange={(e) => setVobizConfig({ ...vobizConfig, authId: e.target.value })}
                      placeholder="Enter Auth ID"
                      className="h-11 rounded-lg border-border bg-bg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[0.75rem] font-bold text-text-muted uppercase tracking-wider">Auth Secret</Label>
                    <Input 
                      type="password"
                      value={vobizConfig.authSecret} 
                      onChange={(e) => setVobizConfig({ ...vobizConfig, authSecret: e.target.value })}
                      placeholder="Enter Auth Secret"
                      className="h-11 rounded-lg border-border bg-bg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[0.75rem] font-bold text-text-muted uppercase tracking-wider">Endpoint Username</Label>
                    <Input 
                      value={vobizConfig.username} 
                      onChange={(e) => setVobizConfig({ ...vobizConfig, username: e.target.value })}
                      placeholder="Enter Username"
                      className="h-11 rounded-lg border-border bg-bg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[0.75rem] font-bold text-text-muted uppercase tracking-wider">Endpoint Password</Label>
                    <Input 
                      type="password"
                      value={vobizConfig.password} 
                      onChange={(e) => setVobizConfig({ ...vobizConfig, password: e.target.value })}
                      placeholder="Enter Password"
                      className="h-11 rounded-lg border-border bg-bg"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-[0.75rem] font-bold text-text-muted uppercase tracking-wider">SIP Domain</Label>
                    <Input 
                      value={vobizConfig.sipUri} 
                      onChange={(e) => setVobizConfig({ ...vobizConfig, sipUri: e.target.value })}
                      placeholder="e.g. sip.vobiz.ai"
                      className="h-11 rounded-lg border-border bg-bg"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-[0.75rem] font-bold text-text-muted uppercase tracking-wider">DID (Phone Number)</Label>
                    <Input 
                      value={vobizConfig.did || ''} 
                      onChange={(e) => setVobizConfig({ ...vobizConfig, did: e.target.value })}
                      placeholder="e.g. +1234567890"
                      className="h-11 rounded-lg border-border bg-bg"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveConfig} disabled={saving} className="mt-8 h-11 px-8 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg shadow-lg shadow-primary/20">
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
              </>
            )}
          </div>

          <div className="space-y-6">
            <div className="sleek-card p-6 bg-[#fff9db] border-[#ffec99]">
              <h4 className="text-sm font-bold text-[#856404] mb-3 flex items-center gap-2">
                <Info className="w-4 h-4" />
                VOBIZ Answer URL
              </h4>
              <p className="text-[0.75rem] text-[#856404] leading-relaxed mb-4">
                Input this URL in your VOBIZ dashboard to enable WebRTC events.
              </p>
              <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-[#ffec99] shadow-inner">
                <code className="flex-1 text-[0.7rem] font-mono text-[#856404] break-all">{answerUrl}</code>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(answerUrl)} className="text-[#856404] hover:bg-yellow-100">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="sleek-card p-6">
              <h4 className="text-sm font-bold text-text-main mb-4">Quick Toggles</h4>
              <div className="space-y-1">
                <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <span className="text-sm font-medium text-text-main">Call Recording</span>
                  <Switch 
                    checked={tenant?.settings?.callRecordingEnabled || false}
                    onCheckedChange={handleToggleRecording}
                    className="data-[state=checked]:bg-success"
                  />
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <span className="text-sm font-medium text-text-main">Call Waiting</span>
                  <Switch 
                    checked={tenant?.settings?.callWaitingEnabled ?? true}
                    onCheckedChange={handleToggleCallWaiting}
                    className="data-[state=checked]:bg-success" 
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="agents" className="space-y-6">
          <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle>Manage Agents</CardTitle>
                    <CardDescription>Add and manage agents for your organization</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex gap-3 mb-8">
                <Input 
                  placeholder="Agent Email Address" 
                  value={newAgentEmail}
                  onChange={(e) => setNewAgentEmail(e.target.value)}
                  className="rounded-lg border-slate-200"
                />
                <Button onClick={handleAddAgent} className="bg-purple-600 hover:bg-purple-700 rounded-lg gap-2 whitespace-nowrap">
                  <UserPlus className="w-4 h-4" />
                  Add Agent
                </Button>
              </div>

              <div className="space-y-4">
                {agents.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No agents added yet.
                  </div>
                ) : (
                  agents.map((agent) => (
                    <div key={agent.uid} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-3">
                        {agent.photoURL ? (
                          <img src={agent.photoURL} alt="" className="w-10 h-10 rounded-full border border-slate-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold border border-purple-200">
                            {agent.displayName?.charAt(0).toUpperCase() || agent.email.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-900">{agent.displayName}</p>
                          <p className="text-xs text-slate-500">{agent.email}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-green-50 text-green-700 border-none">Active</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="space-y-6">
          <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-primary rounded-lg">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle>Integrations</CardTitle>
                  <CardDescription>Connect third-party services to your organization</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center justify-between p-6 sleek-card">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-bg rounded-xl flex items-center justify-center border border-border">
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-text-main">Google Account</h4>
                    <p className="text-sm text-text-muted">
                      {tenant?.googleConnection 
                        ? `Connected as ${tenant.googleConnection.email}` 
                        : 'Connect your Google account to sync contacts permanently'}
                    </p>
                  </div>
                </div>
                {tenant?.googleConnection ? (
                  <Button variant="outline" onClick={handleDisconnectGoogle} className="rounded-lg border-danger text-danger hover:bg-red-50 font-semibold gap-2">
                    <LogOut className="w-4 h-4" />
                    Disconnect
                  </Button>
                ) : (
                  <Button onClick={handleConnectGoogle} className="rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold gap-2 shadow-lg shadow-primary/20">
                    <RefreshCw className="w-4 h-4" />
                    Connect Google
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle>Organization Settings</CardTitle>
                  <CardDescription>General preferences for your organization</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="space-y-0.5">
                  <Label className="text-base font-bold text-slate-900">Call Recording</Label>
                  <p className="text-sm text-slate-500">Automatically record all incoming and outgoing calls</p>
                </div>
                <Switch 
                  checked={tenant?.settings?.callRecordingEnabled || false}
                  onCheckedChange={handleToggleRecording}
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input 
                    id="orgName" 
                    value={tenant?.name || ''} 
                    onChange={(e) => setTenant(prev => prev ? { ...prev, name: e.target.value } : null)}
                    className="rounded-lg border-slate-200"
                  />
                </div>
                <Button onClick={handleSaveOrgName} className="bg-slate-900 hover:bg-slate-800 rounded-lg gap-2">
                  <Save className="w-4 h-4" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
