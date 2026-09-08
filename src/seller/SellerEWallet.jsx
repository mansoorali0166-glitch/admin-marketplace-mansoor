import React, { useState } from 'react';
import './SellerBankCard.css';
import { sellerSupabase } from '../shared/supabase';

const loadWallet = () => {
  try {
    return JSON.parse(localStorage.getItem('seller_e_wallet')) || {};
  } catch {
    return {};
  }
};

export default function SellerEWallet({ onBack, client = sellerSupabase, sellerId }) {
  const saved = loadWallet();
  const [form, setForm] = useState({
    name: saved.name || '',
    walletName: saved.walletName || '',
    walletEmail: saved.walletEmail || 'agent100@gmail.com',
    walletNumber: saved.walletNumber || '',
    tradePassword: '',
  });
  const [notice, setNotice] = useState('');
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    const { tradePassword, ...walletDetails } = form;
    localStorage.setItem('seller_e_wallet', JSON.stringify(walletDetails));
    const { data: auth } = sellerId ? { data: { user: { id: sellerId } } } : await client.auth.getUser();
    const { error } = await client.from('payment_methods').upsert({seller_id:auth.user.id,method_type:'e_wallet',details:walletDetails,updated_at:new Date().toISOString()},{onConflict:'seller_id,method_type'});
    if (error) { setNotice(error.message); return; }
    setNotice('E-Wallet successfully bound.');
    setForm((current) => ({ ...current, tradePassword: '' }));
    window.setTimeout(() => setNotice(''), 2200);
  };

  return <main className="seller-bank-page"><div className="seller-bank-shell">
    <header><button type="button" onClick={onBack}>‹</button><h1>Bind E-Wallet</h1><span /></header>
    {notice && <div className="seller-bank-notice">{notice}</div>}
    <form onSubmit={submit}>
      <label>Name<input required placeholder="Enter your real name" value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
      <label>Wallet Name<input required placeholder="e.g. Wise, PayPal" value={form.walletName} onChange={(event) => update('walletName', event.target.value)} /></label>
      <label>Wallet Email<input required type="email" value={form.walletEmail} onChange={(event) => update('walletEmail', event.target.value)} /></label>
      <label>Wallet Number<input required placeholder="Enter wallet number" value={form.walletNumber} onChange={(event) => update('walletNumber', event.target.value)} /></label>
      <label>Trade Password<input required type="password" placeholder="Enter trade password" value={form.tradePassword} onChange={(event) => update('tradePassword', event.target.value)} /></label>
      <button type="submit">Bind E-Wallet</button>
    </form>
  </div></main>;
}
