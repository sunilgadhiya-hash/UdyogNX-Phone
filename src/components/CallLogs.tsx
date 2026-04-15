import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { CallLog } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Play, Download, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from './ui/button';

const CallLogs: React.FC = () => {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.tenantId) return;

    const q = query(
      collection(db, 'calls'),
      where('tenantId', '==', profile.tenantId),
      orderBy('startTime', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const callLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CallLog[];
      setLogs(callLogs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'calls');
    });

    return () => unsubscribe();
  }, [profile]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100">Completed</Badge>;
      case 'missed': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-100">Missed</Badge>;
      case 'failed': return <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-100">Failed</Badge>;
      case 'active': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 animate-pulse">Active</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text-main tracking-tight">Call History</h1>
          <p className="text-text-muted mt-1">Review and manage your recent communications</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-lg border-border hover:bg-bg gap-2 font-semibold">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="sleek-card overflow-hidden">
        <Table>
          <TableHeader className="bg-bg">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-[0.75rem] font-bold text-text-muted uppercase tracking-wider py-4 pl-6">Type</TableHead>
              <TableHead className="text-[0.75rem] font-bold text-text-muted uppercase tracking-wider py-4">From / To</TableHead>
              <TableHead className="text-[0.75rem] font-bold text-text-muted uppercase tracking-wider py-4">Date & Time</TableHead>
              <TableHead className="text-[0.75rem] font-bold text-text-muted uppercase tracking-wider py-4">Duration</TableHead>
              <TableHead className="text-[0.75rem] font-bold text-text-muted uppercase tracking-wider py-4">Status</TableHead>
              <TableHead className="text-[0.75rem] font-bold text-text-muted uppercase tracking-wider py-4 text-right pr-6">Recording</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-text-muted">Loading call logs...</TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-text-muted">No call history found.</TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} className="border-border hover:bg-bg/50 transition-colors">
                  <TableCell className="pl-6">
                    {log.from === profile?.email ? (
                      <div className="p-2 bg-blue-50 text-primary rounded-lg w-fit">
                        <PhoneOutgoing className="w-4 h-4" />
                      </div>
                    ) : log.status === 'missed' ? (
                      <div className="p-2 bg-red-50 text-danger rounded-lg w-fit">
                        <PhoneMissed className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="p-2 bg-green-50 text-success rounded-lg w-fit">
                        <PhoneIncoming className="w-4 h-4" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-bold text-text-main">{log.to}</div>
                    <div className="text-xs text-text-muted">via {log.agentId === profile?.uid ? 'You' : 'Agent'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-text-main">
                      {log.startTime ? format(log.startTime.toDate(), 'MMM d, yyyy') : 'N/A'}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {log.startTime ? format(log.startTime.toDate(), 'h:mm a') : 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-text-main font-mono">
                    {log.duration ? `${Math.floor(log.duration / 60)}m ${log.duration % 60}s` : '--'}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(log.status)}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    {log.recordingUrl ? (
                      <Button variant="ghost" size="sm" className="text-primary hover:bg-blue-50 h-8 px-3 rounded-lg font-semibold">
                        <Play className="w-3.5 h-3.5 mr-2" />
                        Listen
                      </Button>
                    ) : (
                      <span className="text-xs text-text-muted italic">No recording</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CallLogs;
