import React, { useEffect, useMemo, useState } from 'react';
import './SellerLogin.css';
import './SellerPortal.css';
import SellerMessages from './SellerMessages';
import SellerWallet from './SellerWallet';
import SellerShowcase from './SellerShowcase';
import SellerOrders from './SellerOrders';
import SellerInvite from './SellerInvite';
import SellerFeedback from './SellerFeedback';
import SellerService from './SellerService';
import { adminSupabase, agentSupabase, sellerSupabase } from '../shared/supabase';
import { readImageFile } from '../shared/avatar';
import AvatarCropper from '../shared/AvatarCropper';

const periods = ['Today', 'This Week', 'This Month', 'Total'];
const faqs = [
  ['What is the MarketHub online store?', 'It is a demo marketplace where sellers can showcase products and manage orders.'],
  ["Why can't I stop selling?", 'Please complete or cancel any pending orders before stopping store activity.'],
  ["Why can't I recharge?", 'Confirm your payment method and contact support if the issue continues.'],
  ['Can I become a supplier?', 'Supplier applications can be submitted through the Service section.'],
  ['How long does shipping take?', 'Shipping time depends on the product and destination, but is normally shown on each order.'],
];

export default function SellerPortal({ onLogout, previewMerchant = null }) {
  const [period, setPeriod] = useState('Today');
  const [openFaq, setOpenFaq] = useState(null);
  const [shopName, setShopName] = useState(previewMerchant?.email || '');
  const [sellerView, setSellerView] = useState('home');
  const [sellerId, setSellerId] = useState(previewMerchant?.userId || null);
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [clickCount, setClickCount] = useState(0);
  const [portalClient, setPortalClient] = useState(sellerSupabase);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [cropSource, setCropSource] = useState('');
  const [showTrafficModal, setShowTrafficModal] = useState(false);
  const [trafficBusy, setTrafficBusy] = useState(false);
  const [trafficError, setTrafficError] = useState('');

  const pickShopAvatarFile = async (file) => {
    if (!file) return;
    setAvatarError('');
    try {
      setCropSource(await readImageFile(file));
    } catch (err) {
      setAvatarError(err.message || 'Could not read that image.');
    }
  };
  const uploadShopAvatar = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    pickShopAvatarFile(file);
  };
  const pasteShopAvatar = (event) => {
    const file = Array.from(event.clipboardData?.items || [])
      .find((item) => item.type.startsWith('image/'))
      ?.getAsFile();
    if (file) {
      event.preventDefault();
      pickShopAvatarFile(file);
    }
  };
  const confirmShopAvatarCrop = async (croppedDataUrl) => {
    setCropSource('');
    if (!sellerId) return;
    setAvatarBusy(true);
    setAvatarError('');
    try {
      const { error } = await portalClient
        .from('profiles')
        .update({ avatar_url: croppedDataUrl })
        .eq('id', sellerId);
      if (error) throw error;
      setProfile((current) => ({ ...current, avatar_url: croppedDataUrl }));
    } catch (err) {
      setAvatarError(err.message || 'Could not update photo.');
    }
    setAvatarBusy(false);
  };

  const resolvePortalClient = async () => {
    if (!previewMerchant) return sellerSupabase;
    const [adminSession, agentSession] = await Promise.all([
      adminSupabase.auth.getSession(),
      agentSupabase.auth.getSession(),
    ]);
    return adminSession.data.session ? adminSupabase : agentSession.data.session ? agentSupabase : sellerSupabase;
  };

  const loadSellerData = async () => {
    const client = await resolvePortalClient();
    if (client !== portalClient) setPortalClient(client);
    let id = previewMerchant?.userId || sellerId;
    if (!id) {
      const { data } = await client.auth.getUser();
      id = data.user?.id;
      if (id) setSellerId(id);
    }
    if (!id) return;
    const [profileRes, ordersRes, clicksRes] = await Promise.all([
      client.from('profiles').select('*').eq('id', id).maybeSingle(),
      client.from('orders').select('*').eq('seller_id', id).order('created_at', { ascending: false }),
      client.from('merchant_clicks').select('id', { count: 'exact' }).eq('seller_id', id).neq('source', 'free-traffic-package').not('source', 'like', 'adjustment:remove:%').not('source', 'like', 'adjustment:stop:%'),
    ]);
    if (profileRes.data) { setProfile(profileRes.data); setShopName(profileRes.data.email || ''); }
    setOrders(ordersRes.data || []);
    setClickCount(clicksRes.count || clicksRes.data?.length || 0);
  };
  useEffect(() => {
    loadSellerData();
    const channel = sellerId
      ? portalClient
          .channel(`seller-home-${sellerId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${sellerId}` }, loadSellerData)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'merchant_clicks', filter: `seller_id=eq.${sellerId}` }, loadSellerData)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${sellerId}` }, (payload) => {
            loadSellerData();
            if (payload.new?.allow_login === false && !previewMerchant) {
              portalClient.auth.signOut();
              onLogout?.();
            }
          })
          .subscribe()
      : null;
    return () => { if (channel) portalClient.removeChannel(channel); };
  }, [sellerId, portalClient]);
  const metrics = useMemo(() => orders.reduce((result, row) => { const quantity = Number(row.quantity || 1); result.sales += Number(row.sell_price || 0) * quantity; result.profit += (Number(row.sell_price || 0) - Number(row.cost_price || 0)) * quantity; result.quantity += quantity; return result; }, { sales: 0, profit: 0, quantity: 0 }), [orders]);

  const freeTrafficClaimed = Boolean(profile?.free_traffic_claimed_at);
  const collectTraffic = async () => {
    if (trafficBusy || freeTrafficClaimed || previewMerchant || !profile) return;
    setTrafficBusy(true);
    setTrafficError('');
    const { data, error } = await portalClient.rpc('claim_seller_free_traffic');
    setTrafficBusy(false);
    if (error) {
      setTrafficError(error.message || 'Could not collect traffic.');
      await loadSellerData();
      return;
    }
    setProfile((current) => current ? {
      ...current,
      free_traffic_claimed_at: data.claimed_at,
    } : current);
    await loadSellerData();
  };

  if (sellerView === 'messages') return <SellerMessages client={portalClient} sellerId={sellerId} onBack={() => setSellerView('home')} />;
  if (sellerView === 'wallet') return <SellerWallet client={portalClient} sellerId={sellerId} onBack={() => setSellerView('home')} />;
  if (sellerView === 'showcase') return <SellerShowcase client={portalClient} sellerId={sellerId} shopLocked={profile?.shop_locked === true} onBack={() => setSellerView('home')} />;
  if (sellerView === 'orders') return <SellerOrders client={portalClient} sellerId={sellerId} onBack={() => setSellerView('home')} />;
  if (sellerView === 'invite') return <SellerInvite client={portalClient} sellerId={sellerId} onBack={() => setSellerView('home')} />;
  if (sellerView === 'feedback') return <SellerFeedback client={portalClient} sellerId={sellerId} onBack={() => setSellerView('home')} />;
  if (sellerView === 'service') return <SellerService client={portalClient} sellerId={sellerId} onBack={() => setSellerView('home')} />;

  return (
    <main className="seller-center-page">
      <div className="seller-center-shell">
        <header className="seller-center-topbar"><button type="button" onClick={onLogout} aria-label="Sign out">↪</button><h1>MarketHub Seller Center</h1><div><button type="button" onClick={() => setSellerView('messages')} aria-label="Messages">◌</button><button type="button" aria-label="Language">◎</button></div></header>
        <section className="seller-profile-row">
          <div
            className="seller-avatar-wrap"
            tabIndex={previewMerchant ? -1 : 0}
            onPaste={previewMerchant ? undefined : pasteShopAvatar}
          >
            {profile?.avatar_url ? (
              <img className="seller-avatar-photo" src={profile.avatar_url} alt="" />
            ) : (
              <div className="seller-avatar">{shopName.charAt(0).toUpperCase()}</div>
            )}
            {!previewMerchant && (
              <label className="seller-avatar-edit" aria-label="Change shop photo">
                {avatarBusy ? '…' : '✎'}
                <input type="file" accept="image/*" onChange={uploadShopAvatar} hidden />
              </label>
            )}
          </div>
          <div className="seller-profile-copy"><div><h2>{shopName}</h2></div><span>Credit Score {profile?.credit_score ?? 100}</span></div>
          <button className="seller-wallet-btn" type="button" onClick={() => setSellerView('wallet')}>Wallet</button>
        </section>
        {avatarError && <p className="seller-avatar-error">{avatarError}</p>}
        {cropSource && (
          <AvatarCropper
            src={cropSource}
            onCancel={() => setCropSource('')}
            onConfirm={confirmShopAvatarCrop}
          />
        )}
        <nav className="seller-primary-links"><button type="button" onClick={() => setSellerView('showcase')}>▣ <strong>Showcase</strong></button><button type="button" onClick={() => setSellerView('orders')}>▤ <strong>Orders</strong></button></nav>
        <button className="seller-traffic-banner" type="button" onClick={() => { setTrafficError(''); setShowTrafficModal(true); }}>
          <span className="seller-traffic-gift" aria-hidden="true">🎁</span>
          <span><strong>Free Traffic Package</strong></span>
          <b aria-hidden="true">›</b>
        </button>
        <div className="seller-period-tabs">{periods.map((item) => <button type="button" key={item} className={period === item ? 'active' : ''} onClick={() => setPeriod(item)}>{item}</button>)}</div>
        <section className="seller-metrics"><h2>Key Metrics</h2><div className="seller-metric-grid"><article className="sales-card"><span>Total Sales</span><strong>${metrics.sales.toFixed(2)}</strong></article><article><span>Expected Profit</span><strong>${metrics.profit.toFixed(2)}</strong></article><article><span>Order Quantity</span><strong>{metrics.quantity}</strong></article><article><span>{profile?.traffic_enabled === false ? 'Product Clicks · Stopped' : 'Product Clicks'}</span><strong>{clickCount.toLocaleString()}</strong></article></div></section>
        <section className="seller-sales-chart"><h2>Total Sales</h2><div className="chart-area"><div className="chart-y"><span>4</span><span>3</span><span>2</span><span>1</span><span>0</span></div><div className="chart-plot"><div className="chart-line">{Array.from({ length: 12 }).map((_, index) => <i key={index} />)}</div><div className="chart-times">{['00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00'].map((time) => <span key={time}>{time}</span>)}</div></div></div><div className="chart-legend"><i /> Total Sales</div></section>
        <nav className="seller-help-links"><button type="button" onClick={() => setSellerView('invite')}><b>♙＋</b><span>Invite</span></button><button type="button" onClick={() => setSellerView('feedback')}><b>⌕</b><span>Feedback</span></button><button type="button" onClick={() => setSellerView('service')}><b>♧</b><span>Service</span></button></nav>
        <section className="seller-faq"><h2>FAQ</h2>{faqs.map(([question, answer], index) => <article key={question}><button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{question}</span><b>{openFaq === index ? '⌄' : '›'}</b></button>{openFaq === index && <p>{answer}</p>}</article>)}</section>
      </div>
      {showTrafficModal && (
        <div className="seller-traffic-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && !trafficBusy && setShowTrafficModal(false)}>
          <section className="seller-traffic-modal" role="dialog" aria-modal="true" aria-labelledby="traffic-modal-title">
            <button className="seller-traffic-modal-close" type="button" aria-label="Close" disabled={trafficBusy} onClick={() => setShowTrafficModal(false)}>×</button>
            <h2 id="traffic-modal-title">Free Traffic Package</h2>
            {freeTrafficClaimed ? (
              <p className="seller-traffic-success" role="status">Free traffic successfully claimed.</p>
            ) : (
              <>
                {trafficError && <p className="seller-traffic-error" role="alert">{trafficError}</p>}
                <button className="seller-collect-traffic" type="button" disabled={trafficBusy || Boolean(previewMerchant) || !profile} onClick={collectTraffic}>{trafficBusy ? 'Claiming…' : 'Claim'}</button>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
