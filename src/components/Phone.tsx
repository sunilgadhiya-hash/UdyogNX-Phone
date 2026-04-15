import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthProvider';
import { useVobiz } from './VobizProvider';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { VobizService } from '../services/vobizService';
import { Tenant, VobizConfig } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  ArrowRightLeft, 
  Grid3X3,
  UserPlus,
  Volume2,
  VolumeX
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const PhoneComponent: React.FC = () => {
  const { profile } = useAuth();
  const { service: vobiz, status: vobizStatus } = useVobiz();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState('Idle');
  const [activeSession, setActiveSession] = useState<any>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!vobiz) return;

    vobiz.onStream = (stream) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play();
      }
    };

    vobiz.onIncomingCall = (session) => {
      setActiveSession(session);
      setCallStatus('Incoming Call...');
      toast.info(`Incoming call from ${session.remote_identity.uri.user}`, {
        action: {
          label: 'Answer',
          onClick: () => vobiz.answer()
        }
      });
    };

    vobiz.onCallEnded = () => {
      setIsCalling(false);
      setCallStatus('Idle');
      setActiveSession(null);
      toast.success('Call ended');
    };

    // No need to call connect() here as it's handled by VobizProvider
  }, [vobiz]);

  const handleCall = async () => {
    if (!vobiz || !phoneNumber) return;
    
    try {
      vobiz.call(phoneNumber);
      setIsCalling(true);
      setCallStatus('Calling...');
      
      // Log call attempt
      await addDoc(collection(db, 'calls'), {
        tenantId: profile?.tenantId,
        agentId: profile?.uid,
        from: profile?.email,
        to: phoneNumber,
        startTime: serverTimestamp(),
        status: 'active'
      });
    } catch (error) {
      toast.error('Failed to initiate call');
      setIsCalling(false);
    }
  };

  const handleHangup = () => {
    vobiz?.hangup();
    setIsCalling(false);
    setCallStatus('Idle');
  };

  const handleTransfer = () => {
    const target = prompt('Enter number to transfer to:');
    if (target) {
      vobiz?.transfer(target);
      toast.success(`Transferring to ${target}`);
    }
  };

  const appendDigit = (digit: string) => {
    setPhoneNumber(prev => prev + digit);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)]">
      <audio ref={remoteAudioRef} className="hidden" />
      
      <div className="sleek-card w-full max-w-sm p-8 text-center">
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={cn(
              "w-2.5 h-2.5 rounded-full animate-pulse",
              vobizStatus === 'registered' ? "bg-success" : 
              vobizStatus === 'connecting' ? "bg-orange-400" : "bg-danger"
            )} />
            <span className="text-[0.7rem] font-bold text-text-muted uppercase tracking-widest">
              Vobiz: {vobizStatus}
            </span>
          </div>
          <p className={cn(
            "text-[0.8rem] font-bold uppercase tracking-widest mb-2",
            isCalling ? "text-success" : "text-text-muted"
          )}>
            {isCalling ? 'CONNECTED' : 'READY TO DIAL'}
          </p>
          <h3 className="text-xl font-bold text-text-main">
            {isCalling ? phoneNumber : 'New Call'}
          </h3>
          <p className="text-text-muted text-sm mt-1">
            {isCalling ? 'Active Session' : 'Enter number below'}
          </p>
        </div>

        <div className="mb-8">
          <div className="text-4xl font-light text-primary tracking-tight mb-4 tabular-nums">
            {isCalling ? '04:12' : '00:00'}
          </div>
          <Input 
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Dial Number"
            className="text-center text-2xl font-semibold h-14 border-border bg-bg focus-visible:ring-primary/20 rounded-xl"
          />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
            <button
              key={digit}
              onClick={() => appendDigit(digit)}
              className="w-14 h-14 rounded-full bg-surface hover:bg-bg text-xl font-semibold text-text-main transition-all active:scale-95 flex items-center justify-center mx-auto border border-border shadow-sm"
            >
              {digit}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {!isCalling ? (
            <Button 
              onClick={handleCall}
              className="col-span-3 h-14 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-lg shadow-lg shadow-primary/20"
            >
              <Phone className="w-6 h-6 mr-2" />
              Start Call
            </Button>
          ) : (
            <>
              <button 
                onClick={() => {
                  setIsMuted(!isMuted);
                  vobiz?.toggleMute(!isMuted);
                }}
                className={cn(
                  "w-14 h-14 rounded-full border border-border flex items-center justify-center transition-colors mx-auto",
                  isMuted ? "bg-danger text-white border-transparent" : "bg-surface text-text-main hover:bg-bg"
                )}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              
              <button 
                onClick={handleTransfer}
                className="w-14 h-14 rounded-full border border-border bg-surface text-text-main hover:bg-bg flex items-center justify-center transition-colors mx-auto"
              >
                <ArrowRightLeft className="w-5 h-5" />
              </button>

              <button 
                className="w-14 h-14 rounded-full border border-border bg-surface text-text-main hover:bg-bg flex items-center justify-center transition-colors mx-auto"
              >
                <Grid3X3 className="w-5 h-5" />
              </button>
              
              <button 
                onClick={handleHangup}
                className="col-span-3 h-14 rounded-xl bg-danger hover:bg-red-600 text-white font-bold text-lg shadow-lg shadow-danger/20 transition-all active:scale-[0.98]"
              >
                End Call
              </button>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 w-full max-w-sm">
        <div className="bg-surface rounded-2xl p-4 border border-border shadow-sm">
          <p className="text-[0.75rem] font-bold text-text-muted uppercase tracking-wider mb-3">Quick Actions</p>
          <Button className="w-full h-11 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg shadow-sm">
            Retrieve Live Calls
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PhoneComponent;
