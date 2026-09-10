import React, { useState } from 'react';
import './AgentLogin.css';
import { agentSupabase } from '../shared/supabase';

export default function AgentLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const { data, error: authError } = await agentSupabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    const { data: profile, error: profileError } = await agentSupabase.from('profiles').select('role,status,allow_login').eq('id', data.user.id).maybeSingle();
    if (profileError || profile?.role !== 'agent') {
      await agentSupabase.auth.signOut();
      setError('This account does not have agent access.');
      setSubmitting(false);
      return;
    }

    if (profile.allow_login === false || profile.status?.toLowerCase() === 'suspended') {
      await agentSupabase.auth.signOut();
      setError('This agent account has been suspended. Please contact the administrator.');
      setSubmitting(false);
      return;
    }

    onLoginSuccess();
  };

  return (
    <main className="agent-login-page">
      <section className="agent-login-brand">
        <div className="agent-brand-mark">A</div>
        <span className="agent-brand-kicker">MARKETHUB NETWORK</span>
        <h1>Grow your seller network.</h1>
        <p>Support sellers, track performance, and manage your business from one secure agent workspace.</p>
        <div className="agent-brand-points">
          <article><b>01</b><span><strong>Seller management</strong>Keep your network organized in one place.</span></article>
          <article><b>02</b><span><strong>Performance insights</strong>Follow activity, earnings, and progress.</span></article>
          <article><b>03</b><span><strong>Connected support</strong>Stay connected with the admin team.</span></article>
        </div>
      </section>

      <section className="agent-login-area">
        <div className="agent-login-card">
          <div className="agent-mobile-mark">A</div>
          <span className="agent-login-eyebrow">AGENT PORTAL</span>
          <h2>Welcome back</h2>
          <p className="agent-login-intro">Enter your agent account details to continue.</p>

          <form onSubmit={handleSubmit}>
            {error && <p className="agent-login-error">{error}</p>}
            <label htmlFor="agent-email">EMAIL ADDRESS</label>
            <input id="agent-email" type="email" placeholder="agent@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />

            <label htmlFor="agent-password">PASSWORD</label>
            <div className="agent-password-field">
              <input id="agent-password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>

            <div className="agent-login-options">
              <label><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /> Remember me</label>
              <button type="button">Forgot password?</button>
            </div>

            <button className="agent-sign-in-btn" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in to Agent Portal'}<span>→</span></button>
          </form>

          <div className="agent-login-footer">
            <a href="/">Admin login</a><span>•</span><a href="/seller">Seller login</a>
          </div>
        </div>
      </section>
    </main>
  );
}
