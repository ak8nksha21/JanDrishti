import React, { useState, useEffect, useCallback } from 'react';
import { RouterProvider, useRouter } from './router/Router';
import TopNavbar from './components/layout/TopNavbar';
import Footer from './components/layout/Footer';
import GlobalSearchModal from './components/layout/GlobalSearchModal';
import SyncModal from './components/layout/SyncModal';
import AuthModal from './components/auth/AuthModal';
import { AuthProvider } from './context/AuthContext';

// Pages
import Dashboard from './pages/Dashboard';
import Works from './pages/Works';
import WorkDetails from './pages/WorkDetails';
import MPs from './pages/MPs';
import MPDetails from './pages/MPDetails';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import Signup from './pages/Signup';

import { checkHealth } from './services/status';

function AppContent() {
  const { path, navigate } = useRouter();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const [apiStatus, setApiStatus] = useState({ isOnline: true, latencyMs: 18 });
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Health probe on load
  const probeHealth = useCallback(async () => {
    try {
      const res = await checkHealth();
      setApiStatus(res);
    } catch (e) {
      setApiStatus({ isOnline: false, latencyMs: 0 });
    }
  }, []);

  useEffect(() => {
    probeHealth();
    const interval = setInterval(probeHealth, 30000); // 30s probe
    return () => clearInterval(interval);
  }, [probeHealth]);

  // Global keyboard listener for search (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSyncComplete = (result) => {
    setLastSyncTime(new Date().toISOString());
    showToast('MPLADS data feeds successfully synchronized with PostgreSQL records!');
    probeHealth();
  };

  // Route View Resolver
  const renderCurrentView = () => {
    if (path === '/') {
      return <Dashboard onOpenSync={() => setIsSyncOpen(true)} />;
    }
    if (path === '/works' || path === '/works-list') {
      return <Works />;
    }
    if (path.startsWith('/works/')) {
      const workId = path.split('/')[2];
      return <WorkDetails workId={workId} />;
    }
    if (path === '/mps' || path === '/mps-list') {
      return <MPs />;
    }
    if (path.startsWith('/mps/')) {
      const mpId = path.split('/')[2];
      return <MPDetails mpId={mpId} />;
    }
    if (path === '/analytics') {
      return <Analytics />;
    }
    if (path === '/login') {
      return <Login />;
    }
    if (path === '/signup') {
      return <Signup />;
    }

    // 404 Fallback
    return (
      <div className="py-24 text-center space-y-4 max-w-lg mx-auto">
        <h2 className="text-3xl font-black text-[#44312A] font-display">404 — Page Not Found</h2>
        <p className="text-sm text-[#504F47]">
          The requested intelligence route <code className="text-[#44312A] bg-white px-1.5 py-0.5 rounded border border-[#D8CBB6] font-mono">{path}</code> does not exist in the platform.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-white font-bold text-xs shadow-md shadow-[#44312A]/20 transition cursor-pointer"
        >
          Return to Overview
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#E7DDCA] text-[#44312A] flex flex-col antialiased selection:bg-[#44312A] selection:text-[#E7DDCA]">
      {/* 1. Top Navbar (Full Width Across Top of Screen) */}
      <TopNavbar
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenSync={() => setIsSyncOpen(true)}
        onOpenAuth={(mode) => {
          setAuthMode(mode || 'login');
          setIsAuthOpen(true);
        }}
        isSyncing={isSyncing}
        apiStatus={apiStatus}
        lastSyncTime={lastSyncTime}
      />

      {/* 2. Main Full-Width Content Container */}
      <div className="flex flex-col flex-1 min-h-screen w-full">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderCurrentView()}
        </main>

        {/* Global Footer */}
        <Footer />
      </div>

      {/* Modals */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      <SyncModal
        isOpen={isSyncOpen}
        onClose={() => setIsSyncOpen(false)}
        onSyncComplete={handleSyncComplete}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialMode={authMode}
        onSuccess={(msg) => showToast(msg)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-[#44312A] border border-[#504F47] shadow-2xl text-xs font-semibold text-[#E7DDCA] flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-300">
          <span className="h-2 w-2 rounded-full bg-[#E7DDCA] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </RouterProvider>
  );
}
