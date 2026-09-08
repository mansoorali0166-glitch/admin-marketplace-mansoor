import React, { useState } from 'react';
import './SellerBankCard.css';
import { sellerSupabase } from '../shared/supabase';

const loadBankCard = () => {
  try {
    return JSON.parse(localStorage.getItem('seller_bank_card')) || {};
  } catch {
    return {};
  }
};

export default function SellerBankCard({ onBack, client = sellerSupabase, sellerId }) {
  const saved = loadBankCard();
  const [form, setForm] = useState({
    name: saved.name || 'Khan',
    bankName: saved.bankName || 'HBL',
    branchName: saved.branchName || '1234',
    cardNumber: saved.cardNumber || '911 0919 019101',
    country: saved.country || 'Pakistan',
    tradePassword: '',
  });
  const [notice, setNotice] = useState('');

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    const { tradePassword, ...bankCard } = form;
    localStorage.setItem('seller_bank_card', JSON.stringify(bankCard));
    const { data: auth } = sellerId ? { data: { user: { id: sellerId } } } : await client.auth.getUser();
    const { error } = await client.from('payment_methods').upsert({seller_id:auth.user.id,method_type:'bank_card',details:bankCard,updated_at:new Date().toISOString()},{onConflict:'seller_id,method_type'});
    if (error) { setNotice(error.message); return; }
    setNotice('Bank card successfully bound.');
    setForm((current) => ({ ...current, tradePassword: '' }));
    window.setTimeout(() => setNotice(''), 2200);
  };

  return <main className="seller-bank-page"><div className="seller-bank-shell">
    <header><button type="button" onClick={onBack}>‹</button><h1>Bind Bank Card</h1><span /></header>
    {notice && <div className="seller-bank-notice">{notice}</div>}
    <form onSubmit={submit}>
      <label>Name <em>*</em><input required value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
      <label>Bank Name <em>*</em><input required value={form.bankName} onChange={(event) => update('bankName', event.target.value)} /></label>
      <label>Branch Name<input value={form.branchName} onChange={(event) => update('branchName', event.target.value)} /></label>
      <label>Card Number <em>*</em><input required inputMode="numeric" value={form.cardNumber} onChange={(event) => update('cardNumber', event.target.value)} /></label>
      <label>Country<input value={form.country} onChange={(event) => update('country', event.target.value)} /></label>
      <label>Trade Password<input required type="password" placeholder="Enter trade password" value={form.tradePassword} onChange={(event) => update('tradePassword', event.target.value)} /></label>
      <button type="submit">Bind Bank Card</button>
    </form>
  </div></main>;
}
