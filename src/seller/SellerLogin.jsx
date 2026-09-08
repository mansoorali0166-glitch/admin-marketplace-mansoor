import React, { useState } from 'react';
import './SellerLogin.css';
import './SellerPortal.css';
import { sellerSupabase } from '../shared/supabase';

export default function SellerLogin({ onLoginSuccess }) {
  const [registering, setRegistering] = useState(window.location.pathname.toLowerCase().includes('/register'));
  const [storeName, setStoreName] = useState('');
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
    const { data: profile } = await sellerSupabase.from('profiles').select('role,allow_login').eq('id', data.user.id).single();
    if (!['seller', 'agent'].includes(profile?.role)) { await sellerSupabase.auth.signOut(); setError('This account does not have seller access.'); setSubmitting(false); return; }
    if (profile?.allow_login === false) { await sellerSupabase.auth.signOut(); setError('This account has been locked. Contact your administrator.'); setSubmitting(false); return; }
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
    setSubmitting(false);
    if (authError) { setError(authError.message); return; }
    if (data.session) { onLoginSuccess(); return; }
    setNotice('Registration successful. Check your email to confirm your account, then log in.');
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
            {registering && <><label htmlFor="seller-store-name">Store Name</label><input id="seller-store-name" type="text" placeholder="Enter your store name" value={storeName} onChange={(event) => setStoreName(event.target.value)} required /></>}
            <label htmlFor="seller-email">Email Address</label>
            <input id="seller-email" type="email" placeholder="Enter your email address" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <label htmlFor="seller-password">Password</label>
            <input id="seller-password" type="password" minLength="6" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required />
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
