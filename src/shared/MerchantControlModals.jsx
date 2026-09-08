import React, { useEffect, useState } from 'react';
import './MerchantControlModals.css';
import { readImageFile } from './avatar';
import AvatarCropper from './AvatarCropper';

const Toggle = ({ checked, onChange }) => <button type="button" className={`merchant-toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}><i /></button>;

export default function MerchantControlModals({ client, merchant, action, onClose, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [tradePassword, setTradePassword] = useState('');
  const [agents, setAgents] = useState([]);
  const [form, setForm] = useState({ agentId: '', credit: merchant?.credit ?? 100, remark: '', avatar: merchant?.avatar || '' });
  const [avatarError, setAvatarError] = useState('');
  const [cropSource, setCropSource] = useState('');
  const [risk, setRisk] = useState({ allowLogin: true, allowWithdraw: true, bankCardLocked: false });
  const [products, setProducts] = useState([]);
  const [addingProduct, setAddingProduct] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [productError, setProductError] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);

  useEffect(() => {
    if (!client || !merchant?.userId) return;
    if (action === 'Edit') {
      client.from('profiles').select('id,display_name,email').eq('role', 'agent').then(({ data }) => setAgents(data || []));
      client.from('profiles').select('agent_id,credit_score,merchant_remark').eq('id', merchant.userId).maybeSingle().then(({ data }) => data && setForm((current) => ({
        ...current,
        agentId: data.agent_id || '',
        credit: data.credit_score ?? current.credit,
        remark: data.merchant_remark || '',
      })));
    }
    if (action === 'Risk Control') client.from('profiles').select('allow_login,allow_withdraw,bank_card_locked').eq('id', merchant.userId).maybeSingle().then(({ data }) => data && setRisk({ allowLogin: data.allow_login !== false, allowWithdraw: data.allow_withdraw !== false, bankCardLocked: !!data.bank_card_locked }));
    if (action === 'Showcase') client.from('showcase_products').select('id,on_shelf,products(id,name,product_code,sku,image_url,sell_price)').eq('seller_id', merchant.userId).then(({ data }) => setProducts((data || []).map((row) => ({ ...row.products, on_shelf: row.on_shelf }))));
  }, [action, client, merchant?.userId]);

  const reloadShowcaseProducts = () => client.from('showcase_products').select('id,on_shelf,products(id,name,product_code,sku,image_url,sell_price)').eq('seller_id', merchant.userId).then(({ data }) => setProducts((data || []).map((row) => ({ ...row.products, on_shelf: row.on_shelf }))));

  const openProductCatalog = async () => {
    setAddingProduct(true);
    setLoadingCatalog(true);
    setProductError('');
    const { data, error } = await client.from('products').select('id,name,product_code,sku,image_url,sell_price,category,admin_on_shelf').eq('admin_on_shelf', true).order('created_at', { ascending: false });
    setCatalogProducts(data || []);
    setLoadingCatalog(false);
    if (error) setProductError(error.message);
  };

  const addExistingProduct = async (productId) => {
    setSavingProduct(true);
    setProductError('');
    const { error: linkErr } = await client
      .from('showcase_products')
      .upsert({ seller_id: merchant.userId, product_id: productId, on_shelf: true });
    setSavingProduct(false);
    if (linkErr) return setProductError(linkErr.message);
    await reloadShowcaseProducts();
    setCatalogProducts((current) => current.filter((product) => product.id !== productId));
    setMessage('Product added to the merchant showcase.');
  };

  const run = async (work) => {
    setBusy(true); setMessage('');
    const { error } = await work();
    setBusy(false);
    if (error) return setMessage(error.message);
    onChanged?.(); onClose();
  };
  const resetPassword = async (event) => { event.preventDefault(); if (!password || password.length < 6) return setMessage('Login password must contain at least 6 characters.'); setBusy(true); setMessage(''); const { error } = await client.rpc('manage_merchant_password', { target_user_id: merchant.userId, new_password: password, new_trade_password: tradePassword || null }); if (!error) await client.from('profiles').update({ allow_login: true }).eq('id', merchant.userId); setBusy(false); if (error) return setMessage(error.message); onChanged?.(); onClose(); };
  const saveEdit = (event) => { event.preventDefault(); run(() => client.from('profiles').update({ agent_id: form.agentId || null, credit_score: Number(form.credit), merchant_remark: form.remark || null }).eq('id', merchant.userId)); };
  const pickMerchantAvatarFile = async (file) => {
    if (!file) return;
    setAvatarError('');
    try {
      setCropSource(await readImageFile(file));
    } catch (err) {
      setAvatarError(err.message || 'Could not read that image.');
    }
  };
  const uploadMerchantAvatar = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    pickMerchantAvatarFile(file);
  };
  const pasteMerchantAvatar = (event) => {
    const file = Array.from(event.clipboardData?.items || [])
      .find((item) => item.type.startsWith('image/'))
      ?.getAsFile();
    if (file) {
      event.preventDefault();
      pickMerchantAvatarFile(file);
    }
  };
  const confirmMerchantAvatarCrop = (croppedDataUrl) => {
    setForm((current) => ({ ...current, avatar: croppedDataUrl }));
    setCropSource('');
  };
  const saveRisk = (event) => { event.preventDefault(); run(() => client.from('profiles').update({ allow_login: risk.allowLogin, allow_withdraw: risk.allowWithdraw, bank_card_locked: risk.bankCardLocked }).eq('id', merchant.userId)); };
  const forceLogout = async () => { setBusy(true); setMessage(''); const { error: blockError } = await client.from('profiles').update({ allow_login: false }).eq('id', merchant.userId); const { error: logoutError } = blockError ? { error: null } : await client.rpc('force_logout_merchant', { target_user_id: merchant.userId }); setBusy(false); const error = blockError || logoutError; if (error) return setMessage(error.message); onChanged?.(); onClose(); };
  const loginPreview = () => {
    const encoded = encodeURIComponent(btoa(JSON.stringify(merchant)));
    window.open(`/seller?previewMerchant=${encoded}`, '_blank', 'noopener');
  };

  if (!merchant || !action) return null;
  const Header = ({ title, icon = '' }) => <header><div><h3>{icon} {title}</h3><p>{merchant.email}</p></div><button type="button" onClick={onClose}>×</button></header>;
  return <div className="merchant-control-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    {action === 'Reset Pwd' && <form className="merchant-control-modal" onSubmit={resetPassword}><Header title="Reset Password" icon="⚿" /><label>LOGIN PASSWORD<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter new password" /></label><label>TRADE PASSWORD<input type="password" value={tradePassword} onChange={(e) => setTradePassword(e.target.value)} placeholder="Leave blank to keep unchanged" /></label>{message && <p className="control-error">{message}</p>}<footer><button type="button" onClick={onClose}>Cancel</button><button className="orange" disabled={busy}>Confirm</button></footer></form>}
    {action === 'Edit' && <form className="merchant-control-modal" onSubmit={saveEdit}><Header title="Edit Merchant" /><label>EMAIL<input disabled value={merchant.email} /></label><label>AGENT<select value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })}><option value="">— Unassigned —</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.display_name || agent.email}</option>)}</select></label><label>CREDIT SCORE<input type="number" min="0" max="100" value={form.credit} onChange={(e) => setForm({ ...form, credit: e.target.value })} /></label><label>REMARK<textarea maxLength="500" placeholder="User remark (optional)" value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} /><small>{form.remark.length}/500</small></label>{message && <p className="control-error">{message}</p>}<footer><button type="button" onClick={onClose}>Cancel</button><button disabled={busy}>Confirm</button></footer></form>}
    {action === 'Risk Control' && <form className="merchant-control-modal" onSubmit={saveRisk}><Header title="Risk Control" icon="♢" /><div className="risk-row"><span>Allow Login</span><Toggle checked={risk.allowLogin} onChange={(value) => setRisk({ ...risk, allowLogin: value })} /></div><div className="risk-row"><span>Allow Withdraw</span><Toggle checked={risk.allowWithdraw} onChange={(value) => setRisk({ ...risk, allowWithdraw: value })} /></div><div className="risk-row"><span>Lock Bank Card</span><Toggle checked={risk.bankCardLocked} onChange={(value) => setRisk({ ...risk, bankCardLocked: value })} /></div>{message && <p className="control-error">{message}</p>}<footer><button type="button" onClick={onClose}>Cancel</button><button className="purple" disabled={busy}>Confirm</button></footer></form>}
    {action === 'Kick' && <section className="merchant-control-modal small"><Header title="Force Logout" /><p className="control-copy">Immediately invalidates all active refresh sessions for this merchant.</p>{message && <p className="control-error">{message}</p>}<footer><button type="button" onClick={onClose}>Cancel</button><button type="button" className="red" disabled={busy} onClick={forceLogout}>Force Logout</button></footer></section>}
    {action === 'Login' && <section className="merchant-control-modal small"><Header title="Login as Merchant" /><p className="control-copy">Open this merchant's dashboard directly in this tab. You can return to your portal afterward.</p><footer><button type="button" onClick={onClose}>Cancel</button><button type="button" className="dark" onClick={loginPreview}>Login as Merchant</button></footer></section>}
    {action === 'Showcase' && !addingProduct && <section className="merchant-control-modal showcase"><Header title="Merchant Showcase" /><div className="control-products">{products.map((product) => <article key={product.id}><img src={product.image_url} alt="" /><div><strong>{product.product_code || product.name}</strong><span>{product.sku}</span><b>${Number(product.sell_price || 0).toFixed(2)}</b></div></article>)}{!products.length && <div className="control-empty"><i>◇</i><p>No products in showcase.</p></div>}</div>{message && <p className="control-success">{message}</p>}<footer><button type="button" onClick={onClose}>Close</button><button type="button" onClick={openProductCatalog}>＋ Add Product</button></footer></section>}
    {action === 'Showcase' && addingProduct && <section className="merchant-control-modal showcase"><Header title="Add Existing Product" /><p className="control-copy">Choose a product from the global showcase to add to this merchant.</p><div className="control-products product-picker">{loadingCatalog && <div className="control-empty"><p>Loading products…</p></div>}{!loadingCatalog && catalogProducts.filter((product) => !products.some((selected) => selected.id === product.id)).map((product) => <article key={product.id}><img src={product.image_url} alt={product.name || ''} /><div><strong>{product.product_code || product.name}</strong><span>{product.name} · {product.category || 'Other'}</span><b>${Number(product.sell_price || 0).toFixed(2)}</b></div><button type="button" disabled={savingProduct} onClick={() => addExistingProduct(product.id)}>＋ Add</button></article>)}{!loadingCatalog && !catalogProducts.filter((product) => !products.some((selected) => selected.id === product.id)).length && <div className="control-empty"><p>All available products are already in this merchant's showcase.</p></div>}</div>{productError && <p className="control-error">{productError}</p>}{message && <p className="control-success">{message}</p>}<footer><button type="button" onClick={() => { setAddingProduct(false); setProductError(''); setMessage(''); }}>Back to Showcase</button></footer></section>}
  </div>;
}
