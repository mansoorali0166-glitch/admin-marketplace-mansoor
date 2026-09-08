import React, { useState } from 'react';
import './SellerLogin.css';
import './SellerPortal.css';
import { sellerSupabase } from '../shared/supabase';

export default function SellerLogin({ onLoginSuccess }) {
  const [registering, setRegistering] = useState(window.location.pathname.toLowerCase().includes('/register'));
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [invitationCode, setInvitationCode] = useState(() => new URLSearchParams(window.location.search).get('code') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setSubmitting(true); setError(''); setNotice('');
    const { data, error: authError } = await sellerSupabase.auth.signInWithPassword({ email, password });
    if (authError) { setError(authError.message); setSubmitting(false); return; }
    const { data: profile } = await sellerSupabase.from('profiles').select('role,allow_login,registration_status').eq('id', data.user.id).single();
    if (!['seller', 'agent'].includes(profile?.role)) { await sellerSupabase.auth.signOut(); setError('This account does not have seller access.'); setSubmitting(false); return; }
    if (profile?.allow_login === false) { await sellerSupabase.auth.signOut(); setError(profile?.registration_status === 'Rejected' ? 'Your merchant registration was denied. Contact your agent for help.' : 'Your registration is awaiting agent approval or this account is locked.'); setSubmitting(false); return; }
    if (profile?.registration_status === 'Approved' && !sessionStorage.getItem(`merchant-approved-${data.user.id}`)) {
      sessionStorage.setItem(`merchant-approved-${data.user.id}`, 'seen');
      window.alert('Your account is successfully registered.');
    }
    onLoginSuccess();
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setSubmitting(true); setError(''); setNotice('');
    const { data, error: authError } = await sellerSupabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: storeName.trim(), role: 'seller' } },
    });
    if (authError) { setError(authError.message); setSubmitting(false); return; }
    if (!data.session) { setSubmitting(false); setNotice('Check your email to confirm the account, then return to complete registration.'); return; }
    const { error: applicationError } = await sellerSupabase.rpc('submit_merchant_application', { invitation_code_input: invitationCode.trim().toUpperCase(), address_input: address.trim() });
    await sellerSupabase.auth.signOut();
    setSubmitting(false);
    if (applicationError) { setError(applicationError.message); return; }
    setNotice('Application submitted successfully. Your agent must approve it before you can log in.');
  };

  const switchMode = (next) => {
    setRegistering(next); setError(''); setNotice(''); setPassword('');
    window.history.replaceState({}, '', next ? '/seller/register' : '/seller');
  };

  return (
    <main className="seller-login-page">
      <section className="seller-login-shell">
        <header><span /> <strong>{registering ? 'Registration' : 'Login'}</strong><button type="button" aria-label="Language">◎</button></header>
        <div className="seller-login-card">
          <div className="seller-login-heading">
            <span className="seller-mobile-mark">M</span>
            <h1>MarketHub Online Shop</h1>
          </div>
          <form onSubmit={registering ? handleRegister : handleLogin}>
            {registering && <><label htmlFor="seller-store-name">Name</label><input id="seller-store-name" type="text" placeholder="Enter your name or store name" value={storeName} onChange={(event) => setStoreName(event.target.value)} required /><label htmlFor="seller-address">Address</label><input id="seller-address" type="text" placeholder="Enter your address" value={address} onChange={(event) => setAddress(event.target.value)} required /></>}
            <label htmlFor="seller-email">Email Address</label>
            <input id="seller-email" type="email" placeholder="Enter your email address" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <label htmlFor="seller-password">Password</label>
            <input id="seller-password" type="password" minLength="6" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            {registering && <><label htmlFor="seller-invitation-code">Agent Invitation Code</label><input id="seller-invitation-code" type="text" placeholder="Enter the code supplied by your agent" value={invitationCode} onChange={(event) => setInvitationCode(event.target.value.toUpperCase())} required /></>}
            {error && <p className="seller-login-error">{error}</p>}
            {notice && <p className="seller-login-notice">{notice}</p>}
            <button className="seller-sign-in-btn" type="submit" disabled={submitting}>{submitting ? 'Please wait…' : registering ? 'Register' : 'Login'}</button>
          </form>
          <div className="seller-login-divider"><span>or</span></div>
          <button className="seller-register-btn" type="button" onClick={() => switchMode(!registering)}>{registering ? 'Back to Login' : 'Register Now'}</button>
        </div>
      </section>
    </main>
  );
}
