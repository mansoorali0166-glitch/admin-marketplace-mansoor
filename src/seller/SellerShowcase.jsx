import React, { useEffect, useMemo, useState } from 'react';
import { starterProducts } from '../admin/StoreShowcase';
import './SellerShowcase.css';
import { sellerSupabase } from '../shared/supabase';

const categories = ['All', 'Accessories', 'Baby', 'Beauty', 'Electronics', 'Home & Garden', 'Kids', 'Men', 'Other', 'Sports', 'Women'];
const getCatalog = () => {
  try { return JSON.parse(localStorage.getItem('admin_product_catalog')) || starterProducts; } catch { return starterProducts; }
};
const getSelections = (catalog) => {
  try {
    const saved = JSON.parse(localStorage.getItem('seller_showcase_products'));
    return saved || catalog.slice(0, 2).map((product) => ({ id: product.id, onShelf: true }));
  } catch { return catalog.slice(0, 2).map((product) => ({ id: product.id, onShelf: true })); }
};

export default function SellerShowcase({ onBack, shopLocked = false, client = sellerSupabase, sellerId }) {
  const [catalog, setCatalog] = useState(getCatalog);
  const [selections, setSelections] = useState(() => getSelections(getCatalog()));
  const [category, setCategory] = useState('All');
  const [shelf, setShelf] = useState('On Shelf');
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const loadCloudShowcase = async () => {
      const { data: auth } = sellerId ? { data: { user: { id: sellerId } } } : await client.auth.getUser();
      const { data: products } = await client.from('products').select('*').order('created_at', { ascending:false });
      if (products?.length) {
        const mapped = products.map((item) => ({dbId:item.id,id:item.product_code,sku:item.sku,name:item.name,sellPrice:Number(item.sell_price),costPrice:Number(item.cost_price),category:item.category,image:item.image_url,onShelf:item.admin_on_shelf}));
        setCatalog(mapped);
        const { data: selected } = await client.from('showcase_products').select('product_id,on_shelf').eq('seller_id', auth.user.id);
        if (selected?.length) setSelections(selected.map((item) => ({id:mapped.find((product) => product.dbId === item.product_id)?.id,onShelf:item.on_shelf})).filter((item) => item.id));
      }
    };
    loadCloudShowcase();
    const channel = client.channel(`seller-live-showcase-${sellerId || 'self'}`).on('postgres_changes',{event:'*',schema:'public',table:'products'},loadCloudShowcase).on('postgres_changes',{event:'*',schema:'public',table:'showcase_products'},loadCloudShowcase).subscribe();
    return () => client.removeChannel(channel);
  }, [client, sellerId]);

  const saveSelections = (next) => { setSelections(next); localStorage.setItem('seller_showcase_products', JSON.stringify(next)); };
  const selectedProducts = useMemo(() => selections.map((selection) => {
    const product = catalog.find((item) => item.id === selection.id);
    return product ? { ...product, sellerOnShelf: selection.onShelf } : null;
  }).filter(Boolean), [catalog, selections]);
  const visibleProducts = selectedProducts.filter((product) => (category === 'All' || product.category === category) && (shelf === 'All' || (shelf === 'On Shelf' ? product.sellerOnShelf : !product.sellerOnShelf)));
  const availableProducts = catalog.filter((product) => !selections.some((selection) => selection.id === product.id) && (category === 'All' || product.category === category));

  const addProduct = async (product) => {
    saveSelections([...selections, { id: product.id, onShelf: true }]);
    const { data: auth } = sellerId ? { data: { user: { id: sellerId } } } : await client.auth.getUser();
    await client.from('showcase_products').upsert({seller_id:auth.user.id,product_id:product.dbId,on_shelf:true});
    setNotice(`${product.id} added to your showcase.`);
    window.setTimeout(() => setNotice(''), 1800);
  };
  const toggleShelf = async (id) => {
    const product = catalog.find((item) => item.id === id);
    const selection = selections.find((item) => item.id === id);
    const onShelf = !selection.onShelf;
    saveSelections(selections.map((item) => item.id === id ? { ...item, onShelf } : item));
    const { data: auth } = sellerId ? { data: { user: { id: sellerId } } } : await client.auth.getUser();
    await client.from('showcase_products').update({on_shelf:onShelf}).eq('seller_id',auth.user.id).eq('product_id',product.dbId);
  };
  const refreshCatalog = () => setCatalog(getCatalog());

  if (adding) return <main className="seller-showcase-page"><div className="seller-showcase-shell add-products-shell">
    <header><button type="button" onClick={() => { setAdding(false); setCategory('All'); }}>×</button><h1>Add Products</h1><span /></header>
    <nav className="seller-showcase-categories">{categories.map((item) => <button className={category === item ? 'active' : ''} type="button" key={item} onClick={() => setCategory(item)}>{item}</button>)}</nav>
    <p className="add-products-help">Select products from the admin catalog to add to your showcase</p>
    <section className="add-products-list">{availableProducts.map((product) => <article key={product.id}><img src={product.image} alt={product.name} /><div><strong>{product.id}</strong><span>${product.sellPrice.toFixed(2)}</span><small>{product.category}</small></div><button type="button" onClick={() => addProduct(product)}>＋ Add</button></article>)}{!availableProducts.length && <div className="seller-showcase-empty">No more products available in this category.</div>}</section>
  </div></main>;

  return <main className="seller-showcase-page"><div className="seller-showcase-shell">
    <header><button type="button" onClick={onBack}>‹</button><h1>Showcase</h1>{!shopLocked && <button className="seller-add-products" type="button" onClick={() => { refreshCatalog(); setAdding(true); }}>＋ Add Products</button>}</header>
    {notice && <div className="seller-showcase-notice">{notice}</div>}
    {shopLocked ? (
      <div className="seller-showcase-empty">Your shop is locked. Products are hidden until it's unlocked.</div>
    ) : (
      <>
        <nav className="seller-shelf-tabs">{['On Shelf', 'All', 'Off Shelf'].map((item) => <button className={shelf === item ? 'active' : ''} type="button" key={item} onClick={() => setShelf(item)}>{item}</button>)}</nav>
        <nav className="seller-showcase-categories">{categories.map((item) => <button className={category === item ? 'active' : ''} type="button" key={item} onClick={() => setCategory(item)}>{item}</button>)}</nav>
        <section className="seller-showcase-products">{visibleProducts.map((product) => <article key={product.id}><h2>Product No: {product.sku}</h2><div className="seller-product-main"><img src={product.image} alt={product.name} /><div><strong>{product.id}</strong><span>Stock 999</span></div></div><div className="seller-product-prices"><div><strong>${product.sellPrice.toFixed(2)}</strong><span>Sell Price</span></div><div><strong>${product.costPrice.toFixed(2)}</strong><span>Cost Price</span></div><div><strong>${(product.sellPrice-product.costPrice).toFixed(2)}</strong><span>Profit</span></div></div><button className={product.sellerOnShelf ? 'on' : 'off'} type="button" onClick={() => toggleShelf(product.id)}>◉ &nbsp; {product.sellerOnShelf ? 'ON SHELF' : 'OFF SHELF'}</button></article>)}{!visibleProducts.length && <div className="seller-showcase-empty">No products found.</div>}</section>
      </>
    )}
  </div></main>;
}
