import React, { useEffect, useState } from 'react';
import AdminLogin from './admin/AdminLogin';
import AdminLayout from './admin/AdminLayout';
import SellerLogin from './seller/SellerLogin';
import SellerPortal from './seller/SellerPortal';
import AgentLogin from './agent/AgentLogin';
import AgentPortal from './agent/AgentPortal';
import { adminSupabase, agentSupabase, sellerSupabase } from './shared/supabase';

export default function App() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isSellerLoggedIn, setIsSellerLoggedIn] = useState(false);
  const [isAgentLoggedIn, setIsAgentLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [previewMerchant, setPreviewMerchant] = useState(null);
  const currentPath = window.location.pathname.toLowerCase();
  const isSellerPortal = currentPath === '/seller' || currentPath.startsWith('/seller/');
  const isAgentPortal = currentPath === '/agent' || currentPath.startsWith('/agent/');

  useEffect(() => {
    const previewParam = isSellerPortal && new URLSearchParams(window.location.search).get('previewMerchant');
    if (previewParam) {
      try { setPreviewMerchant(JSON.parse(atob(decodeURIComponent(previewParam)))); } catch { setPreviewMerchant(null); }
      setAuthLoading(false);
      return;
    }
    const client = isSellerPortal ? sellerSupabase : isAgentPortal ? agentSupabase : adminSupabase;
    client.auth.getSession().then(async ({ data }) => {
      if (isSellerPortal) setIsSellerLoggedIn(Boolean(data.session));
      else if (isAgentPortal && data.session) {
        const { data: profile } = await agentSupabase.from('profiles').select('role,status,allow_login').eq('id', data.session.user.id).maybeSingle();
        const canAccess = profile?.role === 'agent' && profile.allow_login !== false && profile.status?.toLowerCase() !== 'suspended';
        if (!canAccess) await agentSupabase.auth.signOut();
        setIsAgentLoggedIn(canAccess);
      }
      else setIsAdminLoggedIn(Boolean(data.session));
      setAuthLoading(false);
    });
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (isSellerPortal) setIsSellerLoggedIn(Boolean(session));
      else if (isAgentPortal && event === 'SIGNED_OUT') setIsAgentLoggedIn(false);
      else setIsAdminLoggedIn(Boolean(session));
    });
    return () => listener.subscription.unsubscribe();
  }, [isAgentPortal, isSellerPortal]);

  const handleAdminLoginSuccess = () => {
    setIsAdminLoggedIn(true);
  };

  const handleLogout = async () => {
    await adminSupabase.auth.signOut();
    setIsAdminLoggedIn(false);
  };

  const demoBadge = <div className="global-demo-badge">DEMO ENVIRONMENT</div>;

  if (authLoading) return <><div style={{minHeight:'100vh',display:'grid',placeItems:'center',fontFamily:'Segoe UI'}}>Loading…</div>{demoBadge}</>;

  if (isSellerPortal) {
    return <>{(isSellerLoggedIn || previewMerchant)
      ? <SellerPortal previewMerchant={previewMerchant} onLogout={async () => { if (previewMerchant) { window.location.assign('/agent'); return; } await sellerSupabase.auth.signOut(); setIsSellerLoggedIn(false); }} />
      : <SellerLogin onLoginSuccess={() => setIsSellerLoggedIn(true)} />}{demoBadge}</>;
  }

  if (isAgentPortal) {
    return <>{isAgentLoggedIn
      ? <AgentPortal onLogout={async () => { await agentSupabase.auth.signOut(); setIsAgentLoggedIn(false); }} />
      : <AgentLogin onLoginSuccess={() => setIsAgentLoggedIn(true)} />}{demoBadge}</>;
  }

  return (
    <>
      {!isAdminLoggedIn ? (
        <AdminLogin onLoginSuccess={handleAdminLoginSuccess} />
      ) : (
        <AdminLayout onLogout={handleLogout} />
      )}
      {demoBadge}
    </>
  );
}
