import { AuthProvider, useAuth } from './components/AuthProvider';
import { VobizProvider } from './components/VobizProvider';
import { Toaster } from './components/ui/sonner';
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Phone from './components/Phone';
import CallLogs from './components/CallLogs';
import Contacts from './components/Contacts';
import Settings from './components/Settings';
import AdminDashboard from './components/AdminDashboard';
import { Button } from './components/ui/button';
import { Phone as PhoneIcon, LogIn } from 'lucide-react';

function AppContent() {
  const { user, profile, loading, signIn } = useAuth();
  const location = useLocation();
  
  // Map path to tab ID for Layout
  const getActiveTab = () => {
    const path = location.pathname.substring(1) || 'phone';
    return path;
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <PhoneIcon className="text-white w-8 h-8" />
          </div>
          <p className="text-slate-500 font-medium">UdyamNX-Phone Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-100">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3 shadow-lg">
            <PhoneIcon className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">UdyamNX-Phone</h1>
          <p className="text-slate-500 mb-8">Professional Multi-tenant VOIP Solution</p>
          <Button onClick={signIn} className="w-full h-12 text-lg gap-2 bg-blue-600 hover:bg-blue-700">
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </Button>
          <p className="mt-6 text-xs text-slate-400">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Layout activeTab={getActiveTab()}>
      <Routes>
        <Route path="/phone" element={<Phone />} />
        <Route path="/logs" element={<CallLogs />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/settings" element={<Settings />} />
        <Route 
          path="/admin" 
          element={profile?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/phone" />} 
        />
        <Route path="/" element={<Navigate to="/phone" />} />
        <Route path="*" element={<Navigate to="/phone" />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <VobizProvider>
          <AppContent />
          <Toaster position="top-right" />
        </VobizProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
