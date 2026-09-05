import React, { useEffect, useState } from 'react';
import './MerchantFinanceModals.css';

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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!merchant?.userId || !client) return;
    if (action === 'Logs') loadLogs();
    if (action === 'Payment') setMode('Add');
    if (action === 'Freeze') { setAmount(''); setRemark(''); }
  }, [action, merchant?.userId]);

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

  const saveShopPayment = async (event) => {
    event.preventDefault();
    if (!requireLiveMerchant()) return;
    const numeric = Number(amount);
    if (!numeric || numeric <= 0) return setMessage('Enter a valid amount greater than zero.');
    setBusy(true);
    const { error } = await client.from('wallet_transactions').insert({ seller_id: merchant.userId, type: `${actor} Credit`, amount: numeric, note: `${currency} · Shop payment${remark ? ` · ${remark}` : ''}` });
    setBusy(false);
    if (error) return setMessage(error.message);
    onChanged?.(); onClose();
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
    {action === 'Payment' && <form className="merchant-finance-modal compact" onSubmit={saveShopPayment}><header><div><h3>Add Shop Payment</h3><p>{merchant.email}</p></div><button type="button" onClick={onClose}>×</button></header><div className="merchant-available"><span>Current balance</span><strong>{merchant.balance || '$0.00'}</strong></div><label>Currency<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>USD</option><option>EUR</option><option>GBP</option><option>CNY</option></select></label><label>Amount<input type="number" min="0.01" step="0.01" required placeholder="Amount to add" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Remark<input placeholder="Payment note (optional)" value={remark} onChange={(event) => setRemark(event.target.value)} /></label>{message && <p className="merchant-modal-error">{message}</p>}<footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={busy}>Add Payment</button></footer></form>}
    {action === 'Freeze' && <form className="merchant-finance-modal compact" onSubmit={saveFreeze}><header><div><h3>Freeze Balance</h3><p>{merchant.email}</p></div><button type="button" onClick={onClose}>×</button></header><div className="merchant-available"><span>Available</span><strong>{merchant.balance || '$0.00'}</strong></div><label>Amount to Freeze<input type="number" min="0.01" step="0.01" required placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Remark<input placeholder="Reason for freeze (optional)" value={remark} onChange={(event) => setRemark(event.target.value)} /></label>{message && <p className="merchant-modal-error">{message}</p>}<footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="lock-confirm" disabled={busy}>Freeze Balance</button></footer></form>}
    {action === 'Unfreeze' && <form className="merchant-finance-modal compact" onSubmit={saveUnfreeze}><header><div><h3>Unfreeze Balance</h3><p>{merchant.email}</p></div><button type="button" onClick={onClose}>×</button></header><p>This will release all active balance locks for this seller.</p>{message && <p className="merchant-modal-error">{message}</p>}<footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={busy}>Unfreeze Balance</button></footer></form>}
  </div>;
}
