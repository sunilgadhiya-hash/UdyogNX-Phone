import * as JsSIP from 'jssip';
import { VobizConfig } from '../types';

export class VobizService {
  private ua: any | null = null;
  private session: any | null = null;
  private remoteStream: MediaStream | null = null;
  public lastConfig: string = '';
  private domain: string = '';

  constructor(private config: VobizConfig) {}

  public connect() {
    if (this.ua) {
      // Remove all listeners to prevent 'disconnected' event from firing during manual stop
      this.ua.removeAllListeners();
      this.ua.stop();
      this.ua = null;
    }

    let rawUri = this.config.sipUri.trim();
    let host = rawUri;

    // 1. Remove protocol prefixes from host
    host = host.replace(/^wss?:\/\//, '');
    host = host.replace(/^sip:/, '');

    // 2. Extract domain from user@domain
    if (host.includes('@')) {
      host = host.split('@')[1];
    }
    
    // 3. Clean up any remaining slashes or paths
    host = host.split('/')[0];
    
    // 4. Construct the WebSocket URL
    // We always want a clean wss://domain WebSocket URL, specifically on port 7443 for Vobiz
    const wsUrl = `wss://${host}:7443`;

    // 5. Construct the SIP URI for registration
    const sipUri = `sip:${this.config.username}@${host}`;
    
    // Store the domain for calls
    this.domain = host;

    console.log('Vobiz Connection Details:', { wsUrl, sipUri });

    // @ts-ignore
    const socket = new JsSIP.WebSocketInterface(wsUrl);
    const configuration = {
      sockets: [socket],
      uri: sipUri,
      password: this.config.password,
    };

    this.ua = new JsSIP.UA(configuration);

    this.ua.on('connected', () => {
      console.log('Vobiz connected');
      this.onStatusChange?.('connected');
    });
    this.ua.on('disconnected', (data: any) => {
      console.log('Vobiz disconnected. Cause:', data.cause);
      this.onStatusChange?.('disconnected');
      
      if (data.cause === JsSIP.C.causes.CONNECTION_ERROR) {
        console.log('Vobiz connection error detected. Check your SIP Domain and network.');
      }
    });
    this.ua.on('registered', () => {
      console.log('Vobiz registered');
      this.onStatusChange?.('registered');
    });
    this.ua.on('unregistered', () => {
      console.log('Vobiz unregistered');
      this.onStatusChange?.('unregistered');
    });
    this.ua.on('registrationFailed', () => {
      console.log('Vobiz registration failed');
      this.onStatusChange?.('failed');
    });
    this.ua.on('newRTCSession', (data) => {
      this.session = data.session;
      
      this.session.on('peerconnection', (data) => {
        data.peerconnection.addEventListener('track', (event) => {
          this.remoteStream = event.streams[0];
          this.onStream?.(this.remoteStream);
        });
      });

      this.session.on('ended', () => {
        this.session = null;
        this.onCallEnded?.();
      });

      this.session.on('failed', () => {
        this.session = null;
        this.onCallEnded?.();
      });

      if (this.session.direction === 'incoming') {
        this.onIncomingCall?.(this.session);
      }
    });

    this.ua.start();
  }

  public call(target: string) {
    if (!this.ua || !this.domain) return;
    const options = {
      mediaConstraints: { audio: true, video: false },
      pcConfig: {
        iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }]
      }
    };
    this.ua.call(`sip:${target}@${this.domain}`, options);
  }

  public answer() {
    if (!this.session) return;
    this.session.answer({
      mediaConstraints: { audio: true, video: false }
    });
  }

  public hangup() {
    if (!this.session) return;
    this.session.terminate();
  }

  public transfer(target: string) {
    if (!this.session || !this.domain) return;
    this.session.refer(`sip:${target}@${this.domain}`);
  }

  public toggleMute(mute: boolean) {
    if (!this.session) return;
    if (mute) {
      this.session.mute();
    } else {
      this.session.unmute();
    }
  }

  public stop() {
    if (this.ua) {
      this.ua.removeAllListeners();
      this.ua.stop();
      this.ua = null;
    }
    this.session = null;
    this.remoteStream = null;
  }

  public onStream?: (stream: MediaStream) => void;
  public onIncomingCall?: (session: any) => void;
  public onCallEnded?: () => void;
  public onStatusChange?: (status: 'connected' | 'disconnected' | 'registered' | 'unregistered' | 'failed') => void;
}
