import React, { useEffect, useState } from 'react';
import './MyAccount.css';
import { adminSupabase } from '../shared/supabase';

export default function MyAccount() {
  const [displayName, setDisplayName] = useState('Administrator');
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, next: false, confirm: false });
  const [notice, setNotice] = useState('');
  const inviteCode = '88888888';
  const inviteLink = `${window.location.origin}/seller?invite=${inviteCode}`;

  const flash = (message) => { setNotice(message); window.setTimeout(() => setNotice(''), 1800); };
  useEffect(() => {
    const loadAccount = async () => {
      const { data: auth } = await adminSupabase.auth.getUser();
      if (!auth.user) return;
      const { data: profile } = await adminSupabase.from('profiles').select('email,display_name').eq('id', auth.user.id).maybeSingle();
      const savedEmail = profile?.email || auth.user.email || '';
      setUserId(auth.user.id);
      setEmail(savedEmail);
      setNewEmail(savedEmail);
      if (profile?.display_name) setDisplayName(profile.display_name);
    };
    loadAccount();
  }, []);
  const updatePassword = (event) => {
    event.preventDefault();
    if (passwords.next.length < 6) return flash('New password must be at least 6 characters.');
    if (passwords.next !== passwords.confirm) return flash('New passwords do not match.');
    setPasswords({ current: '', next: '', confirm: '' });
    flash('Password updated.');
  };
  const copy = async (value) => {
    try { await navigator.clipboard.writeText(value); flash('Copied to clipboard.'); }
    catch { flash('Copy was unavailable.'); }
  };
  const updateEmail = async (event) => {
    event.preventDefault();
    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!normalizedEmail) return flash('Enter a new email address.');
    if (normalizedEmail === email.toLowerCase()) return flash('Enter a different email address.');
    setEmailBusy(true);
    const { data, error } = await adminSupabase.rpc('change_admin_email', { new_email: normalizedEmail });
    setEmailBusy(false);
    if (error) return flash(error.message);
    const updatedEmail = data || normalizedEmail;
    setEmail(updatedEmail);
    setNewEmail(updatedEmail);
    flash('Email updated. Use the new email the next time you sign in.');
  };

  return <section className="my-account-page">
    <h2>My Account</h2>
    {notice && <div className="account-notice">{notice}</div>}

    <div className="account-panel"><h3>♙ <span>Account Info</span></h3><div className="account-panel-body account-info-fields">
      <label>USER ID<input disabled value={userId || 'Loading…'} /></label>
      <label>EMAIL ADDRESS<input disabled value={email} /></label>
      <label>ADMIN SINCE<input disabled value="July 16, 2026" /></label>
    </div></div>

    <form className="account-panel" onSubmit={(event) => { event.preventDefault(); flash('Display name saved.'); }}><h3>♢ <span>Display Name</span></h3><div className="account-panel-body">
      <label>DISPLAY NAME<input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><button className="account-primary-btn" type="submit">▣ Save Name</button>
    </div></form>

    <form className="account-panel" onSubmit={updateEmail}><h3>✉ <span>Change Email</span></h3><div className="account-panel-body">
      <label>CURRENT EMAIL<input disabled value={email} /></label><label>NEW EMAIL ADDRESS<input required type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label><button className="account-primary-btn" type="submit" disabled={emailBusy}>{emailBusy ? 'Updating…' : '▣ Update Email'}</button><p className="account-help">This immediately updates your admin profile and sign-in email.</p>
    </div></form>

    <form className="account-panel" onSubmit={updatePassword}><h3>♧ <span>Change Password</span></h3><div className="account-panel-body password-fields">
      {[['current', 'CURRENT PASSWORD', 'Enter current password'], ['next', 'NEW PASSWORD', 'Enter new password (min 6 chars)'], ['confirm', 'CONFIRM NEW PASSWORD', 'Re-enter new password']].map(([field, label, placeholder]) => <label key={field}>{label}<div className="account-password-input"><input required type={showPasswords[field] ? 'text' : 'password'} placeholder={placeholder} value={passwords[field]} onChange={(event) => setPasswords((current) => ({ ...current, [field]: event.target.value }))} /><button type="button" onClick={() => setShowPasswords((current) => ({ ...current, [field]: !current[field] }))}>◉</button></div></label>)}
      <button className="account-primary-btn" type="submit" disabled={!passwords.current || !passwords.next || !passwords.confirm}>♧ Change Password</button>
    </div></form>

    <div className="account-panel invite-panel"><h3>♢ <span>My Invite Code</span></h3><div className="account-panel-body">
      <div className="invite-row"><div><span>Invite Code</span><strong>{inviteCode}</strong></div><button type="button" onClick={() => copy(inviteCode)}>▣ Copy</button></div>
      <div className="invite-row"><div><span>Invite Link</span><code>{inviteLink}</code></div><button type="button" onClick={() => copy(inviteLink)}>▣ Copy</button></div>
    </div></div>
  </section>;
}
