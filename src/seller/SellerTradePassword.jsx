import { useState } from 'react';
import './SellerTradePassword.css';

export default function SellerTradePassword({ onBack, client }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (form.next.length < 6 || form.next.length > 20) return setError('New trade password must contain 6–20 characters.');
    if (form.next !== form.confirm) return setError('The new passwords do not match.');
    const { error: saveError } = await client.rpc('change_seller_trade_password', { current_trade_password: form.current || null, new_trade_password: form.next });
    if (saveError) return setError(saveError.message);
    setError('');
    setNotice('Trade password changed successfully.');
    setForm({ current: '', next: '', confirm: '' });
    window.setTimeout(() => setNotice(''), 2200);
  };

  const passwordField = (field, placeholder) => <div className="trade-password-input"><input required={field !== 'current'} minLength={field === 'next' ? 6 : undefined} maxLength={field === 'next' ? 20 : undefined} type={visible[field] ? 'text' : 'password'} placeholder={placeholder} value={form[field]} onChange={(event) => update(field, event.target.value)} /><button type="button" aria-label={`${visible[field] ? 'Hide' : 'Show'} password`} onClick={() => setVisible((current) => ({ ...current, [field]: !current[field] }))}>◉</button></div>;

  return <main className="trade-password-page"><div className="trade-password-shell">
    <header><button type="button" onClick={onBack}>‹</button><h1>Trade Password</h1><span /></header>
    {notice && <div className="trade-password-notice">{notice}</div>}
    <div className="trade-password-info">Your trade password protects wallet actions like withdrawals and order payments. Leave the current password field empty if you have not set one yet.</div>
    <form onSubmit={submit}>
      <label>Current Trade Password{passwordField('current', 'Enter current trade password')}<small>Leave blank if you haven't set a trade password yet.</small></label>
      <label>New Trade Password{passwordField('next', '6–20 characters')}</label>
      <label>Confirm Password{passwordField('confirm', 'Enter new password again')}</label>
      {error && <p className="trade-password-error">{error}</p>}
      <button type="submit">Change Trade Password</button>
    </form>
  </div></main>;
}
