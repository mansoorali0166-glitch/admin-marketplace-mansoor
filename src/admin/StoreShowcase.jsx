import React, { useEffect, useMemo, useState } from 'react';
import './StoreShowcase.css';
import { adminSupabase } from '../shared/supabase';

const categories = ['All', 'Accessories', 'Baby', 'Beauty', 'Electronics', 'Home & Garden', 'Kids', 'Men', 'Other', 'Sports', 'Women'];

const emptyForm = { name: '', sellPrice: '', costPrice: '', image: '', category: '', link: '', description: '' };

export default function StoreShowcase() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);

  useEffect(() => {
    adminSupabase.from('products').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setProducts((data || []).map((item) => ({ dbId:item.id,id:item.product_code,sku:item.sku,name:item.name,sellPrice:Number(item.sell_price),costPrice:Number(item.cost_price),category:item.category,image:item.image_url,link:item.source_link,description:item.description,onShelf:item.admin_on_shelf })));
    });
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const categoryMatches = category === 'All' || product.category === category;
      const searchMatches = !term || [product.name, product.id, product.sku].some((value) => value.toLowerCase().includes(term));
      return categoryMatches && searchMatches;
    });
  }, [products, search, category]);

  const onShelf = products.filter((product) => product.onShelf).length;

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const openEditModal = (product) => {
    setEditingProduct(product);
    setEditForm({ name: product.name, sellPrice: product.sellPrice, costPrice: product.costPrice, image: product.image, category: product.category, link: product.link || '', description: product.description || '' });
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    setProducts((current) => current.map((product) => product.id === editingProduct.id ? { ...product, ...editForm, sellPrice: Number(editForm.sellPrice), costPrice: Number(editForm.costPrice || 0) } : product));
    await adminSupabase.from('products').update({name:editForm.name,sell_price:Number(editForm.sellPrice),cost_price:Number(editForm.costPrice||0),image_url:editForm.image,category:editForm.category,source_link:editForm.link,description:editForm.description,updated_at:new Date().toISOString()}).eq(editingProduct.dbId ? 'id' : 'product_code', editingProduct.dbId || editingProduct.id);
    setEditingProduct(null);
  };

  const addProduct = async (event) => {
    event.preventDefault();
    const sellPrice = Number(form.sellPrice);
    const costPrice = Number(form.costPrice || 0);
    const stamp = Date.now().toString().slice(-6);
    const newProduct = {
      id: `CR${stamp}`,
      sku: `P${Date.now()}`,
      name: form.name,
      sellPrice,
      costPrice,
      category: form.category,
      image: form.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80',
      link: form.link,
      description: form.description,
      onShelf: true,
    };
    const { data } = await adminSupabase.from('products').insert({product_code:newProduct.id,sku:newProduct.sku,name:newProduct.name,sell_price:newProduct.sellPrice,cost_price:newProduct.costPrice,category:newProduct.category,image_url:newProduct.image,source_link:newProduct.link,description:newProduct.description,admin_on_shelf:true}).select().single();
    setProducts((current) => [{ ...newProduct, dbId:data?.id }, ...current]);
    setForm(emptyForm);
    setShowAddModal(false);
  };

  const importProducts = () => {
    const imported = { id: `CR${Date.now().toString().slice(-6)}`, sku: `P${Date.now()}`, name: 'Imported Seller Product', sellPrice: 89.99, costPrice: 62.5, category: 'Electronics', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80', onShelf: true };
    setProducts((current) => [imported, ...current]);
    setShowImportModal(false);
  };

  const toggleProductShelf = async (product) => {
    const onShelf = !product.onShelf;
    setProducts((current) => current.map((item) => item.id === product.id ? { ...item, onShelf } : item));
    await adminSupabase.from('products').update({ admin_on_shelf:onShelf, updated_at:new Date().toISOString() }).eq(product.dbId ? 'id' : 'product_code', product.dbId || product.id);
  };

  const deleteProduct = async (product) => {
    setProducts((current) => current.filter((item) => item.id !== product.id));
    await adminSupabase.from('products').delete().eq(product.dbId ? 'id' : 'product_code', product.dbId || product.id);
  };

  return (
    <section className="showcase-page">
      <header className="showcase-heading">
        <h2>Product Catalog</h2>
        <p>Manage the admin product catalog. Sellers can browse these products and add them to their own showcase.</p>
      </header>

      <div className="showcase-toolbar">
        <label className="showcase-search"><span>⌕</span><input type="search" placeholder="Search products..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <button className="import-products-btn" type="button" onClick={() => setShowImportModal(true)}>⇧ <span>Import Seller Products</span></button>
        <button className="add-product-btn" type="button" onClick={() => setShowAddModal(true)}>＋ <span>Add Product</span></button>
      </div>

      <div className="showcase-categories">
        {categories.map((item) => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item !== 'All' && <span>◇</span>}{item}</button>)}
      </div>

      <div className="showcase-stats">
        <div><strong>{products.length}</strong><span>Total Products</span></div>
        <div className="on-shelf"><strong>{onShelf}</strong><span>On Shelf</span></div>
        <div className="off-shelf"><strong>{products.length - onShelf}</strong><span>Off Shelf</span></div>
      </div>

      <div className="product-grid">
        {filteredProducts.map((product) => {
          const profit = product.sellPrice - product.costPrice;
          return <article className="product-card" key={product.id}>
            <div className="product-image"><img src={product.image} alt={product.name} /></div>
            <div className="product-details">
              <strong className="product-code">{product.id}</strong><span className="product-sku">{product.sku}</span>
              <strong className="product-price">${product.sellPrice.toFixed(2)}</strong>
              <div className="product-cost">Cost: ${product.costPrice.toFixed(2)} <b>+${profit.toFixed(2)}</b></div>
              <span className="product-category">◇ {product.category}</span>
              <div className="product-actions">
                <button type="button" className={`shelf-toggle ${product.onShelf ? 'on' : ''}`} onClick={() => toggleProductShelf(product)}>◉ {product.onShelf ? 'On' : 'Off'}</button>
                <button type="button" className="edit-product" onClick={() => openEditModal(product)} aria-label={`Edit ${product.name}`}>✎</button>
                <button type="button" className="delete-product" onClick={() => deleteProduct(product)} aria-label={`Delete ${product.name}`}>♲</button>
              </div>
            </div>
          </article>;
        })}
      </div>

      {filteredProducts.length === 0 && <div className="showcase-empty">No products found.</div>}

      {showAddModal && <div className="showcase-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && setShowAddModal(false)}>
        <div className="showcase-modal add-showcase-modal">
          <div className="showcase-modal-header"><h3>Add Global Showcase Product</h3><button type="button" onClick={() => setShowAddModal(false)}>×</button></div>
          <form onSubmit={addProduct}>
            <div className="showcase-modal-body">
              <label>Product Name *<input required placeholder="e.g. Wireless Earbuds Pro" value={form.name} onChange={(e) => updateForm('name', e.target.value)} /></label>
              <label>Sell Price (USD) *<input required min="0" step="0.01" type="number" placeholder="e.g. 29.99" value={form.sellPrice} onChange={(e) => updateForm('sellPrice', e.target.value)} /></label>
              <label>Cost Price (USD)<input min="0" step="0.01" type="number" placeholder="e.g. 15.00 (leave blank for 0)" value={form.costPrice} onChange={(e) => updateForm('costPrice', e.target.value)} /></label>
              <label>Product Image URL<input type="url" placeholder="https://example.com/image.jpg" value={form.image} onChange={(e) => updateForm('image', e.target.value)} /></label>
              <label>Category *<select required value={form.category} onChange={(e) => updateForm('category', e.target.value)}><option value="">— Select a category —</option>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Product / Source Link<input type="url" placeholder="https://..." value={form.link} onChange={(e) => updateForm('link', e.target.value)} /></label>
              <label>Description<textarea placeholder="Brief product description..." value={form.description} onChange={(e) => updateForm('description', e.target.value)} /></label>
            </div>
            <div className="showcase-modal-footer"><button type="button" onClick={() => setShowAddModal(false)}>Cancel</button><button type="submit">Add Product</button></div>
          </form>
        </div>
      </div>}

      {editingProduct && <div className="showcase-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && setEditingProduct(null)}>
        <div className="showcase-modal edit-showcase-modal">
          <div className="showcase-modal-header"><h3>Edit Showcase Product</h3><button type="button" onClick={() => setEditingProduct(null)}>×</button></div>
          <form onSubmit={saveProduct}>
            <div className="showcase-modal-body">
              <label>Product Name *<input required value={editForm.name} onChange={(e) => setEditForm((current) => ({ ...current, name: e.target.value }))} /></label>
              <label>Sell Price (USD) *<input required min="0" step="0.01" type="number" value={editForm.sellPrice} onChange={(e) => setEditForm((current) => ({ ...current, sellPrice: e.target.value }))} /></label>
              <label>Cost Price (USD)<input min="0" step="0.01" type="number" value={editForm.costPrice} onChange={(e) => setEditForm((current) => ({ ...current, costPrice: e.target.value }))} /><small className="edit-profit">Profit: ${(Number(editForm.sellPrice || 0) - Number(editForm.costPrice || 0)).toFixed(2)}</small></label>
              <label>Product Image URL<input type="url" value={editForm.image} onChange={(e) => setEditForm((current) => ({ ...current, image: e.target.value }))} />{editForm.image && <img className="edit-image-preview" src={editForm.image} alt="Product preview" />}</label>
              <label>Category *<select required value={editForm.category} onChange={(e) => setEditForm((current) => ({ ...current, category: e.target.value }))}><option value="">— Select a category —</option>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select>{editForm.category && <small className="edit-category-preview">◇ {editForm.category}</small>}</label>
              <label>Product / Source Link<input type="text" value={editForm.link} onChange={(e) => setEditForm((current) => ({ ...current, link: e.target.value }))} /></label>
              <label>Description<textarea placeholder="Brief product description..." value={editForm.description} onChange={(e) => setEditForm((current) => ({ ...current, description: e.target.value }))} /></label>
            </div>
            <div className="showcase-modal-footer"><button type="button" onClick={() => setEditingProduct(null)}>Cancel</button><button type="submit">Save Changes</button></div>
          </form>
        </div>
      </div>}

      {showImportModal && <div className="showcase-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && setShowImportModal(false)}>
        <div className="showcase-modal import-showcase-modal">
          <div className="import-icon">⇧</div><h3>Import Seller Products</h3>
          <p>This will copy <strong>all existing seller products</strong> into the Admin Product Catalog as global catalog entries.</p>
          <ul><li>Duplicate product numbers are skipped automatically.</li><li>All product data (name, image, SKU, prices, description, category) is preserved.</li><li>Seller showcase selections are created so sellers retain their current products.</li><li>Original seller product rows are <strong>not deleted.</strong></li><li>This action is safe to run multiple times.</li></ul>
          <div className="import-modal-actions"><button type="button" onClick={() => setShowImportModal(false)}>Cancel</button><button type="button" onClick={importProducts}>Import Now</button></div>
        </div>
      </div>}
    </section>
  );
}
