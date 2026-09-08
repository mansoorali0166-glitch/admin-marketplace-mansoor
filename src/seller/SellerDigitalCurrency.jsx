import React, { useState } from 'react';
import './SellerBankCard.css';
import { sellerSupabase } from '../shared/supabase';

const loadAddresses = () => {
  try {
    return JSON.parse(localStorage.getItem('seller_digital_currency')) || {};
  } catch {
    return {};
  }
};

export default function SellerDigitalCurrency({ onBack, client = sellerSupabase, sellerId }) {
  const saved = loadAddresses();
  const [form, setForm] = useState({
    trc20: saved.trc20 || '',
    erc20: saved.erc20 || '',
    bep20: saved.bep20 || 'agent100@gmail.com',
    tradePassword: '',
  });
  const [notice, setNotice] = useState('');
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    const { tradePassword, ...addresses } = form;
    localStorage.setItem('seller_digital_currency', JSON.stringify(addresses));
    const { data: auth } = sellerId ? { data: { user: { id: sellerId } } } : await client.auth.getUser();
    const { error } = await client.from('payment_methods').upsert({seller_id:auth.user.id,method_type:'digital_currency',details:addresses,updated_at:new Date().toISOString()},{onConflict:'seller_id,method_type'});
    if (error) { setNotice(error.message); return; }
    setNotice('Digital currency addresses saved.');
    setForm((current) => ({ ...current, tradePassword: '' }));
    window.setTimeout(() => setNotice(''), 2200);
  };

  return <main className="seller-bank-page"><div className="seller-bank-shell">
    <header><button type="button" onClick={onBack}>‹</button><h1>Digital Currency</h1><span /></header>
    {notice && <div className="seller-bank-notice">{notice}</div>}
    <form onSubmit={submit}>
      <label>USDT (TRC20)<input placeholder="Enter wallet address" value={form.trc20} onChange={(event) => update('trc20', event.target.value)} /></label>
      <label>USDT (ERC20)<input placeholder="Enter wallet address" value={form.erc20} onChange={(event) => update('erc20', event.target.value)} /></label>
      <label>USDT (BEP20)<input placeholder="Enter wallet address" value={form.bep20} onChange={(event) => update('bep20', event.target.value)} /></label>
      <label>Trade Password<input required type="password" placeholder="Enter trade password" value={form.tradePassword} onChange={(event) => update('tradePassword', event.target.value)} /></label>
      <button type="submit">Save</button>
    </form>
  </div></main>;
}
