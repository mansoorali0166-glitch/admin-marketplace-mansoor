import React, { useState } from 'react';
import './SellerLogin.css';
import './SellerPortal.css';
import { sellerSupabase } from '../shared/supabase';

export default function SellerLogin({ onLoginSuccess }) {
  const [registering, setRegistering] = useState(window.location.pathname.toLowerCase().includes('/register'));
  const [verifying, setVerifying] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [invitationCode, setInvitationCode] = useState(() => new URLSearchParams(window.location.search).get('code') || '');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setSubmitting(true); setError(''); setNotice('');
    const { data, error: authError } = await sellerSupabase.auth.signInWithPassword({ email, password });
    if (authError) { setError(authError.message); setSubmitting(false); return; }
    const [{ data: profile }, { data: application }] = await Promise.all([
      sellerSupabase.from('profiles').select('role,allow_login,registration_status').eq('id', data.user.id).maybeSingle(),
      sellerSupabase.from('merchant_applications').select('status').eq('seller_id', data.user.id).maybeSingle(),
    ]);
    if (profile?.role !== 'seller') { await sellerSupabase.auth.signOut(); setError('This account does not have seller access.'); setSubmitting(false); return; }
    const approvalStatus = application?.status || profile?.registration_status;
    if (profile.allow_login === false || approvalStatus === 'Pending' || approvalStatus === 'Rejected') {
      await sellerSupabase.auth.signOut();
      setError(approvalStatus === 'Rejected' ? 'Your merchant registration was denied. Contact your agent for help.' : 'Your registration is awaiting agent approval.');
      setSubmitting(false);
      return;
    }
    if (profile?.registration_status === 'Approved' && !sessionStorage.getItem(`merchant-approved-${data.user.id}`)) {
      sessionStorage.setItem(`merchant-approved-${data.user.id}`, 'seen');
      window.alert('Your account is successfully registered.');
    }
    onLoginSuccess();
  };

  const openVerification = (event) => {
    event.preventDefault(); setError(''); setNotice('');
    if (password !== confirmPassword) { setError('Password and confirm password do not match.'); return; }
    setVerifying(true);
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setSubmitting(true); setError(''); setNotice('');
    const normalizedCode = invitationCode.trim().toUpperCase();
    const { data: validCode, error: verifyError } = await sellerSupabase.rpc('verify_agent_invitation_code', { invitation_code_input: normalizedCode });
    if (verifyError || !validCode) { setError(verifyError?.message || 'Invalid agent verification code.'); setSubmitting(false); return; }
    const { data, error: authError } = await sellerSupabase.auth.signUp({ email, password, options: { data: { display_name: storeName.trim(), role: 'seller', phone: phone.trim(), address: address.trim(), invitation_code: normalizedCode } } });
    if (authError) {
      setSubmitting(false);
      setError(authError.code === 'over_email_send_rate_limit'
        ? 'Registration is temporarily blocked by the Supabase email limit. The project owner must disable Confirm Email because agent approval verifies merchant accounts.'
        : authError.message);
      return;
    }
    if (!data.user || data.user.identities?.length === 0) {
      if (data.session) await sellerSupabase.auth.signOut();
      setSubmitting(false);
      setError('This email is already registered. Please log in or use another email address.');
      return;
    }
    const { error: applicationError } = await sellerSupabase.rpc('ensure_merchant_application', { seller_id_input: data.user.id, invitation_code_input: normalizedCode });
    if (data.session) await sellerSupabase.auth.signOut();
    setSubmitting(false);
    if (applicationError) { setError(applicationError.message); return; }
    setVerifying(false);
    setNotice('Application submitted successfully. Your agent must approve it before you can log in.');
  };

  const switchMode = (next) => {
    setRegistering(next); setVerifying(false); setError(''); setNotice(''); setPassword(''); setConfirmPassword('');
    window.history.replaceState({}, '', next ? '/seller/register' : '/seller');
  };

  return <main className="seller-login-page"><section className="seller-login-shell">
    <header><span /> <strong>{verifying ? 'Verification' : registering ? 'Registration' : 'Login'}</strong><button type="button" aria-label="Language">◎</button></header>
    <div className="seller-login-card">
      <div className="seller-login-heading"><span className="seller-mobile-mark">M</span><h1>MarketHub Online Shop</h1></div>
      {verifying ? <form className="seller-verification-form" onSubmit={handleRegister}>
        <h2>Enter verification code</h2><p>Ask your agent for their invitation code, then enter it below to submit your application.</p>
        <label htmlFor="seller-invitation-code">Verification Code</label><input id="seller-invitation-code" type="text" autoFocus placeholder="Enter agent code" value={invitationCode} onChange={(event) => setInvitationCode(event.target.value.toUpperCase())} required />
        {error && <p className="seller-login-error">{error}</p>}<button className="seller-sign-in-btn" type="submit" disabled={submitting}>{submitting ? 'Verifying…' : 'Verify & Submit Application'}</button>
        <button className="seller-register-btn seller-verification-back" type="button" onClick={() => { setVerifying(false); setError(''); }}>Back</button>
      </form> : <form onSubmit={registering ? openVerification : handleLogin}>
        {registering && <><label htmlFor="seller-store-name">Name</label><input id="seller-store-name" type="text" placeholder="Enter your name or store name" value={storeName} onChange={(event) => setStoreName(event.target.value)} required /><label htmlFor="seller-phone">Phone Number</label><input id="seller-phone" type="tel" placeholder="Enter your phone number" value={phone} onChange={(event) => setPhone(event.target.value)} required /><label htmlFor="seller-address">Address</label><input id="seller-address" type="text" placeholder="Enter your address" value={address} onChange={(event) => setAddress(event.target.value)} required /></>}
        <label htmlFor="seller-email">Email Address</label><input id="seller-email" type="email" placeholder="Enter your email address" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label htmlFor="seller-password">Password</label><div className="seller-password-input"><input id="seller-password" type={showPassword ? 'text' : 'password'} minLength="6" placeholder="Create your password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? '◉' : '◎'}</button></div>
        {registering && <><label htmlFor="seller-confirm-password">Confirm Password</label><div className="seller-password-input"><input id="seller-confirm-password" type={showConfirmPassword ? 'text' : 'password'} minLength="6" placeholder="Enter your password again" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /><button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}>{showConfirmPassword ? '◉' : '◎'}</button></div></>}
        {error && <p className="seller-login-error">{error}</p>}{notice && <p className="seller-login-notice">{notice}</p>}
        <button className="seller-sign-in-btn" type="submit" disabled={submitting}>{submitting ? 'Please wait…' : registering ? 'Register' : 'Login'}</button>
      </form>}
      {!verifying && <><div className="seller-login-divider"><span>or</span></div><button className="seller-register-btn" type="button" onClick={() => switchMode(!registering)}>{registering ? 'Back to Login' : 'Register Now'}</button></>}
    </div>
  </section></main>;
}
