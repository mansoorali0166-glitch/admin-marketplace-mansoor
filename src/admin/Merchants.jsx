import React, { useEffect, useMemo, useState } from 'react';
import './Merchants.css';
import MerchantFinanceModals from '../shared/MerchantFinanceModals';
import MerchantControlModals from '../shared/MerchantControlModals';
import MerchantActivityModals from '../shared/MerchantActivityModals';
import { adminSupabase } from '../shared/supabase';

export default function Merchants() {
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [merchants, setMerchants] = useState([]);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const loadMerchants = async () => {
    if (!adminSupabase) return;
    setLoading(true);
    setLoadError('');
    const [{ data: profiles, error: profilesError }, { data: transactions }, { data: locks }] = await Promise.all([
      // Select the complete row so the list still works before optional merchant-control
      // columns are installed in an older Supabase project.
      adminSupabase.from('profiles').select('*').order('created_at', { ascending: false }),
      adminSupabase.from('wallet_transactions').select('seller_id,amount'),
      adminSupabase.from('balance_locks').select('seller_id,amount,status,lock_until'),
    ]);
    if (profilesError) {
      setMerchants([]);
      setLoadError(`Could not load seller accounts: ${profilesError.message}`);
    } else if (profiles) {
      const sellerProfiles = profiles.filter((profile) => String(profile.role || '').trim().toLowerCase() === 'seller');
      const totals = (transactions || []).reduce((map, entry) => ({ ...map, [entry.seller_id]: (map[entry.seller_id] || 0) + Number(entry.amount || 0) }), {});
      const frozen = (locks || []).filter((entry) => entry.status === 'Active' && (!entry.lock_until || new Date(entry.lock_until) > new Date())).reduce((map, entry) => ({ ...map, [entry.seller_id]: (map[entry.seller_id] || 0) + Number(entry.amount || 0) }), {});
      setMerchants(sellerProfiles.map((profile) => ({ userId: profile.id, id: profile.id.slice(0, 8).toUpperCase(), name: profile.email || 'Seller', email: profile.email, balance: `$${(totals[profile.id] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, frozen: `$${(frozen[profile.id] || 0).toFixed(2)} frozen`, credit: profile.credit_score ?? 100, status: profile.allow_login === false ? 'Suspended' : 'Active' })));
    }
    setLoading(false);
  };
  useEffect(() => { loadMerchants(); }, []);
  const visible = useMemo(() => merchants.filter((merchant) => (statusFilter === 'All' || merchant.status === statusFilter) && [merchant.name, merchant.email, merchant.id].some((value) => value.toLowerCase().includes(search.toLowerCase()))), [merchants, statusFilter, search]);
  const otherActions = [['Reset Pwd','orange'],['Edit','slate'],['Risk Control','purple'],['Kick','red'],['Login','dark'],['Showcase','teal'],['Order','indigo'],['Add Clicks','cyan'],['Stop Clicks','amber'],['Click Logs','gray'],['Lock Shop','crimson']];
  return <div className="merchants-page">
    <div className="merchants-header"><div><h2>Merchant List</h2><p>Active registered merchants. {visible.length} of {merchants.length} shown</p></div><div className="merchants-header-actions"><button className="merchant-top-btn">⌕ Filters</button><button className="merchant-icon-btn" onClick={loadMerchants} disabled={loading}>{loading ? '…' : '↻'}</button></div></div>
    <div className="merchant-toolbar"><div className="merchant-search-box"><span>⌕</span><input type="search" placeholder="Search by name, email, ID, referral code..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="merchant-filter-buttons">{['All','Active','Suspended'].map((item) => <button key={item} className={`merchant-filter-btn ${statusFilter === item ? 'active' : ''}`} onClick={() => setStatusFilter(item)}>{item}</button>)}</div></div>
    {loadError && <div className="merchant-load-message error">{loadError}</div>}
    {!loading && !loadError && merchants.length === 0 && <div className="merchant-load-message">No seller profile exists in Supabase yet. Create the seller Auth user, then assign that profile the <strong>seller</strong> role.</div>}
    <div className="merchant-table-wrapper"><table className="merchant-table"><thead><tr><th>ID</th><th>MERCHANT</th><th>EMAIL</th><th>BALANCE</th><th>CREDIT</th><th>STATUS</th><th>ACTIONS</th><th /></tr></thead><tbody>{visible.map((merchant) => <tr key={merchant.id}><td className="merchant-id">{merchant.id}</td><td><div className="merchant-profile"><div className="merchant-avatar">{merchant.name[0].toUpperCase()}</div><strong>{merchant.name}</strong></div></td><td className="merchant-email">{merchant.email}</td><td className="merchant-balance">{merchant.balance}</td><td><span className={`credit-pill ${merchant.credit < 100 ? 'warning' : ''}`}>{merchant.credit}</span></td><td><span className={`status-pill ${merchant.status === 'Active' ? 'active-status' : ''}`}>{merchant.status}</span></td><td><div className="merchant-action-buttons"><button className="action-btn green" onClick={() => setModal({ merchant, action: 'Balance', kind: 'finance' })}>Balance</button><button className="action-btn yellow" onClick={() => setModal({ merchant, action: 'Lock', kind: 'finance' })}>Lock</button><button className="action-btn gray" onClick={() => setModal({ merchant, action: 'Logs', kind: 'finance' })}>Logs</button><button className="action-btn blue" onClick={() => setModal({ merchant, action: 'Payment', kind: 'finance' })}>Payment</button>{otherActions.map(([label,tone]) => <button className={`action-btn ${tone}`} key={label} onClick={() => setModal({ merchant, action: label, kind: ['Order','Add Clicks','Stop Clicks','Click Logs','Lock Shop'].includes(label) ? 'activity' : 'control' })}>{label}</button>)}</div></td><td><div className="merchant-manage-links"><button onClick={() => setModal({ merchant, action: 'Details', kind: 'activity' })}>Details ›</button><button className="manage" onClick={() => setModal({ merchant, action: 'Manage', kind: 'activity' })}>Manage ›</button></div></td></tr>)}</tbody></table></div>
    {modal?.kind === 'finance' && <MerchantFinanceModals client={adminSupabase} merchant={modal.merchant} action={modal.action} actor="Admin" onClose={() => setModal(null)} onChanged={loadMerchants} />}
    {modal?.kind === 'control' && <MerchantControlModals client={adminSupabase} merchant={modal.merchant} action={modal.action} onClose={() => setModal(null)} onChanged={loadMerchants} />}
    {modal?.kind === 'activity' && <MerchantActivityModals client={adminSupabase} merchant={modal.merchant} action={modal.action} onClose={() => setModal(null)} onChanged={loadMerchants} openAction={(action) => setModal({ merchant: modal.merchant, action, kind: ['Balance','Lock','Logs','Payment'].includes(action) ? 'finance' : ['Reset Pwd','Edit','Risk Control','Kick','Login','Showcase'].includes(action) ? 'control' : 'activity' })} />}
  </div>;
}
