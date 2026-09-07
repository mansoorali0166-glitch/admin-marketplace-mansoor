import React, { useEffect, useMemo, useState } from 'react';
import './MerchantActivityModals.css';

export default function MerchantActivityModals({ client, merchant, action, onClose, onChanged, openAction, actor = 'Admin' }) {
  const [tab, setTab] = useState(action === 'Order' ? 'Orders' : action === 'Manage' ? 'Balance' : 'Overview');
  const [orders, setOrders] = useState([]);
  const [txns, setTxns] = useState([]);
  const [locks, setLocks] = useState([]);
  const [clicks, setClicks] = useState([]);
  const [profile, setProfile] = useState(null);
  const [showcaseProducts, setShowcaseProducts] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [clickCreators, setClickCreators] = useState({});
  const [count, setCount] = useState('');
  const [clickAdjustment, setClickAdjustment] = useState('add');
  const [source, setSource] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingClicks, setLoadingClicks] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [showOrderForm, setShowOrderForm] = useState(action === 'Order');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('all');
  const [logSearch, setLogSearch] = useState('');
  const [logCategory, setLogCategory] = useState('all');
  const [orderDraft, setOrderDraft] = useState({ product_id: '', product_name: '', buyer_id: '', customer_name: '', shipping_address: '', quantity: 1, sell_price: '', cost_price: '', status: 'Pending Ship' });

  const load = async () => {
    if (!merchant?.userId) return;
    setLoadingClicks(true);
    const [orderRes, txnRes, lockRes, clickRes, profileRes, showcaseRes, buyersRes] = await Promise.all([
      client.from('orders').select('*').eq('seller_id', merchant.userId).order('created_at', { ascending: false }),
      client.from('wallet_transactions').select('*').eq('seller_id', merchant.userId).order('created_at', { ascending: false }),
      client.from('balance_locks').select('*').eq('seller_id', merchant.userId).order('created_at', { ascending: false }),
      client.from('merchant_clicks').select('*').eq('seller_id', merchant.userId).order('created_at', { ascending: false }),
      client.from('profiles').select('*').eq('id', merchant.userId).maybeSingle(),
      client.from('showcase_products').select('on_shelf,products(id,name,product_code,sell_price,cost_price)').eq('seller_id', merchant.userId),
      client.from('virtual_buyers').select('*').order('name'),
    ]);
    setOrders(orderRes.data || []); setTxns(txnRes.data || []); setLocks(lockRes.data || []); setClicks(clickRes.data || []); setProfile(profileRes.data || null);
    setShowcaseProducts((showcaseRes.data || []).filter((row) => row.on_shelf && row.products).map((row) => row.products));
    setBuyers(buyersRes.data || []);
    const creatorIds = [...new Set((clickRes.data || []).map((row) => row.created_by).filter(Boolean))];
    if (creatorIds.length) {
      const { data: creatorRows } = await client.from('profiles').select('id,display_name,email,role').in('id', creatorIds);
      setClickCreators(Object.fromEntries((creatorRows || []).map((row) => [row.id, row.display_name || row.email])));
    } else {
      setClickCreators({});
    }
    setLoadingClicks(false);
  };
  useEffect(() => { load(); setTab(action === 'Order' ? 'Orders' : action === 'Manage' ? 'Balance' : 'Overview'); setShowOrderForm(action === 'Order'); }, [merchant?.userId, action]);
  const normalizeStatus = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  const adjustmentParts = (row) => {
    const [prefix, type, amount, ...labelParts] = String(row.source || '').split(':');
    if (prefix !== 'adjustment') return null;
    return { type, amount: Number(amount || 0), label: decodeURIComponent(labelParts.join(':') || '') };
  };
  const isAuditOnlyLog = (row) => ['remove', 'stop'].includes(adjustmentParts(row)?.type);
  const activeClicks = useMemo(() => clicks.filter((row) => !isAuditOnlyLog(row)), [clicks]);
  const totals = useMemo(() => ({ revenue: orders.reduce((sum, row) => sum + Number(row.sell_price || row.amount || 0) * Number(row.quantity || 1), 0), profit: orders.reduce((sum, row) => sum + (Number(row.sell_price || 0) - Number(row.cost_price || 0)) * Number(row.quantity || 1), 0), completed: orders.filter((row) => normalizeStatus(row.status) === 'completed').length }), [orders]);
  const visibleOrders = useMemo(() => orders.filter((row) => {
    const haystack = [row.order_no, row.product_name, row.customer_name, row.shipping_address, row.status].join(' ').toLowerCase();
    return (!orderSearch || haystack.includes(orderSearch.toLowerCase())) && (orderStatus === 'all' || row.status === orderStatus);
  }), [orders, orderSearch, orderStatus]);
  const activityLogs = useMemo(() => {
    const clickRows = clicks.map((row) => ({ id: `click-${row.id}`, created_at: row.created_at, category: ['login','logout','order','balance','password','faq','api','automation','account'].includes(String(row.source).toLowerCase()) ? String(row.source).toLowerCase() : 'product click', action: row.source || 'product_click', actor: row.created_by ? 'admin' : 'seller', ip: row.ip_address, device: row.device, details: row.source || 'click' }));
    const txnRows = txns.map((row) => ({ id: `txn-${row.id}`, created_at: row.created_at, category: 'balance', action: String(row.type || 'balance').toLowerCase().replace(/\s+/g, '_'), actor: 'admin', details: row.note || `$${Number(row.amount || 0).toFixed(2)}` }));
    const orderRows = orders.map((row) => ({ id: `order-${row.id}`, created_at: row.created_at, category: 'order', action: `order_${normalizeStatus(row.status) || 'created'}`, actor: 'seller', details: `${row.order_no || row.id} · ${row.product_name || 'Order'}` }));
    return [...clickRows, ...txnRows, ...orderRows].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  }, [clicks, txns, orders]);
  const visibleLogs = useMemo(() => activityLogs.filter((row) => {
    const haystack = [row.category,row.action,row.actor,row.ip,row.device,row.details].join(' ').toLowerCase();
    return (!logSearch || haystack.includes(logSearch.toLowerCase())) && (logCategory === 'all' || row.category === logCategory);
  }), [activityLogs, logSearch, logCategory]);
  const adjustClicks = async (event) => {
    event.preventDefault();
    const numeric = Math.floor(Number(count));
    if (!numeric || numeric < 1 || numeric > 10000) return setMessage('Enter a click count from 1 to 10,000.');
    if (clickAdjustment === 'remove' && numeric > activeClicks.length) return setMessage(`Only ${activeClicks.length.toLocaleString()} clicks are available to remove.`);
    setBusy(true);
    setMessage('');
    setSuccessMessage('');
    const { data: authData } = await client.auth.getUser();
    const createdBy = authData?.user?.id || null;
    const batchTimestamp = new Date().toISOString();
    let error = null;
    if (clickAdjustment === 'add') {
      const label = encodeURIComponent(source.trim() || actor);
      const rows = Array.from({ length: numeric }, () => ({ seller_id: merchant.userId, source: `adjustment:add:${numeric}:${label}`, created_by: createdBy, created_at: batchTimestamp }));
      ({ error } = await client.from('merchant_clicks').insert(rows));
      if (!error) await client.from('profiles').update({ traffic_enabled: true }).eq('id', merchant.userId);
    } else {
      const ids = activeClicks.slice(0, numeric).map((row) => row.id);
      for (let index = 0; index < ids.length && !error; index += 500) {
        ({ error } = await client.from('merchant_clicks').delete().in('id', ids.slice(index, index + 500)));
      }
      if (!error) {
        const label = encodeURIComponent(source.trim() || actor);
        ({ error } = await client.from('merchant_clicks').insert({ seller_id: merchant.userId, source: `adjustment:remove:${numeric}:${label}`, created_by: createdBy, created_at: batchTimestamp }));
      }
    }
    setBusy(false);
    if (error) return setMessage(error.message);
    setCount('');
    setSource('');
    setSuccessMessage(clickAdjustment === 'add' ? 'Clicks successfully added.' : 'Clicks successfully removed.');
    await load();
    onChanged?.();
  };
  const selectOrderProduct = (productId) => {
    const product = showcaseProducts.find((item) => String(item.id) === productId);
    setOrderDraft((current) => ({
      ...current,
      product_id: productId,
      product_name: product?.name || product?.product_code || '',
      sell_price: product ? String(product.sell_price ?? '') : current.sell_price,
      cost_price: product ? String(product.cost_price ?? '') : current.cost_price,
    }));
  };
  const selectOrderBuyer = (buyerId) => {
    const buyer = buyers.find((item) => String(item.id) === buyerId);
    setOrderDraft((current) => ({
      ...current,
      buyer_id: buyerId,
      customer_name: buyer?.name || '',
      shipping_address: buyer
        ? [buyer.address, buyer.city, buyer.state, buyer.postal, buyer.country].filter(Boolean).join(', ')
        : current.shipping_address,
    }));
  };
  const createOrder = async (event) => { event.preventDefault(); setBusy(true); const payload = { seller_id: merchant.userId, order_no: `MH${Date.now()}`, product_name: orderDraft.product_name.trim(), customer_name: orderDraft.customer_name.trim(), shipping_address: orderDraft.shipping_address.trim(), quantity: Number(orderDraft.quantity || 1), sell_price: Number(orderDraft.sell_price || 0), cost_price: Number(orderDraft.cost_price || 0), status: orderDraft.status }; const { error } = await client.from('orders').insert(payload); setBusy(false); if (error) return setMessage(error.message); setOrderDraft({ product_id: '', product_name: '', buyer_id: '', customer_name: '', shipping_address: '', quantity: 1, sell_price: '', cost_price: '', status: 'Pending Ship' }); setShowOrderForm(false); setMessage('Order created successfully.'); await load(); onChanged?.(); };
  const updateOrderStatus = async (id, status) => { setBusy(true); const { error } = await client.from('orders').update({ status }).eq('id', id).eq('seller_id', merchant.userId); setBusy(false); if (error) return setMessage(error.message); await load(); onChanged?.(); };
  const exportLogs = () => { const fields = ['created_at','category','action','actor','ip','device','details']; const csv = [fields.join(','), ...visibleLogs.map(row => fields.map(key => `"${String(row[key] || '').replace(/"/g,'""')}"`).join(','))].join('\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const link = document.createElement('a'); link.href = url; link.download = `${merchant.name || 'seller'}-activity.csv`; link.click(); URL.revokeObjectURL(url); };
  const updateShop = async (values) => { setBusy(true); const { error } = await client.from('profiles').update(values).eq('id', merchant.userId); setBusy(false); if (error) return setMessage(error.message); onChanged?.(); onClose(); };
  const stopClicks = async () => {
    setBusy(true); setMessage('');
    const { data: authData } = await client.auth.getUser();
    const { error: profileError } = await client.from('profiles').update({ traffic_enabled: false }).eq('id', merchant.userId);
    let error = profileError;
    if (!error) {
      const label = encodeURIComponent(actor);
      ({ error } = await client.from('merchant_clicks').insert({ seller_id: merchant.userId, source: `adjustment:stop:0:${label}`, created_by: authData?.user?.id || null, created_at: new Date().toISOString() }));
    }
    setBusy(false);
    if (error) return setMessage(error.message);
    await load(); onChanged?.(); onClose();
  };
  if (!merchant || !action) return null;
  const Header = ({ title }) => <header><div className="activity-identity"><b>{merchant.name?.[0]?.toUpperCase()}</b><div><h3>{title}</h3><p>{merchant.email}</p></div></div><button type="button" onClick={onClose}>×</button></header>;
  if (action === 'Add Clicks') return <div className="merchant-activity-overlay"><form className="merchant-activity-modal compact" onSubmit={adjustClicks}><Header title="Adjust Traffic Clicks" /><select aria-label="Click adjustment type" value={clickAdjustment} onChange={(e) => { setClickAdjustment(e.target.value); setMessage(''); setSuccessMessage(''); }} style={{ boxSizing: 'border-box', width: '100%', padding: 12, margin: '5px 0', border: '1px solid #dce2ea', borderRadius: 10, background: '#fff' }}><option value="add">Add clicks</option><option value="remove">Remove clicks</option></select><input type="number" min="1" max="10000" required placeholder={`Number of clicks to ${clickAdjustment}`} value={count} onChange={(e) => { setCount(e.target.value); setSuccessMessage(''); }} /><input placeholder="Reason or source label (optional)" value={source} onChange={(e) => { setSource(e.target.value); setSuccessMessage(''); }} />{busy && <p role="status" aria-live="polite" style={{ color: '#2563eb', fontSize: 12 }}>◌ Processing click adjustment…</p>}{successMessage && <p role="status" aria-live="polite" style={{ color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 10, fontSize: 13 }}>{successMessage}</p>}{message && <p className="activity-error">{message}</p>}<footer><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button disabled={busy}>{busy ? 'Processing…' : clickAdjustment === 'add' ? 'Add Clicks' : 'Remove Clicks'}</button></footer></form></div>;
  if (action === 'Click Logs') {
    const batchMap = new Map();
    clicks.forEach((row) => {
      const adjustment = adjustmentParts(row);
      if (adjustment?.type === 'remove' || adjustment?.type === 'stop') {
        const adjustedBy = clickCreators[row.created_by] || adjustment.label || 'Unknown';
        batchMap.set(`${adjustment.type}-${row.id}`, { key: `${adjustment.type}-${row.id}`, adjustedBy, change: adjustment.type === 'stop' ? 'Stopped' : -adjustment.amount, date: row.created_at, ip: row.ip_address || '—', device: row.device || '—' });
        return;
      }
      if (adjustment?.type === 'add') {
        const key = `add-${row.created_by || 'none'}-${row.created_at}`;
        if (!batchMap.has(key)) batchMap.set(key, { key, adjustedBy: clickCreators[row.created_by] || adjustment.label || 'Unknown', change: adjustment.amount, date: row.created_at, ip: row.ip_address || '—', device: row.device || '—' });
        return;
      }
      const addedBy = clickCreators[row.created_by] || row.source || 'Unknown';
      const key = `${row.created_by || 'none'}::${row.created_at}`;
      if (!batchMap.has(key)) {
        batchMap.set(key, { key, adjustedBy: addedBy, change: 0, date: row.created_at, ip: row.ip_address || '—', device: row.device || '—' });
      }
      batchMap.get(key).change += 1;
    });
    const batches = Array.from(batchMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
    return <div className="merchant-activity-overlay"><section className="merchant-activity-modal click-log"><Header title="Click Logs" />{loadingClicks ? <p role="status" aria-live="polite" className="activity-empty">◌ Loading click history…</p> : <div className="activity-table"><div className="activity-row head"><span>DATE</span><span>ADJUSTED BY</span><span>CHANGE</span><span>IP</span><span>DEVICE</span></div>{batches.map((batch) => { const numericChange = typeof batch.change === 'number'; return <div className="activity-row" key={batch.key}><time>{new Date(batch.date).toLocaleString()}</time><span>{batch.adjustedBy}</span><b style={{ color: numericChange && batch.change < 0 ? '#dc2626' : batch.change === 'Stopped' ? '#d97706' : '#2563eb', background: numericChange && batch.change < 0 ? '#fff1f2' : batch.change === 'Stopped' ? '#fffbeb' : '#eef5ff' }}>{numericChange ? `${batch.change > 0 ? '+' : ''}${batch.change.toLocaleString()}` : batch.change}</b><span>{batch.ip}</span><span>{batch.device}</span></div>; })}{!batches.length && <p className="activity-empty">No click adjustment history.</p>}</div>}</section></div>;
  }
  if (action === 'Stop Clicks') return <div className="merchant-activity-overlay"><section className="merchant-activity-modal compact"><Header title="Stop Traffic Clicks" /><p>Disable traffic generation for this merchant?</p>{message && <p className="activity-error">{message}</p>}<footer><button onClick={onClose} disabled={busy}>Cancel</button><button className="amber" disabled={busy} onClick={stopClicks}>{busy ? 'Stopping…' : 'Stop Clicks'}</button></footer></section></div>;
  if (action === 'Resume Clicks') return <div className="merchant-activity-overlay"><section className="merchant-activity-modal compact"><Header title="Resume Clicks" /><p>Resume automated click delivery for this seller?</p>{message && <p className="activity-error">{message}</p>}<footer><button onClick={onClose}>Cancel</button><button disabled={busy} onClick={() => updateShop({ traffic_enabled: true })}>Confirm</button></footer></section></div>;
  if (action === 'Lock Account') return <div className="merchant-activity-overlay"><section className="merchant-activity-modal compact"><Header title="Lock Account" /><p>This seller will not be able to log in, receive orders, or manage products until unlocked.</p>{message && <p className="activity-error">{message}</p>}<footer><button onClick={onClose}>Cancel</button><button className="red" disabled={busy} onClick={() => updateShop({ allow_login: false })}>Confirm</button></footer></section></div>;
  if (action === 'Unlock Account') return <div className="merchant-activity-overlay"><section className="merchant-activity-modal compact"><Header title="Unlock Account" /><p>This seller will be able to log in again immediately.</p>{message && <p className="activity-error">{message}</p>}<footer><button onClick={onClose}>Cancel</button><button disabled={busy} onClick={() => updateShop({ allow_login: true })}>Confirm</button></footer></section></div>;
  if (action === 'Lock Shop') return <div className="merchant-activity-overlay"><section className="merchant-activity-modal compact"><Header title="Lock Shop" /><p>The seller's shop will be disabled immediately. Products will be hidden from customers and new orders will be blocked. The seller can still log in, but cannot access their shop until you unlock it.</p>{message && <p className="activity-error">{message}</p>}<footer><button onClick={onClose}>Cancel</button><button className="red" disabled={busy} onClick={() => updateShop({ shop_locked: true, showcase_visible: false })}>Confirm</button></footer></section></div>;
  if (action === 'Unlock Shop') return <div className="merchant-activity-overlay"><section className="merchant-activity-modal compact"><Header title="Unlock Shop" /><p>The seller's shop will be re-enabled. Products will be visible again and new orders will be allowed.</p>{message && <p className="activity-error">{message}</p>}<footer><button onClick={onClose}>Cancel</button><button disabled={busy} onClick={() => updateShop({ shop_locked: false, showcase_visible: true })}>Confirm</button></footer></section></div>;

  const managing = action === 'Manage';
  const detailsDrawer = action === 'Details';
  const tabs = managing ? [['Balance',txns.length],['Orders',orders.length],['Click Scripts',0],['Click Logs',clicks.length]] : [['Overview',1],['Orders',orders.length],['Txns',txns.length],['Locks',locks.length],['Clicks',activeClicks.length],['Info',1]];
  return <div className={`merchant-activity-overlay ${managing ? 'manage-workspace-overlay' : ''} ${detailsDrawer ? 'merchant-details-drawer-overlay' : ''}`}><section className={`merchant-activity-modal details ${managing ? 'manage-workspace' : ''} ${detailsDrawer ? 'merchant-details-drawer' : ''}`}>{managing ? <><button type="button" className="manage-back" onClick={onClose}>← Back</button><div className="manage-merchant-header"><div><h2>{merchant.name} {profile?.traffic_enabled === false && <small>CLICKS PAUSED</small>}</h2><p>{merchant.email} · {profile?.referral_code || merchant.id}</p></div><div className="manage-action-bar"><button onClick={() => openAction?.('Balance')}>＄ Adjust Balance</button><button onClick={() => openAction?.('Reset Pwd')}>⚿ Reset Password</button><button onClick={() => openAction?.('Lock Account')}>▣ Lock Account</button><button onClick={() => openAction?.('Login')}>↪ Login as Seller</button><button onClick={() => openAction?.(profile?.traffic_enabled === false ? 'Resume Clicks' : 'Stop Clicks')}>◉ {profile?.traffic_enabled === false ? 'Resume' : 'Stop'} Clicks</button><button onClick={() => openAction?.('Add Clicks')}>⌁ Add Clicks</button><button onClick={() => setTab('Click Logs')}>〽 Click Logs</button><button className="danger" onClick={() => openAction?.('Lock Shop')}>▣ Lock Shop</button></div></div></> : <Header title={merchant.name} />}<nav>{tabs.map(([name,total]) => <button type="button" className={tab === name ? 'active' : ''} onClick={() => setTab(name)} key={name}>{name} {!managing && name !== 'Overview' && name !== 'Info' ? `(${total})` : ''}</button>)}</nav>
    {tab === 'Balance' && <div className="manage-balance"><div className="manage-stat-grid">{[['AVAILABLE BALANCE',merchant.balance],['PENDING BALANCE','$0.00'],['TOTAL EARNINGS',`$${totals.revenue.toFixed(2)}`],['WITHDRAWN','$0.00'],['FROZEN BALANCE',`$${locks.filter(x=>x.status==='Active').reduce((s,x)=>s+Number(x.amount||0),0).toFixed(2)}`]].map(([a,b])=><article key={a}><span>{a}</span><strong>{b}</strong></article>)}</div><section className="manage-bank"><h3>▱ Bank Account</h3><p>No bank account linked yet.</p></section><section className="manage-history"><header><h3>Transaction History</h3><button type="button" onClick={() => openAction?.('Balance')}>＋ Add / Deduct</button></header><SimpleRows rows={txns} empty="No transactions yet." render={(row)=><><time>{new Date(row.created_at).toLocaleString()}</time><b>{row.type}</b><strong>${Number(row.amount||0).toFixed(2)}</strong><span>{row.note||'—'}</span></>}/></section></div>}
    {tab === 'Click Scripts' && <section className="manage-scripts"><header><div><h3>Click Scripts</h3><p>Manage automated click items for this seller's store.</p></div><button type="button" onClick={() => openAction?.('Add Clicks')}>＋ Add Click Item</button></header><p>No click items for this seller yet. Add the first one to enable automated clicks.</p></section>}
    {tab === 'Click Logs' && <section className="manage-table-card"><div className="manage-table-tools"><input placeholder="Search action / IP / device..." value={logSearch} onChange={(e)=>setLogSearch(e.target.value)}/><select value={logCategory} onChange={(e)=>setLogCategory(e.target.value)}>{['all','login','logout','product click','order','balance','password','faq','api','automation','account'].map(x=><option value={x} key={x}>{x === 'all' ? 'All categories' : x}</option>)}</select><button type="button" onClick={exportLogs}>⇩ Export CSV</button></div><div className="manage-table-scroll"><div className="activity-table manage-clicks"><div className="activity-row head"><span>DATE &amp; TIME</span><span>CATEGORY</span><span>ACTION</span><span>ACTOR</span><span>IP ADDRESS</span><span>DEVICE / BROWSER</span><span>DETAILS</span></div>{visibleLogs.map(row=><div className="activity-row" key={row.id}><time>{new Date(row.created_at).toLocaleString()}</time><b>{row.category}</b><span>{row.action}</span><span>{row.actor}</span><span>{row.ip||'—'}</span><span>{row.device||'—'}</span><span>{row.details||'—'}</span></div>)}{!visibleLogs.length&&<p className="activity-empty">No activity logs.</p>}</div></div></section>}
    {tab === 'Overview' && <div className="overview-panels"><Panel title="WALLET & BALANCES" items={[['AVAILABLE',merchant.balance],['FROZEN','$0.00'],['SETTLED','$0.00'],['UNSETTLED','$0.00'],['ACTIVE LOCKS',`$${locks.filter(x=>x.status==='Active').reduce((s,x)=>s+Number(x.amount||0),0).toFixed(2)}`],['TOTAL REVENUE',`$${totals.revenue.toFixed(2)}`]]}/><Panel title="PERFORMANCE" items={[['TOTAL ORDERS',orders.length],['COMPLETED',totals.completed],['TOTAL PROFIT',`$${totals.profit.toFixed(2)}`],['CLICK COUNT',clicks.length]]}/><div className="store-controls"><h4>STORE CONTROLS</h4><button onClick={() => updateShop({ showcase_visible: !(profile?.showcase_visible !== false) })}>◉ Showcase {profile?.showcase_visible === false ? 'Hidden' : 'Visible'}</button><button onClick={() => updateShop({ traffic_enabled: !(profile?.traffic_enabled !== false) })}>⌁ Traffic {profile?.traffic_enabled === false ? 'Off' : 'On'}</button><button className="orange" onClick={() => updateShop({ shop_locked: true })}>♙ Lock Shop</button><button className="red" onClick={() => updateShop({ allow_login: false })}>⊘ Suspend Account</button></div><div className="quick-actions"><h4>QUICK ACTIONS</h4>{['Balance','Lock','Logs','Payment','Reset Pwd','Edit','Risk Control','Login','Showcase','Add Clicks','Stop Clicks','Click Logs','Lock Shop'].map((item) => <button key={item} onClick={() => openAction?.(item)}>{item}</button>)}</div></div>}
    {tab === 'Orders' && <div className="merchant-orders-tab"><div className="manage-table-tools order-tools"><input placeholder="Search orders..." value={orderSearch} onChange={(e)=>setOrderSearch(e.target.value)}/><select value={orderStatus} onChange={(e)=>setOrderStatus(e.target.value)}>{['all','Pending Ship','Pending Receive','Shipped','Completed','Refund','Cancelled'].map(x=><option value={x} key={x}>{x === 'all' ? 'All statuses' : x}</option>)}</select><button type="button" className="new-merchant-order" onClick={() => setShowOrderForm(!showOrderForm)}>＋ Create Order</button></div>{showOrderForm && <form className="merchant-order-form" onSubmit={createOrder}>
  <select required value={orderDraft.product_id} onChange={(e)=>selectOrderProduct(e.target.value)}>
    <option value="">— Select product from showcase —</option>
    {showcaseProducts.map((product) => <option key={product.id} value={product.id}>{product.name || product.product_code} · ${Number(product.sell_price || 0).toFixed(2)}</option>)}
  </select>
  {!showcaseProducts.length && <p className="activity-empty">This seller has no on-shelf products in their showcase yet.</p>}
  <select required value={orderDraft.buyer_id} onChange={(e)=>selectOrderBuyer(e.target.value)}>
    <option value="">— Select virtual buyer —</option>
    {buyers.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.name}{buyer.phone ? ` · ${buyer.phone}` : ''}</option>)}
  </select>
  {!buyers.length && <p className="activity-empty">No virtual buyers found. Add one under Virtual Buyers first.</p>}
  <input placeholder="Shipping address" value={orderDraft.shipping_address} onChange={(e)=>setOrderDraft({...orderDraft,shipping_address:e.target.value})}/>
  <input type="number" min="1" placeholder="Quantity" value={orderDraft.quantity} onChange={(e)=>setOrderDraft({...orderDraft,quantity:e.target.value})}/>
  <input type="number" min="0" step="0.01" required placeholder="Sell price" value={orderDraft.sell_price} onChange={(e)=>setOrderDraft({...orderDraft,sell_price:e.target.value})}/>
  <input type="number" min="0" step="0.01" placeholder="Cost price" value={orderDraft.cost_price} onChange={(e)=>setOrderDraft({...orderDraft,cost_price:e.target.value})}/>
  <select value={orderDraft.status} onChange={(e)=>setOrderDraft({...orderDraft,status:e.target.value})}>{['Pending Ship','Pending Receive','Shipped','Completed','Refund','Cancelled'].map(x=><option key={x}>{x}</option>)}</select>
  <button disabled={busy || !orderDraft.product_id}>Create Order</button>
</form>}{message && <p className="activity-message">{message}</p>}<div className="manage-table-scroll"><div className="order-management-table"><div className="order-management-row head"><span>ORDER</span><span>PRODUCT</span><span>AMOUNT</span><span>STATUS</span><span>SHIPPING</span><span>DATE</span><span>ACTIONS</span></div>{visibleOrders.map(row=><div className="order-management-row" key={row.id}><b>{row.order_no||row.id}</b><span>{row.product_name||'—'}</span><strong>${(Number(row.sell_price||0)*Number(row.quantity||1)).toFixed(2)}</strong><span>{row.status||'—'}</span><span>{row.shipping_address||'—'}</span><time>{new Date(row.created_at).toLocaleString()}</time><select value={row.status} disabled={busy} onChange={(e)=>updateOrderStatus(row.id,e.target.value)}>{['Pending Ship','Pending Receive','Shipped','Completed','Refund','Cancelled'].map(x=><option key={x}>{x}</option>)}</select></div>)}{!visibleOrders.length&&<p className="activity-empty">No orders found.</p>}</div></div></div>} 
    {tab === 'Txns' && <SimpleRows rows={txns} empty="No transactions found." render={(row)=><><b>{row.type}</b><span>{row.note || '—'}</span><strong>${Number(row.amount||0).toFixed(2)}</strong><time>{new Date(row.created_at).toLocaleString()}</time></>}/>} 
    {tab === 'Locks' && <SimpleRows rows={locks} empty="No balance locks." render={(row)=><><b>${Number(row.amount||0).toFixed(2)}</b><span>{row.reason}</span><span>{row.status}</span><time>{new Date(row.created_at).toLocaleString()}</time></>}/>} 
    {tab === 'Clicks' && <div className="activity-table"><div className="activity-row head"><span>DATE & TIME</span><span>IP</span><span>DEVICE</span><span>SOURCE</span></div>{activeClicks.map(row=><div className="activity-row" key={row.id}><time>{new Date(row.created_at).toLocaleString()}</time><span>{row.ip_address||'—'}</span><span>{row.device||'—'}</span><b>{row.source||'click'}</b></div>)}</div>}
    {tab === 'Info' && <div className="profile-info"><h4>PROFILE DETAILS</h4>{[['Store Name',merchant.name],['Email',merchant.email],['User ID',merchant.userId],['Referral Code',profile?.referral_code || merchant.id],['Assigned Agent',profile?.agent_id || '—'],['Credit Score',profile?.credit_score ?? merchant.credit],['Click Count',clicks.length],['Remark',profile?.merchant_remark || '—'],['Registered',profile?.created_at ? new Date(profile.created_at).toLocaleString() : '—']].map(([a,b])=><p key={a}><span>{a}</span><strong>{b}</strong></p>)}</div>}
  </section></div>;
}
const Panel=({title,items})=><div className="overview-panel"><h4>{title}</h4><div>{items.map(([a,b])=><p key={a}><span>{a}</span><strong>{b}</strong></p>)}</div></div>;
const SimpleRows=({rows,empty,render})=><div className="simple-rows">{rows.map(row=><article key={row.id}>{render(row)}</article>)}{!rows.length&&<p className="activity-empty">{empty}</p>}</div>;
