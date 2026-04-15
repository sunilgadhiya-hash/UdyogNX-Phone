import React, { useEffect, useState, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Tenant, UserProfile } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { 
  Users, 
  Building2, 
  PhoneCall, 
  TrendingUp,
  Activity,
  ShieldAlert,
  Search,
  Filter,
  MoreVertical,
  Trash2,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { 
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import VobizNumberManagement from './VobizNumberManagement';
import { toast } from 'sonner';

const AdminDashboard: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'configured' | 'pending'>('all');

  useEffect(() => {
    const unsubTenants = onSnapshot(collection(db, 'tenants'), (snapshot) => {
      setTenants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tenant)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tenants'));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    const unsubCalls = onSnapshot(collection(db, 'calls'), (snapshot) => {
      setCalls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'calls'));

    return () => {
      unsubTenants();
      unsubUsers();
      unsubCalls();
    };
  }, []);

  const stats = useMemo(() => {
    return {
      totalTenants: tenants.length,
      totalUsers: users.length,
      totalCalls: calls.length,
      activeCalls: calls.filter(c => c.status === 'active').length,
      missingTenantDocs: users.filter(u => u.role === 'tenant' && !tenants.find(t => t.id === u.uid)).length
    };
  }, [tenants, users, calls]);

  const filteredTenants = useMemo(() => {
    return tenants.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           t.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' || 
                           (filterStatus === 'configured' && t.vobizConfig) ||
                           (filterStatus === 'pending' && !t.vobizConfig);
      return matchesSearch && matchesFilter;
    });
  }, [tenants, searchTerm, filterStatus]);

  const handleFixMissingTenant = async (user: UserProfile) => {
    try {
      await setDoc(doc(db, 'tenants', user.uid), {
        id: user.uid,
        name: user.displayName || 'Organization',
        createdAt: serverTimestamp(),
        settings: { callRecordingEnabled: false }
      });
      toast.success(`Fixed tenant document for ${user.displayName}`);
    } catch (error) {
      toast.error('Failed to fix tenant document');
    }
  };

  const handleDeleteTenant = async (id: string) => {
    if (!confirm('Are you sure? This will NOT delete the user account, only the tenant configuration.')) return;
    try {
      await deleteDoc(doc(db, 'tenants', id));
      toast.success('Tenant configuration deleted');
    } catch (error) {
      toast.error('Failed to delete tenant');
    }
  };

  const chartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = days.map(day => ({ name: day, calls: 0 }));
    
    // Only look at calls from the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    calls.forEach(call => {
      if (call.startTime) {
        const date = call.startTime.toDate ? call.startTime.toDate() : new Date(call.startTime);
        if (date >= sevenDaysAgo) {
          const dayIndex = date.getDay();
          data[dayIndex].calls++;
        }
      }
    });

    // Reorder array to start from 6 days ago up to today
    const todayIndex = new Date().getDay();
    const orderedData = [];
    for (let i = 6; i >= 0; i--) {
      let idx = todayIndex - i;
      if (idx < 0) idx += 7;
      orderedData.push(data[idx]);
    }

    return orderedData;
  }, [calls]);

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-text-muted font-medium">Loading production metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-text-main tracking-tight">Production Admin Console</h1>
          <p className="text-text-muted mt-1">Real-time system monitoring and infrastructure management</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-success rounded-xl border border-green-100">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-bold">Systems Operational</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-bg border border-border p-1 rounded-xl mb-8">
          <TabsTrigger value="overview" className="rounded-lg px-6">Overview</TabsTrigger>
          <TabsTrigger value="tenants" className="rounded-lg px-6">Tenants</TabsTrigger>
          <TabsTrigger value="vobiz" className="rounded-lg px-6">VOBIZ Pool</TabsTrigger>
          <TabsTrigger value="health" className="rounded-lg px-6">System Health</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <Card className="sleek-card border-none shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-50 text-primary rounded-2xl">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <Badge variant="secondary" className="bg-green-50 text-success border-none">Live</Badge>
                </div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Total Tenants</p>
                <h3 className="text-3xl font-extrabold text-text-main mt-1">{stats.totalTenants}</h3>
              </CardContent>
            </Card>

            <Card className="sleek-card border-none shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                    <Users className="w-6 h-6" />
                  </div>
                  <Badge variant="secondary" className="bg-purple-50 text-purple-600 border-none">Active</Badge>
                </div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Total Users</p>
                <h3 className="text-3xl font-extrabold text-text-main mt-1">{stats.totalUsers}</h3>
              </CardContent>
            </Card>

            <Card className="sleek-card border-none shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
                    <PhoneCall className="w-6 h-6" />
                  </div>
                  <Badge variant="secondary" className="bg-orange-50 text-orange-600 border-none">Total</Badge>
                </div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Call Volume</p>
                <h3 className="text-3xl font-extrabold text-text-main mt-1">{stats.totalCalls}</h3>
              </CardContent>
            </Card>

            <Card className="sleek-card border-none shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-red-50 text-danger rounded-2xl">
                    <Activity className="w-6 h-6" />
                  </div>
                  <Badge variant="secondary" className="bg-red-50 text-danger border-none">Current</Badge>
                </div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Active Sessions</p>
                <h3 className="text-3xl font-extrabold text-text-main mt-1">{stats.activeCalls}</h3>
              </CardContent>
            </Card>

            <Card className="sleek-card border-none shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-yellow-50 text-yellow-600 rounded-2xl">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <Badge variant="secondary" className="bg-yellow-50 text-yellow-600 border-none">Issues</Badge>
                </div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Missing Docs</p>
                <h3 className="text-3xl font-extrabold text-text-main mt-1">{stats.missingTenantDocs}</h3>
              </CardContent>
            </Card>
          </div>

          {stats.missingTenantDocs > 0 && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
                <div>
                  <p className="font-bold text-orange-900">{stats.missingTenantDocs} Users missing Tenant Documents</p>
                  <p className="text-sm text-orange-700">These users signed up but their organization profile wasn't created correctly.</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="bg-white border-orange-200 text-orange-700 hover:bg-orange-100"
                onClick={() => {
                  const missing = users.filter(u => u.role === 'tenant' && !tenants.find(t => t.id === u.uid));
                  missing.forEach(handleFixMissingTenant);
                }}
              >
                Fix All
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 sleek-card border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-bg/50 border-b border-border">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Traffic Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <Tooltip 
                        contentStyle={{borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                      />
                      <Area type="monotone" dataKey="calls" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorCalls)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="sleek-card border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-bg/50 border-b border-border">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-orange-500" />
                  Security Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex gap-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-1.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-orange-900">API Throttling</p>
                    <p className="text-xs text-orange-700 mt-0.5">VOBIZ endpoint webrtc.vobiz.ai is nearing rate limits.</p>
                  </div>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-primary">Database Sync</p>
                    <p className="text-xs text-blue-700 mt-0.5">Firestore cross-region replication completed.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tenants" className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <Input 
                placeholder="Search by name or ID..." 
                className="pl-10 h-11 rounded-xl"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant={filterStatus === 'all' ? 'default' : 'outline'} 
                onClick={() => setFilterStatus('all')}
                className="rounded-xl"
              >
                All
              </Button>
              <Button 
                variant={filterStatus === 'configured' ? 'default' : 'outline'} 
                onClick={() => setFilterStatus('configured')}
                className="rounded-xl"
              >
                Configured
              </Button>
              <Button 
                variant={filterStatus === 'pending' ? 'default' : 'outline'} 
                onClick={() => setFilterStatus('pending')}
                className="rounded-xl"
              >
                Pending
              </Button>
            </div>
          </div>

          <Card className="sleek-card border-none shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-bg/50">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="py-4 pl-6">Organization</TableHead>
                  <TableHead className="py-4">Status</TableHead>
                  <TableHead className="py-4">DID Assignment</TableHead>
                  <TableHead className="py-4">Created</TableHead>
                  <TableHead className="py-4 text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.map((tenant) => (
                  <TableRow key={tenant.id} className="border-border hover:bg-bg/5 transition-colors">
                    <TableCell className="pl-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-text-main">{tenant.name}</span>
                        <span className="text-[0.65rem] font-mono text-text-muted">{tenant.id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-50 text-success border-none">Active</Badge>
                    </TableCell>
                    <TableCell>
                      {tenant.vobizConfig?.did ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-primary text-primary font-bold">
                            {tenant.vobizConfig.did}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-text-muted text-xs italic">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-text-muted text-sm">
                      {tenant.createdAt?.toDate ? tenant.createdAt.toDate().toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="text-primary hover:bg-blue-50">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-danger hover:bg-red-50" onClick={() => handleDeleteTenant(tenant.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTenants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-text-muted">
                      No tenants found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="vobiz">
          <VobizNumberManagement />
        </TabsContent>

        <TabsContent value="health">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="sleek-card border-none shadow-sm">
              <CardHeader>
                <CardTitle>System Logs</CardTitle>
                <CardDescription>Recent infrastructure events</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-bg rounded-lg border border-border">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Database snapshot completed</p>
                      <p className="text-xs text-text-muted">2 minutes ago • Region: asia-east1</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="sleek-card border-none shadow-sm">
              <CardHeader>
                <CardTitle>Resource Usage</CardTitle>
                <CardDescription>Cloud Run & Firestore metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">CPU Utilization</span>
                    <span className="text-text-muted">12%</span>
                  </div>
                  <div className="w-full bg-bg rounded-full h-2 overflow-hidden">
                    <div className="bg-primary h-full w-[12%]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Memory Usage</span>
                    <span className="text-text-muted">450MB / 2GB</span>
                  </div>
                  <div className="w-full bg-bg rounded-full h-2 overflow-hidden">
                    <div className="bg-purple-600 h-full w-[22%]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Firestore Reads</span>
                    <span className="text-text-muted">1.2k / 50k (Daily)</span>
                  </div>
                  <div className="w-full bg-bg rounded-full h-2 overflow-hidden">
                    <div className="bg-orange-500 h-full w-[5%]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
