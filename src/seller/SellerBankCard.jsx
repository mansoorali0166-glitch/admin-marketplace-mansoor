import { useEffect, useState } from 'react';
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
    name: saved.name || '',
    bankName: saved.bankName || '',
    branchName: saved.branchName || '',
    cardNumber: saved.cardNumber || '',
    country: saved.country || '',
    tradePassword: '',
  });
  const [notice, setNotice] = useState('');
  const [bound, setBound] = useState(false);
  const [bankCardLocked, setBankCardLocked] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const effectiveId = sellerId || (await client.auth.getUser()).data.user?.id;
      if (!effectiveId) return;
      const [paymentResult, profileResult] = await Promise.all([
        client.from('payment_methods').select('details').eq('seller_id', effectiveId).eq('method_type', 'bank_card').maybeSingle(),
        client.from('profiles').select('bank_card_locked').eq('id', effectiveId).maybeSingle(),
      ]);
      if (!active) return;
      setBankCardLocked(!!profileResult.data?.bank_card_locked);
      if (paymentResult.error || !paymentResult.data) return;
      setBound(true);
      if (!paymentResult.data.details) return;
      setForm((current) => ({ ...current, ...paymentResult.data.details, tradePassword: '' }));
    };
    load();
    return () => { active = false; };
  }, [client, sellerId]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (bankCardLocked) { setNotice('Only your agent can change your bank card information while it is locked.'); return; }
    const { tradePassword, ...bankCard } = form;
    const { data: auth } = sellerId ? { data: { user: { id: sellerId } } } : await client.auth.getUser();
    const { data: restriction } = await client.from('profiles').select('bank_card_locked').eq('id', auth.user.id).maybeSingle();
    if (restriction?.bank_card_locked) {
      setBankCardLocked(true);
      setNotice('Only your agent can change your bank card information while it is locked.');
      return;
    }
    let { error } = await client.rpc('set_seller_trade_password', { new_trade_password: tradePassword });
    if (!error) ({ error } = await client.from('payment_methods').upsert({seller_id:auth.user.id,method_type:'bank_card',details:bankCard,updated_at:new Date().toISOString()},{onConflict:'seller_id,method_type'}));
    if (error) { setNotice(error.message); return; }
    localStorage.setItem('seller_bank_card', JSON.stringify(bankCard));
    setNotice(bound ? 'Bank card information updated.' : 'Bank card successfully bound.');
    setForm((current) => ({ ...current, tradePassword: '' }));
    window.setTimeout(() => setNotice(''), 2200);
  };

  return <main className="seller-bank-page"><div className="seller-bank-shell">
    <header><button type="button" onClick={onBack}>‹</button><h1>{bound ? 'Edit Bank Card' : 'Bind Bank Card'}</h1><span /></header>
    {notice && <div className="seller-bank-notice">{notice}</div>}
    {bankCardLocked ? <div className="seller-bank-locked"><p>Bank card is locked.</p><span>Only your agent can change your bank card information while this lock is enabled.</span></div> : <form onSubmit={submit}>
      <label>Name <em>*</em><input required value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
      <label>Bank Name <em>*</em><input required value={form.bankName} onChange={(event) => update('bankName', event.target.value)} /></label>
      <label>Branch Name<input value={form.branchName} onChange={(event) => update('branchName', event.target.value)} /></label>
      <label>Card Number <em>*</em><input required inputMode="numeric" value={form.cardNumber} onChange={(event) => update('cardNumber', event.target.value)} /></label>
      <label>Country<input value={form.country} onChange={(event) => update('country', event.target.value)} /></label>
      <label>Trade Password<input required type="password" placeholder="Enter trade password" value={form.tradePassword} onChange={(event) => update('tradePassword', event.target.value)} /></label>
      <button type="submit">{bound ? 'Save Bank Card Changes' : 'Bind Bank Card'}</button>
    </form>}
  </div></main>;
}
