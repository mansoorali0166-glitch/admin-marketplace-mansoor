import React, { useEffect, useState } from 'react';
import './SellerWithdraw.css';
import { sellerSupabase } from '../shared/supabase';

const initialRecords = [
  { id: '77942504...', amount: 155, method: 'Bank Card', account: '0981627272838383', date: 'Aug 4, 2026, 12:39 AM', updated: 'Aug 4, 2026, 12:40 AM', status: 'Approved' },
  { id: 'CABD9B3B...', amount: 500, method: 'Bank Card', account: 'Ubl', date: 'Aug 3, 2026, 12:49 AM', updated: 'Aug 3, 2026, 12:51 AM', status: 'Rejected', reason: 'Due to incorrect bank information withdrawal rejected' },
  { id: '59321EEE...', amount: 100, method: 'Bank Card', account: 'Gsm', date: 'Jul 29, 2026, 01:26 AM', updated: 'Aug 3, 2026, 12:47 AM', status: 'Approved' },
  { id: '190CD5F1...', amount: 166, method: 'Bank Card', account: '09281771282839292', date: 'Jul 28, 2026, 12:35 AM', updated: 'Jul 28, 2026, 12:37 AM', status: 'Approved' },
];

const loadSavedRecords = () => {
  try {
    return JSON.parse(localStorage.getItem('seller_withdrawal_requests')) || [];
  } catch {
    return [];
  }
};

export default function SellerWithdraw({ onBack, recordsOnly = false, onNewWithdrawal }) {
  const [method, setMethod] = useState('');
  const [account, setAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [tradePassword, setTradePassword] = useState('');
  const [records, setRecords] = useState(() => [...loadSavedRecords(), ...initialRecords]);
  const [notice, setNotice] = useState('');
  const [methodPickerOpen, setMethodPickerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [savedMethods, setSavedMethods] = useState({});
  const visibleRecords = statusFilter === 'All' ? records : records.filter((record) => record.status === statusFilter);
  const loadCloudRecords = async () => {
    const { data } = await sellerSupabase.from('withdrawals').select('*').order('created_at',{ascending:false});
    if(data?.length) setRecords(data.map((item)=>({id:String(item.id).slice(0,8).toUpperCase()+'...',dbId:item.id,amount:Number(item.amount),method:item.method,account:item.account_details,date:new Date(item.created_at).toLocaleString(),updated:new Date(item.updated_at).toLocaleString(),status:item.status,reason:item.rejection_reason})));
  };
  const loadSavedMethods = async () => {
    const { data: auth } = await sellerSupabase.auth.getUser();
    if (!auth?.user) return;
    const { data } = await sellerSupabase.from('payment_methods').select('method_type,details').eq('seller_id', auth.user.id);
    const map = {};
    (data || []).forEach((row) => {
      if (row.method_type === 'bank_card') map['Bank Card'] = [row.details?.name, row.details?.bankName, row.details?.cardNumber].filter(Boolean).join(' · ');
      if (row.method_type === 'e_wallet') map['E-Wallet'] = [row.details?.name, row.details?.walletName, row.details?.walletNumber].filter(Boolean).join(' · ');
      if (row.method_type === 'digital_currency') map['Crypto'] = row.details?.trc20 || row.details?.erc20 || row.details?.bep20 || '';
    });
    setSavedMethods(map);
  };
  useEffect(() => { loadCloudRecords(); loadSavedMethods(); }, []);

  const selectMethod = (selectedMethod) => {
    setMethod(selectedMethod);
    setAccount(savedMethods[selectedMethod] || '');
    setMethodPickerOpen(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    const { data: auth } = await sellerSupabase.auth.getUser();
    const { data, error } = await sellerSupabase.from('withdrawals').insert({seller_id:auth.user.id,amount:Number(amount),method,account_details:account,status:'Pending'}).select().single();
    if (error) { setNotice(`Could not submit withdrawal: ${error.message}`); window.setTimeout(() => setNotice(''), 3000); return; }
    const idLabel = data?.id != null ? String(data.id).slice(0, 8).toUpperCase() + '...' : `${Date.now().toString(16).toUpperCase().slice(-8)}...`;
    const record = { id: idLabel, dbId:data?.id,amount: Number(amount), method, account, date: new Date(data?.created_at||Date.now()).toLocaleString(), status: 'Pending' };
    setRecords((current) => [record, ...current]);
    try { const current = JSON.parse(localStorage.getItem('seller_withdrawal_requests')) || []; localStorage.setItem('seller_withdrawal_requests', JSON.stringify([record, ...current])); } catch { /* unavailable */ }
    setAmount(''); setTradePassword(''); setNotice('Withdrawal request submitted for review.');
    window.setTimeout(() => setNotice(''), 2200);
  };

  return <main className="seller-withdraw-page"><div className="seller-withdraw-shell">
    <header><button type="button" onClick={onBack}>‹</button><h1>{recordsOnly ? 'Withdrawal Records' : 'Withdraw'}</h1>{recordsOnly ? <button className="withdraw-header-refresh" type="button" onClick={loadCloudRecords}>Refresh</button> : <span />}</header>
    {!recordsOnly && <>{notice && <div className="withdraw-success-notice">{notice}</div>}
    <div className="withdraw-info">Withdrawal requests are reviewed by our team and processed within 1–3 business days. Your balance will be held until the request is approved.</div>
    <form className="withdraw-form" onSubmit={submit}>
      <label>Withdraw Method<button className={`withdraw-method-trigger${method ? ' selected' : ''}`} type="button" onClick={() => setMethodPickerOpen(true)}><span>{method || 'Select withdraw method'}</span><span>›</span></button></label>
      <label>Account Details<input required placeholder={method === 'Bank Card' ? 'Bank account number / name' : method === 'E-Wallet' ? 'E-wallet account number / name' : method === 'Crypto' ? 'Wallet address / network' : 'Enter account details'} value={account} onChange={(event) => setAccount(event.target.value)} /></label>
      <label>Amount $<input required min="1" max="4752.92" step="0.01" type="number" placeholder="Enter withdraw amount" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <label>Trade Password<input required type="password" placeholder="Enter trade password" value={tradePassword} onChange={(event) => setTradePassword(event.target.value)} /></label>
      <button type="submit">Withdraw</button>
    </form></>}
    {recordsOnly && <nav className="withdraw-record-filters">{['All', 'Pending', 'Approved', 'Completed', 'Rejected'].map((filter) => <button className={statusFilter === filter ? 'active' : ''} type="button" key={filter} onClick={() => setStatusFilter(filter)}>{filter}</button>)}</nav>}
    <section className={`withdraw-records${recordsOnly ? ' records-only' : ''}`}>{!recordsOnly && <div><h2>Withdrawal Records</h2><button type="button" onClick={() => setRecords([...loadSavedRecords(), ...initialRecords])}>Refresh</button></div>}{visibleRecords.length ? visibleRecords.map((record) => <article key={record.id + record.date}><span className={`seller-withdraw-status ${record.status.toLowerCase()}`}>{record.status === 'Approved' ? '✓' : record.status === 'Rejected' ? '⊗' : '◷'} {record.status}</span><div className="withdraw-record-grid"><dl><dt>WITHDRAWAL ID</dt><dd>{record.id}</dd><dt>AMOUNT</dt><dd>${record.amount.toFixed(2)}</dd><dt>ACCOUNT / WALLET</dt><dd>{record.account}</dd><dt>REQUESTED ON</dt><dd>{record.date}</dd>{recordsOnly && <><dt>LAST UPDATED</dt><dd>{record.updated || record.date}</dd></>}</dl><dl><dt>METHOD</dt><dd>{record.method}</dd></dl></div>{record.reason && <div className="withdraw-rejection"><strong>REJECTION REASON</strong><p>{record.reason}</p></div>}</article>) : <div className="withdraw-empty"><b>!</b><strong>No withdrawal records</strong><span>No {statusFilter.toLowerCase()} withdrawals found.</span><button type="button" onClick={onNewWithdrawal}>Make a Withdrawal</button></div>}</section>
    {recordsOnly && <div className="withdraw-new-action"><button type="button" onClick={onNewWithdrawal}>Submit New Withdrawal</button></div>}
    {!recordsOnly && methodPickerOpen && <div className="withdraw-method-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setMethodPickerOpen(false); }}>
      <section className="withdraw-method-modal" role="dialog" aria-modal="true" aria-label="Choose withdrawal method">
        <p>Please bind a payment method first</p>
        {['Bank Card', 'E-Wallet', 'Crypto'].map((option) => <button type="button" key={option} onClick={() => selectMethod(option)}><span>{option}</span><span>›</span></button>)}
        <button className="withdraw-method-cancel" type="button" onClick={() => setMethodPickerOpen(false)}>Cancel</button>
      </section>
    </div>}
  </div></main>;
}
