import React, { useState } from 'react';
import './AdminLogin.css';
import { adminRecoverySupabase, adminSupabase } from '../shared/supabase';

export default function AdminLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState('request');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation rule
    if (!email || !password) {
      alert("Please fill in all fields.");
      return;
    }

    setSubmitting(true); setError('');
    const { data, error: authError } = await adminSupabase.auth.signInWithPassword({ email, password });
    if (authError) { setError(authError.message); setSubmitting(false); return; }
    const { data: profile } = await adminSupabase.from('profiles').select('role').eq('id', data.user.id).single();
    if (profile?.role?.toLowerCase() !== 'admin') { await adminSupabase.auth.signOut(); setError('This account does not have administrator access.'); setSubmitting(false); return; }
    onLoginSuccess();
  };

  const sendRecoveryCode = async (event) => {
    event.preventDefault();
    setSubmitting(true); setError(''); setNotice('');
    const { error: recoveryError } = await adminRecoverySupabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    setSubmitting(false);
    if (recoveryError) return setError(recoveryError.message);
    setRecoveryStep('verify');
    setNotice('If this is an administrator email, a recovery code has been sent.');
  };

  const resetWithOtp = async (event) => {
    event.preventDefault();
    setSubmitting(true); setError(''); setNotice('');
    if (newPassword.length < 6) { setSubmitting(false); return setError('New password must be at least 6 characters.'); }
    if (newPassword !== confirmPassword) { setSubmitting(false); return setError('New passwords do not match.'); }
    const { data: verification, error: verificationError } = await adminRecoverySupabase.auth.verifyOtp({ email, token: otp.trim(), type: 'recovery' });
    if (verificationError || !verification.user) { setSubmitting(false); return setError(verificationError?.message || 'That recovery code is invalid or has expired.'); }
    const { data: profile, error: profileError } = await adminRecoverySupabase.from('profiles').select('role').eq('id', verification.user.id).maybeSingle();
    if (profileError || profile?.role?.toLowerCase() !== 'admin') { await adminRecoverySupabase.auth.signOut(); setSubmitting(false); return setError('This recovery code is not for an administrator account.'); }
    const { error: updateError } = await adminRecoverySupabase.auth.updateUser({ password: newPassword });
    await adminRecoverySupabase.auth.signOut();
    setSubmitting(false);
    if (updateError) return setError(updateError.message);
    setPassword(''); setOtp(''); setNewPassword(''); setConfirmPassword(''); setRecoveryOpen(false); setRecoveryStep('request');
    setNotice('Password reset. You can now sign in with your new password.');
  };

  const closeRecovery = () => { setRecoveryOpen(false); setRecoveryStep('request'); setOtp(''); setNewPassword(''); setConfirmPassword(''); setError(''); setNotice(''); };

  return (
    <div className="admin-portal-container">
      {/* Top Header Section */}
      <div className="portal-header">
        <div className="shield-icon">
          <svg xmlns="http://w3.org" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M12 1.5a.75.75 0 0 1 .75.75V4.5a.75.75 0 0 1-1.5 0V2.25A.75.75 0 0 1 12 1.5ZM12 4.5a7.5 7.5 0 0 0-7.5 7.5c0 4.914 4.305 8.557 7.042 10.15a.75.75 0 0 0 .916 0C15.195 20.557 19.5 16.914 19.5 12a7.5 7.5 0 0 0-7.5-7.5Zm0 1.5a6 6 0 0 0-6 6c0 3.614 3.011 6.584 5.562 8.125a.75.75 0 0 0 .876 0C14.989 18.584 18 15.614 18 12a6 6 0 0 0-6-6Zm0 2.25a.75.75 0 0 1 .75.75v3.25h3.25a.75.75 0 0 1 0 1.5h-4a.75.75 0 0 1-.75-.75v-4a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
          </svg>
        </div>
        <h1>MarketHub Admin Portal</h1>
        <p className="subtitle">Demo environment · Authorized testers only</p>
      </div>

      {/* Main Login Card */}
      <div className="login-card">
        <h2>{recoveryOpen ? 'Reset administrator password' : 'Sign in to your account'}</h2>
        
        {!recoveryOpen ? <form onSubmit={handleSubmit}>
          {error && <p style={{color:'#dc2626',fontSize:13}}>{error}</p>}
          {notice && <p className="login-notice">{notice}</p>}
          {/* Email Input */}
          <div className="input-group">
            <label htmlFor="email">EMAIL ADDRESS</label>
            <input 
              type="email" 
              id="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password Input */}
          <div className="input-group">
            <label htmlFor="password">PASSWORD</label>
            <div className="password-wrapper">
              <input 
                type={showPassword ? "text" : "password"} 
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button 
                type="button" 
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="remember-me-group">
            <input 
              type="checkbox" 
              id="remember" 
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label htmlFor="remember">Remember me</label>
          </div>

          {/* Sign In Button */}
          <button type="submit" className="submit-btn" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
          <button className="forgot-password" type="button" onClick={() => { setError(''); setNotice(''); setRecoveryOpen(true); }}>Forgot password?</button>
        </form> : recoveryStep === 'request' ? <form onSubmit={sendRecoveryCode}>
          {error && <p style={{color:'#dc2626',fontSize:13}}>{error}</p>}
          <p className="recovery-help">Enter the email address for your administrator account. We will send a one-time recovery code.</p>
          <div className="input-group"><label htmlFor="recovery-email">ADMIN EMAIL ADDRESS</label><input type="email" id="recovery-email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" required /></div>
          <button type="submit" className="submit-btn" disabled={submitting}>{submitting ? 'Sending…' : 'Send recovery code'}</button>
          <button className="forgot-password" type="button" onClick={closeRecovery}>Back to sign in</button>
        </form> : <form onSubmit={resetWithOtp}>
          {error && <p style={{color:'#dc2626',fontSize:13}}>{error}</p>}
          {notice && <p className="login-notice">{notice}</p>}
          <p className="recovery-help">Enter the one-time code emailed to <strong>{email}</strong>, then choose a new password.</p>
          <div className="input-group"><label htmlFor="recovery-otp">RECOVERY CODE</label><input type="text" inputMode="numeric" autoComplete="one-time-code" id="recovery-otp" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\s/g, ''))} placeholder="Enter code" required /></div>
          <div className="input-group"><label htmlFor="new-admin-password">NEW PASSWORD</label><input type="password" minLength="6" id="new-admin-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 6 characters" required /></div>
          <div className="input-group"><label htmlFor="confirm-admin-password">CONFIRM NEW PASSWORD</label><input type="password" minLength="6" id="confirm-admin-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter it again" required /></div>
          <button type="submit" className="submit-btn" disabled={submitting}>{submitting ? 'Resetting…' : 'Reset password'}</button>
          <button className="forgot-password" type="button" disabled={submitting} onClick={sendRecoveryCode}>Resend code</button>
          <button className="forgot-password" type="button" disabled={submitting} onClick={closeRecovery}>Back to sign in</button>
        </form>}
      </div>

      {/* Footer Helper Links */}
      {!recoveryOpen && <div className="portal-footer">
        <span>Not an admin? </span>
        <a href="#agent">Agent login</a>
        <span className="dot-separator">·</span>
        <a href="/seller">Seller login</a>
      </div>}
    </div>
  );
}
