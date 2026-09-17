import { useEffect, useMemo, useState } from 'react';
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
  const [showcaseCount, setShowcaseCount] = useState(null);
  const [portalClient, setPortalClient] = useState(sellerSupabase);
  const [avatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [cropSource, setCropSource] = useState('');
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [portfolioBusy, setPortfolioBusy] = useState(false);
  const [portfolioError, setPortfolioError] = useState('');
  const [portfolio, setPortfolio] = useState({ name: '', storeName: '', image: '' });
  const [showTrafficModal, setShowTrafficModal] = useState(false);
  const [trafficBusy, setTrafficBusy] = useState(false);
  const [trafficError, setTrafficError] = useState('');
  const [unreadMessages, setUnreadMessages] = useState(0);

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
    setPortfolio((current) => ({ ...current, image: croppedDataUrl }));
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
    const [profileRes, ordersRes, clicksRes, showcaseRes, unreadRes] = await Promise.all([
      client.from('profiles').select('*').eq('id', id).maybeSingle(),
      client.from('orders').select('*').eq('seller_id', id).order('created_at', { ascending: false }),
      client.from('merchant_clicks').select('id', { count: 'exact' }).eq('seller_id', id).neq('source', 'free-traffic-package').not('source', 'like', 'adjustment:remove:%').not('source', 'like', 'adjustment:stop:%'),
      client.from('showcase_products').select('product_id', { count: 'exact', head: true }).eq('seller_id', id),
      client.from('messages').select('id', { count: 'exact', head: true }).eq('recipient_id', id).is('read_at', null),
    ]);
    if (profileRes.data) { setProfile(profileRes.data); setShopName(profileRes.data.store_name || profileRes.data.display_name || profileRes.data.email || ''); }
    setOrders(ordersRes.data || []);
    setClickCount(clicksRes.count || clicksRes.data?.length || 0);
    setShowcaseCount(showcaseRes.error ? null : showcaseRes.count);
    setUnreadMessages(unreadRes.error ? 0 : unreadRes.count || 0);
  };
  useEffect(() => {
    loadSellerData();
    const channel = sellerId
      ? portalClient
          .channel(`seller-home-${sellerId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${sellerId}` }, loadSellerData)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'merchant_clicks', filter: `seller_id=eq.${sellerId}` }, loadSellerData)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'showcase_products', filter: `seller_id=eq.${sellerId}` }, loadSellerData)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${sellerId}` }, loadSellerData)
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
  const metrics = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const start = period === 'Today' ? startOfToday : period === 'This Week' ? startOfWeek : period === 'This Month' ? startOfMonth : null;
    const paidStatuses = new Set(['paid', 'pending ship', 'pending receive', 'completed']);

    return orders.reduce((result, row) => {
      const status = String(row.status || '').trim().toLowerCase();
      const createdAt = row.created_at ? new Date(row.created_at) : null;
      if (!paidStatuses.has(status) || (start && (!createdAt || createdAt < start))) return result;
      const quantity = Number(row.quantity || 1);
      const revenue = Number(row.sell_price || 0) * quantity;
      const cost = Number(row.cost_price || 0) * quantity;
      result.sales += revenue;
      result.profit += revenue - cost;
      result.quantity += quantity;
      return result;
    }, { sales: 0, profit: 0, quantity: 0 });
  }, [orders, period]);

  const freeTrafficClaimed = Boolean(profile?.free_traffic_claimed_at);
  const openPortfolio = () => {
    if (previewMerchant) return;
    setPortfolioError('');
    setPortfolio({ name: profile?.display_name || '', storeName: profile?.store_name || '', image: profile?.avatar_url || '' });
    setPortfolioOpen(true);
  };
  const savePortfolio = async (event) => {
    event.preventDefault();
    if (!sellerId || !portfolio.name.trim() || !portfolio.storeName.trim()) return;
    setPortfolioBusy(true); setPortfolioError('');
    const { error } = await portalClient.from('profiles').update({
      display_name: portfolio.name.trim(), store_name: portfolio.storeName.trim(), avatar_url: portfolio.image || null,
    }).eq('id', sellerId);
    setPortfolioBusy(false);
    if (error) { setPortfolioError(error.message || 'Could not save your portfolio.'); return; }
    setProfile((current) => ({ ...current, display_name: portfolio.name.trim(), store_name: portfolio.storeName.trim(), avatar_url: portfolio.image || null }));
    setShopName(portfolio.storeName.trim());
    setPortfolioOpen(false);
  };
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
  if (sellerView === 'showcase') return <SellerShowcase client={portalClient} sellerId={sellerId} shopLocked={profile?.shop_locked === true} onBack={() => { setSellerView('home'); loadSellerData(); }} />;
  if (sellerView === 'orders') return <SellerOrders client={portalClient} sellerId={sellerId} onBack={() => setSellerView('home')} />;
  if (sellerView === 'invite') return <SellerInvite client={portalClient} sellerId={sellerId} onBack={() => setSellerView('home')} />;
  if (sellerView === 'feedback') return <SellerFeedback client={portalClient} sellerId={sellerId} onBack={() => setSellerView('home')} />;
  if (sellerView === 'service') return <SellerService client={portalClient} sellerId={sellerId} onBack={() => setSellerView('home')} />;

  return (
    <main className="seller-center-page">
      <div className="seller-center-shell">
        <header className="seller-center-topbar"><button type="button" onClick={onLogout} aria-label="Sign out">↪</button><h1>MarketHub Seller Center</h1><div><button className="seller-message-button" type="button" onClick={() => setSellerView('messages')} aria-label={unreadMessages ? `${unreadMessages} unread messages` : 'Messages'}><svg className="seller-message-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.9L3 21l1.4-4.6A9 9 0 1 1 21 11.5Z" /><circle cx="8" cy="11.5" r=".8" fill="currentColor" stroke="none" /><circle cx="12" cy="11.5" r=".8" fill="currentColor" stroke="none" /><circle cx="16" cy="11.5" r=".8" fill="currentColor" stroke="none" /></svg>{unreadMessages > 0 && <b className="seller-message-badge">{unreadMessages > 99 ? '99+' : unreadMessages}</b>}</button><button type="button" aria-label="Language">◎</button></div></header>
        <section className="seller-profile-row" onClick={openPortfolio} role={previewMerchant ? undefined : 'button'} tabIndex={previewMerchant ? undefined : 0} onKeyDown={(event) => event.key === 'Enter' && openPortfolio()}>
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
          <div className="seller-profile-copy"><div><h2>{shopName}</h2></div><span>{profile?.display_name || 'Seller'} · Credit Score {profile?.credit_score ?? 100}</span></div>
          <button className="seller-wallet-btn" type="button" onClick={(event) => { event.stopPropagation(); setSellerView('wallet'); }}>Wallet</button>
        </section>
        {avatarError && <p className="seller-avatar-error">{avatarError}</p>}
        {cropSource && (
          <AvatarCropper
            src={cropSource}
            onCancel={() => setCropSource('')}
            onConfirm={confirmShopAvatarCrop}
          />
        )}
        <nav className="seller-primary-links"><button type="button" onClick={() => setSellerView('showcase')}>▣ <strong>Showcase ({showcaseCount === null ? '…' : showcaseCount.toLocaleString()})</strong></button><button type="button" onClick={() => setSellerView('orders')}>▤ <strong>Orders</strong></button></nav>
        <button className="seller-traffic-banner seller-exposure-banner" type="button" aria-label="Free Traffic Package" onClick={() => { setTrafficError(''); setShowTrafficModal(true); }}>
          <span className="seller-exposure-brand">TikTok<br />Shop</span>
          <span className="seller-exposure-copy"><strong>Help to get <em>Free Traffic</em></strong><small><b>1,000,000</b> of Products Exposed</small></span>
        </button>
        <div className="seller-period-tabs">{periods.map((item) => <button type="button" key={item} className={period === item ? 'active' : ''} onClick={() => setPeriod(item)}>{item}</button>)}</div>
        <section className="seller-metrics"><h2>Key Metrics</h2><div className="seller-metric-grid"><article className="sales-card"><span>Total Profit</span><strong>${metrics.profit.toFixed(2)}</strong></article><article><span>Order Revenue</span><strong>${metrics.sales.toFixed(2)}</strong></article><article><span>Order Quantity</span><strong>{metrics.quantity}</strong></article><article><span>{profile?.traffic_enabled === false ? 'Product Clicks · Stopped' : 'Product Clicks'}</span><strong>{clickCount.toLocaleString()}</strong></article></div></section>
        <section className="seller-sales-chart"><h2>Total Profit</h2><div className="chart-area"><div className="chart-y"><span>4</span><span>3</span><span>2</span><span>1</span><span>0</span></div><div className="chart-plot"><div className="chart-line">{Array.from({ length: 12 }).map((_, index) => <i key={index} />)}</div><div className="chart-times">{['00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00'].map((time) => <span key={time}>{time}</span>)}</div></div></div><div className="chart-legend"><i /> Total Profit</div></section>
        <nav className="seller-help-links"><button type="button" onClick={() => setSellerView('invite')}><b>♙＋</b><span>Invite</span></button><button type="button" onClick={() => setSellerView('feedback')}><b>⌕</b><span>Feedback</span></button><button type="button" onClick={() => setSellerView('service')}><b>♧</b><span>Service</span></button></nav>
        <section className="seller-faq"><h2>FAQ</h2>{faqs.map(([question, answer], index) => <article key={question}><button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{question}</span><b>{openFaq === index ? '⌄' : '›'}</b></button>{openFaq === index && <p>{answer}</p>}</article>)}</section>
      </div>
      {showTrafficModal && (
        <div className="seller-traffic-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && !trafficBusy && setShowTrafficModal(false)}>
          <section className="seller-traffic-modal" role="dialog" aria-modal="true" aria-labelledby="traffic-modal-title">
            <button className="seller-traffic-modal-close" type="button" aria-label="Close" disabled={trafficBusy} onClick={() => setShowTrafficModal(false)}>×</button>
            <h2 id="traffic-modal-title">Free Traffic Package</h2><div className="seller-package-art" aria-hidden="true"><span>✦</span><b>🎁</b></div><h3>Free Traffic Package</h3><p className="seller-traffic-description">Claim to get 3,000 product exposures</p>
            {freeTrafficClaimed ? (
              <p className="seller-traffic-success" role="status">Already claimed</p>
            ) : (
              <>
                {trafficError && <p className="seller-traffic-error" role="alert">{trafficError}</p>}
                <button className="seller-collect-traffic" type="button" disabled={trafficBusy || Boolean(previewMerchant) || !profile} onClick={collectTraffic}>{trafficBusy ? 'Claiming…' : 'Claim'}</button>
              </>
            )}
            <div className="seller-traffic-rules"><strong>Rules</strong><span>1. You can claim the free traffic package once per month.</span><span>2. After claiming, exposure is added to your products over time.</span><span>3. Traffic from multiple claims can be stacked.</span><span>4. All rights are reserved by the platform.</span></div>
          </section>
        </div>
      )}
      {portfolioOpen && <div className="seller-portfolio-overlay" onMouseDown={(event) => event.target === event.currentTarget && !portfolioBusy && setPortfolioOpen(false)}><form className="seller-portfolio-modal" onSubmit={savePortfolio}><header><h2>Edit portfolio</h2><button type="button" onClick={() => setPortfolioOpen(false)} aria-label="Close">×</button></header><label className="seller-portfolio-image">{portfolio.image ? <img src={portfolio.image} alt="Portfolio preview" /> : <span>{portfolio.storeName?.charAt(0)?.toUpperCase() || 'S'}</span>}<input type="file" accept="image/*" onChange={uploadShopAvatar} hidden /><b>Change image</b></label><label>Name<input required maxLength="80" value={portfolio.name} onChange={(event) => setPortfolio((current) => ({ ...current, name: event.target.value }))} /></label><label>Store name<input required maxLength="100" value={portfolio.storeName} onChange={(event) => setPortfolio((current) => ({ ...current, storeName: event.target.value }))} /></label>{portfolioError && <p role="alert">{portfolioError}</p>}<footer><button type="button" onClick={() => setPortfolioOpen(false)} disabled={portfolioBusy}>Cancel</button><button disabled={portfolioBusy}>{portfolioBusy ? 'Saving…' : 'Save changes'}</button></footer></form></div>}
    </main>
  );
}
