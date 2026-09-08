import React, { useEffect, useState } from 'react';
import './MerchantFinanceModals.css';
import './MerchantWithdrawals.css';

const blankPayment = { bankName: '', bankBranch: '', bankAccount: '', bankOwner: '', walletName: '', walletEmail: '', walletAccount: '', walletOwner: '', trc20: '', erc20: '' };

export default function MerchantFinanceModals({ client, merchant, action, onClose, actor = 'Admin', onChanged }) {
  const [mode, setMode] = useState('Add');
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [lockUntil, setLockUntil] = useState('');
  const [logs, setLogs] = useState([]);
  const [logCurrency, setLogCurrency] = useState('USD');
  const [logType, setLogType] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [payment, setPayment] = useState(blankPayment);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
  const [rejectingWithdrawal, setRejectingWithdrawal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!merchant?.userId || !client) return;
    if (action === 'Logs') loadLogs();
    if (action === 'Payment') loadWithdrawals();
    if (action === 'Freeze') { setAmount(''); setRemark(''); }
  }, [action, merchant?.userId]);

  useEffect(() => {
    if (action !== 'Payment' || !merchant?.userId || !client) return undefined;
    const channel = client.channel(`merchant-payment-withdrawals-${merchant.userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals', filter: `seller_id=eq.${merchant.userId}` }, loadWithdrawals).subscribe();
    return () => { client.removeChannel(channel); };
  }, [action, client, merchant?.userId]);

  const loadLogs = async () => {
    const { data } = await client.from('wallet_transactions').select('*').eq('seller_id', merchant.userId).order('created_at', { ascending: false });
    setLogs(data || []);
  };

  const loadPayments = async () => {
    const { data } = await client.from('payment_methods').select('method_type,details').eq('seller_id', merchant.userId);
    const next = { ...blankPayment };
    (data || []).forEach(({ method_type: type, details = {} }) => {
      if (type === 'bank_card') Object.assign(next, { bankName: details.bankName || details.bank_name || '', bankBranch: details.branchName || details.branch_name || '', bankAccount: details.cardNumber || details.account_no || '', bankOwner: details.name || '' });
      if (type === 'e_wallet') Object.assign(next, { walletName: details.walletName || details.wallet_name || '', walletEmail: details.walletEmail || details.wallet_email || '', walletAccount: details.walletNumber || details.account_no || '', walletOwner: details.name || '' });
      if (type === 'digital_currency') Object.assign(next, { trc20: details.trc20 || details.usdt_trc20 || '', erc20: details.erc20 || details.usdt_erc20 || '' });
    });
    setPayment(next);
  };

  const loadWithdrawals = async () => {
    if (!merchant?.userId) return;
    setLoadingWithdrawals(true);
    const { data, error } = await client.from('withdrawals').select('*').eq('seller_id', merchant.userId).order('created_at', { ascending: false });
    setWithdrawals(data || []);
    setLoadingWithdrawals(false);
    if (error) setMessage(error.message);
  };

  const requireLiveMerchant = () => {
    if (merchant?.userId) return true;
    setMessage('This preview merchant is not connected to a Supabase account.');
    return false;
  };

  const saveBalance = async (event) => {
    event.preventDefault();
    if (!requireLiveMerchant()) return;
    const numeric = Number(amount);
    if (!numeric || numeric < 0) return setMessage('Enter a valid amount.');
    setBusy(true);
    const signed = mode === 'Deduct' ? -numeric : numeric;
    const { error } = await client.from('wallet_transactions').insert({ seller_id: merchant.userId, type: `${actor} ${mode === 'Deduct' ? 'Debit' : 'Credit'}`, amount: signed, note: `${currency}${remark ? ` · ${remark}` : ''}` });
    setBusy(false);
    if (error) return setMessage(error.message);
    onChanged?.(); onClose();
  };

  const saveFreeze = async (event) => {
    event.preventDefault();
    if (!requireLiveMerchant()) return;
    const numeric = Number(amount);
    if (!numeric || numeric <= 0) return setMessage('Enter a valid amount to freeze.');
    setBusy(true);
    const { error } = await client.from('balance_locks').insert({ seller_id: merchant.userId, amount: numeric, reason: remark || 'Balance frozen', status: 'Active', created_by: (await client.auth.getUser()).data.user?.id });
    setBusy(false);
    if (error) return setMessage(error.message);
    onChanged?.(); onClose();
  };

  const saveUnfreeze = async (event) => {
    event.preventDefault();
    if (!requireLiveMerchant()) return;
    setBusy(true);
    const { error } = await client.from('balance_locks').update({ status: 'Released', released_at: new Date().toISOString() }).eq('seller_id', merchant.userId).eq('status', 'Active');
    setBusy(false);
    if (error) return setMessage(error.message);
    onChanged?.(); onClose();
  };

  const saveLock = async (event) => {
    event.preventDefault();
    if (!requireLiveMerchant()) return;
    setBusy(true);
    const numeric = Number(amount || 0);
    const now = new Date().toISOString();
    const { error: releaseError } = await client.from('balance_locks').update({ status: 'Released', released_at: now }).eq('seller_id', merchant.userId).eq('status', 'Active');
    let error = releaseError;
    if (!error && numeric > 0) ({ error } = await client.from('balance_locks').insert({ seller_id: merchant.userId, amount: numeric, reason: remark || 'Balance protection hold', status: 'Active', lock_until: lockUntil || null, created_by: (await client.auth.getUser()).data.user?.id }));
    setBusy(false);
    if (error) return setMessage(error.message);
    onChanged?.(); onClose();
  };

  const approveWithdrawal = async (withdrawal) => {
    setBusy(true);
    setMessage('');
    const { data: approved, error: updateError } = await client.from('withdrawals').update({ status: 'Approved', updated_at: new Date().toISOString() }).eq('id', withdrawal.id).eq('status', 'Pending').select('id').maybeSingle();
    let error = updateError;
    if (!error && approved) {
      ({ error } = await client.from('wallet_transactions').insert({ seller_id: merchant.userId, type: `${actor} Debit`, amount: -Math.abs(Number(withdrawal.amount || 0)), note: `Withdrawal #${withdrawal.id} approved` }));
    }
    setBusy(false);
    if (error) return setMessage(error.message);
    setMessage(approved ? 'Withdrawal approved.' : 'This request was already processed.');
    await loadWithdrawals(); onChanged?.();
  };

  const rejectWithdrawal = async (event) => {
    event.preventDefault();
    if (!rejectionReason.trim()) return;
    setBusy(true); setMessage('');
    const { data: rejected, error } = await client.from('withdrawals').update({ status: 'Rejected', rejection_reason: rejectionReason.trim(), updated_at: new Date().toISOString() }).eq('id', rejectingWithdrawal.id).eq('status', 'Pending').select('id').maybeSingle();
    setBusy(false);
    if (error) return setMessage(error.message);
    setRejectingWithdrawal(null); setRejectionReason('');
    setMessage(rejected ? 'Withdrawal rejected.' : 'This request was already processed.');
    await loadWithdrawals(); onChanged?.();
  };

  const savePayment = async (event) => {
    event.preventDefault();
    if (!requireLiveMerchant()) return;
    setBusy(true);
    const rows = [
      { seller_id: merchant.userId, method_type: 'bank_card', details: { name: payment.bankOwner, bankName: payment.bankName, branchName: payment.bankBranch, cardNumber: payment.bankAccount }, updated_at: new Date().toISOString() },
      { seller_id: merchant.userId, method_type: 'e_wallet', details: { name: payment.walletOwner, walletName: payment.walletName, walletEmail: payment.walletEmail, walletNumber: payment.walletAccount }, updated_at: new Date().toISOString() },
      { seller_id: merchant.userId, method_type: 'digital_currency', details: { trc20: payment.trc20, erc20: payment.erc20 }, updated_at: new Date().toISOString() },
    ];
    const { error } = await client.from('payment_methods').upsert(rows, { onConflict: 'seller_id,method_type' });
    setBusy(false);
    if (error) return setMessage(error.message);
    onChanged?.(); onClose();
  };

  const filteredLogs = logs.filter((item) => {
    const created = item.created_at?.slice(0, 10) || '';
    return (logType === 'All' || item.type === logType) && (!fromDate || created >= fromDate) && (!toDate || created <= toDate);
  });
  const updatePayment = (key) => (event) => setPayment((current) => ({ ...current, [key]: event.target.value }));

  if (!merchant || !action) return null;
  return <div className="merchant-finance-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    {action === 'Balance' && <form className="merchant-finance-modal compact" onSubmit={saveBalance}><header><div><h3>Adjust Balance</h3><p>{merchant.email}</p></div><button type="button" onClick={onClose}>×</button></header><div className="merchant-mode"><button type="button" className={mode === 'Add' ? 'active' : ''} onClick={() => setMode('Add')}>Add</button><button type="button" className={mode === 'Deduct' ? 'active deduct' : ''} onClick={() => setMode('Deduct')}>Deduct</button></div><label>Currency<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>USD</option><option>EUR</option><option>GBP</option><option>CNY</option></select></label><label>Amount<input type="number" min="0" step="0.01" required placeholder="Please enter Amount" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Remark<input placeholder="User remark (optional)" value={remark} onChange={(event) => setRemark(event.target.value)} /></label>{message && <p className="merchant-modal-error">{message}</p>}<footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={busy}>Confirm</button></footer></form>}
    {action === 'Lock' && <form className="merchant-finance-modal compact" onSubmit={saveLock}><header><div><h3>Lock Balance</h3><p>{merchant.email}</p></div><button type="button" onClick={onClose}>×</button></header><div className="merchant-available"><span>Available</span><strong>{merchant.balance || '$0.00'}</strong></div><label>★ Target Lock <small>(0 = clear)</small><input type="number" min="0" step="0.01" required placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Lock Until <small>(leave empty = permanent)</small><input type="datetime-local" value={lockUntil} onChange={(event) => setLockUntil(event.target.value)} /></label><label>Remark<input placeholder="User remark (optional)" value={remark} onChange={(event) => setRemark(event.target.value)} /></label>{message && <p className="merchant-modal-error">{message}</p>}<footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="lock-confirm" disabled={busy}>Confirm</button></footer></form>}
    {action === 'Logs' && <section className="merchant-finance-modal logs"><header><div><h3>Logs — {merchant.email}</h3></div><button type="button" onClick={onClose}>×</button></header><div className="merchant-log-tools"><select value={logCurrency} onChange={(event) => setLogCurrency(event.target.value)}><option>USD</option><option>EUR</option><option>GBP</option><option>CNY</option></select><select value={logType} onChange={(event) => setLogType(event.target.value)}><option value="All">Type</option><option>Admin Credit</option><option>Admin Debit</option><option>Agent Credit</option><option>Agent Debit</option><option>Order</option><option>Withdrawal</option></select><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /><button type="button" onClick={loadLogs}>Search</button></div><div className="merchant-log-results">{filteredLogs.map((item) => <article key={item.id}><time>{new Date(item.created_at).toLocaleString()}</time><strong>{item.type}</strong><span>{item.note || '—'}</span><b className={Number(item.amount) >= 0 ? 'credit' : 'debit'}>{Number(item.amount) >= 0 ? '+' : ''}{logCurrency} {Number(item.amount).toFixed(2)}</b></article>)}{!filteredLogs.length && <p>No transactions found.</p>}</div><footer><button type="button" onClick={onClose}>Close</button></footer></section>}
    {action === 'Payment' && <section className="merchant-finance-modal merchant-withdrawals"><header><div><h3>Merchant Withdrawal Requests</h3><p>{merchant.email}</p></div><button type="button" onClick={onClose}>×</button></header>{message && <p className={message.includes('approved') || message.includes('rejected') ? 'merchant-modal-success' : 'merchant-modal-error'}>{message}</p>}{loadingWithdrawals ? <p className="merchant-withdraw-empty">Loading withdrawal requests…</p> : <div className="merchant-withdraw-list">{withdrawals.map((withdrawal) => <article key={withdrawal.id}><div><strong>${Number(withdrawal.amount || 0).toFixed(2)}</strong><span>{withdrawal.method || 'Payment method'} · {withdrawal.account_details || 'No account details'}</span><time>{new Date(withdrawal.created_at).toLocaleString()}</time>{withdrawal.rejection_reason && <small>{withdrawal.rejection_reason}</small>}</div><em className={String(withdrawal.status || '').toLowerCase()}>{withdrawal.status}</em>{withdrawal.status === 'Pending' && <span className="merchant-withdraw-actions"><button type="button" disabled={busy} onClick={() => approveWithdrawal(withdrawal)}>✓ Accept</button><button type="button" disabled={busy} onClick={() => { setRejectingWithdrawal(withdrawal); setRejectionReason(''); }}>× Reject</button></span>}</article>)}{!withdrawals.length && <p className="merchant-withdraw-empty">No withdrawal requests from this merchant.</p>}</div>}{rejectingWithdrawal && <form className="merchant-withdraw-reject" onSubmit={rejectWithdrawal}><label>REJECTION REASON<textarea required autoFocus value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Why is this withdrawal being rejected?" /></label><footer><button type="button" disabled={busy} onClick={() => setRejectingWithdrawal(null)}>Cancel</button><button type="submit" disabled={busy}>Confirm Reject</button></footer></form>}<footer><button type="button" onClick={onClose}>Close</button></footer></section>}
    {action === 'Freeze' && <form className="merchant-finance-modal compact" onSubmit={saveFreeze}><header><div><h3>Freeze Balance</h3><p>{merchant.email}</p></div><button type="button" onClick={onClose}>×</button></header><div className="merchant-available"><span>Available</span><strong>{merchant.balance || '$0.00'}</strong></div><label>Amount to Freeze<input type="number" min="0.01" step="0.01" required placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Remark<input placeholder="Reason for freeze (optional)" value={remark} onChange={(event) => setRemark(event.target.value)} /></label>{message && <p className="merchant-modal-error">{message}</p>}<footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="lock-confirm" disabled={busy}>Freeze Balance</button></footer></form>}
    {action === 'Unfreeze' && <form className="merchant-finance-modal compact" onSubmit={saveUnfreeze}><header><div><h3>Unfreeze Balance</h3><p>{merchant.email}</p></div><button type="button" onClick={onClose}>×</button></header><p>This will release all active balance locks for this seller.</p>{message && <p className="merchant-modal-error">{message}</p>}<footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={busy}>Unfreeze Balance</button></footer></form>}
  </div>;
}
