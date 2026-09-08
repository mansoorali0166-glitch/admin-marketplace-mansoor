import React, { useEffect, useMemo, useState } from 'react';
import './SellerWallet.css';
import SellerRecharge from './SellerRecharge';
import SellerWithdraw from './SellerWithdraw';
import SellerBankCard from './SellerBankCard';
import SellerEWallet from './SellerEWallet';
import SellerDigitalCurrency from './SellerDigitalCurrency';
import SellerTradePassword from './SellerTradePassword';
import SellerChangePassword from './SellerChangePassword';
import { sellerSupabase } from '../shared/supabase';

const transactions = [
  { id: 1, type: 'Orders', title: 'Order Payment', date: '8/10/2026, 1:32:26 AM', amount: '-$160.08' },
  { id: 2, type: 'Withdraw', title: 'Withdrawal', date: '8/4/2026, 12:40:16 AM', amount: '-$155.00' },
  { id: 3, type: 'Orders', title: 'Order Payment', date: '8/3/2026, 7:46:09 PM', amount: '+$0.00' },
  { id: 4, type: 'Withdraw', title: 'Withdrawal', date: '8/3/2026, 12:47:27 AM', amount: '-$100.00' },
  { id: 5, type: 'Recharge', title: 'Admin Credit', date: '8/2/2026, 10:58:58 AM', amount: '+$5,000.00' },
  { id: 6, type: 'Orders', title: 'Order Payment', date: '7/31/2026, 12:59:24 AM', amount: '-$8.00' },
  { id: 7, type: 'Withdraw', title: 'Withdrawal', date: '7/28/2026, 10:27:43 PM', amount: '-$166.00' },
  { id: 8, type: 'Orders', title: 'Order Payment', date: '7/28/2026, 10:20:44 PM', amount: '+$0.00' },
];

const menuItems = [['↗', 'Withdrawal Records'], ['♙', 'Bind Bank Card'], ['◎', 'Bind E-Wallet'], ['◇', 'Digital Currency'], ['♧', 'Trade Password'], ['♧', 'Change Password']];

export default function SellerWallet({ onBack, sellerId, client = sellerSupabase }) {
  const [filter, setFilter] = useState('All');
  const [dialog, setDialog] = useState(null);
  const [amount, setAmount] = useState('');
  const [walletView, setWalletView] = useState('wallet');
  const [liveTransactions, setLiveTransactions] = useState([]);
  const [frozen, setFrozen] = useState(0);
  useEffect(() => {
    if (!sellerId) return;
    Promise.all([
      client.from('wallet_transactions').select('*').eq('seller_id', sellerId).order('created_at', { ascending: false }),
      client.from('balance_locks').select('amount,status').eq('seller_id', sellerId),
    ]).then(([txnRes, lockRes]) => {
      setLiveTransactions((txnRes.data || []).map((row) => ({ id: row.id, type: /withdraw/i.test(row.type) ? 'Withdraw' : /order/i.test(row.type) ? 'Orders' : 'Recharge', title: row.type || 'Balance transaction', date: new Date(row.created_at).toLocaleString(), amount: `${Number(row.amount || 0) >= 0 ? '+' : '-'}$${Math.abs(Number(row.amount || 0)).toFixed(2)}` })));
      setFrozen((lockRes.data || []).filter((row) => String(row.status).toLowerCase() === 'active').reduce((sum, row) => sum + Number(row.amount || 0), 0));
    });
  }, [client, sellerId]);
  const sourceTransactions = sellerId ? liveTransactions : transactions;
  const assets = sourceTransactions.reduce((sum, item) => sum + (item.amount.startsWith('-') ? -1 : 1) * Number(item.amount.replace(/[^0-9.]/g, '') || 0), 0);
  const visibleTransactions = useMemo(() => filter === 'All' ? sourceTransactions : sourceTransactions.filter((item) => item.type === filter), [filter, sourceTransactions]);

  if (walletView === 'recharge') return <SellerRecharge client={client} sellerId={sellerId} onBack={() => setWalletView('wallet')} />;
  if (walletView === 'withdraw') return <SellerWithdraw client={client} sellerId={sellerId} onBack={() => setWalletView('wallet')} />;
  if (walletView === 'withdraw-records') return <SellerWithdraw client={client} sellerId={sellerId} recordsOnly onBack={() => setWalletView('wallet')} onNewWithdrawal={() => setWalletView('withdraw')} />;
  if (walletView === 'bank-card') return <SellerBankCard client={client} sellerId={sellerId} onBack={() => setWalletView('wallet')} />;
  if (walletView === 'e-wallet') return <SellerEWallet client={client} sellerId={sellerId} onBack={() => setWalletView('wallet')} />;
  if (walletView === 'digital-currency') return <SellerDigitalCurrency client={client} sellerId={sellerId} onBack={() => setWalletView('wallet')} />;
  if (walletView === 'trade-password') return <SellerTradePassword onBack={() => setWalletView('wallet')} />;
  if (walletView === 'change-password') return <SellerChangePassword onBack={() => setWalletView('wallet')} />;

  return <main className="seller-wallet-page"><div className="seller-wallet-shell">
    <header><button type="button" onClick={onBack}>‹</button><h1>Wallet</h1><span /></header>
    <section className="wallet-balances"><div><strong>${assets.toFixed(2)}</strong><span>My Assets</span></div><div><strong>${frozen.toFixed(2)}</strong><span>Frozen</span></div><div><strong>$0.00</strong><span>Settled</span></div><div><strong>$0.00</strong><span>Unsettled</span></div></section>
    <div className="wallet-main-actions"><button type="button" onClick={() => setWalletView('recharge')}>Recharge</button><button type="button" onClick={() => setWalletView('withdraw')}>Withdraw</button></div>
    <nav className="wallet-menu">{menuItems.map(([icon, title]) => <button type="button" key={title} onClick={() => title === 'Withdrawal Records' ? setWalletView('withdraw-records') : title === 'Bind Bank Card' ? setWalletView('bank-card') : title === 'Bind E-Wallet' ? setWalletView('e-wallet') : title === 'Digital Currency' ? setWalletView('digital-currency') : title === 'Trade Password' ? setWalletView('trade-password') : title === 'Change Password' ? setWalletView('change-password') : setDialog(title)}><span>{icon}</span><strong>{title}</strong><b>›</b></button>)}</nav>
    <section className="wallet-transactions"><div className="wallet-transactions-heading"><h2>Transaction History</h2><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>Orders</option><option>Recharge</option><option>Withdraw</option></select></div>
      <div>{visibleTransactions.map((item) => <article key={item.id}><div><strong>{item.title}</strong><time>{item.date}</time></div><b className={item.amount.startsWith('+') ? 'positive' : 'negative'}>{item.amount}</b></article>)}</div>
    </section>
    {dialog && <div className="wallet-dialog-overlay" onMouseDown={(event) => event.target === event.currentTarget && setDialog(null)}><form className="wallet-dialog" onSubmit={(event) => { event.preventDefault(); setAmount(''); setDialog(null); }}><div><h2>{dialog}</h2><button type="button" onClick={() => setDialog(null)}>×</button></div>{['Recharge','Withdraw'].includes(dialog) ? <><label>Amount (USD)<input autoFocus required min="1" type="number" placeholder="Enter amount" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><button type="submit">Continue</button></> : <><p>{dialog} settings will be connected to your payment system later.</p><button type="button" onClick={() => setDialog(null)}>Close</button></>}</form></div>}
  </div></main>;
}
