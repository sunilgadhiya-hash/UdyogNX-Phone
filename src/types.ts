export type UserRole = 'admin' | 'tenant' | 'agent';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  displayName?: string;
  photoURL?: string;
  createdAt: any;
}

export interface VobizConfig {
  id: string;
  authId: string;
  authSecret: string;
  username: string;
  password: string;
  sipUri: string;
  did: string;
  assignedToTenantId?: string | null;
}

export interface TenantSettings {
  callRecordingEnabled: boolean;
  callWaitingEnabled?: boolean;
}

export interface GoogleConnection {
  refreshToken: string;
  email: string;
  connectedAt: any;
}

export interface Tenant {
  id: string;
  name: string;
  vobizConfig?: VobizConfig; // Keep for legacy or direct access
  vobizNumberId?: string; // Reference to the assigned VOBIZ number
  settings?: TenantSettings;
  googleConnection?: GoogleConnection;
  createdAt: any;
}

export interface CallLog {
  id: string;
  tenantId: string;
  agentId: string;
  from: string;
  to: string;
  startTime: any;
  endTime?: any;
  duration?: number;
  recordingUrl?: string;
  status: 'completed' | 'missed' | 'failed' | 'active';
}

export interface Contact {
  id: string;
  tenantId: string;
  agentId?: string;
  name: string;
  phone: string;
  email?: string;
  googleId?: string;
}
