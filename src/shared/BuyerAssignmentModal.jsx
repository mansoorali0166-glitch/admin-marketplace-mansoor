import { useMemo, useState } from 'react';
import './BuyerAssignmentModal.css';

const MODES = [
  ['random', 'Random buyers'],
  ['random_country', 'Random from country'],
  ['selected', 'Select buyers'],
];

export default function BuyerAssignmentModal({ mode, country, countries, buyers, buyerIds, productCount, busy, message, onModeChange, onCountryChange, onBuyerIdsChange, onAddProducts, onPlaceOrder, onHistory, onClose }) {
  const [buyerSearch, setBuyerSearch] = useState('');
  const [buyerCountryFilter, setBuyerCountryFilter] = useState('');
  const buyerCountries = useMemo(() => [...new Set(buyers.map((buyer) => String(buyer.country || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [buyers]);
  const visibleBuyers = useMemo(() => {
    const query = buyerSearch.trim().toLowerCase();
    return buyers.filter((buyer) => {
      const matchesName = !query || String(buyer.name || '').toLowerCase().includes(query);
      const matchesCountry = !buyerCountryFilter || buyer.country === buyerCountryFilter;
      return matchesName && matchesCountry;
    });
  }, [buyers, buyerCountryFilter, buyerSearch]);
  const toggleBuyer = (buyerId) => onBuyerIdsChange(buyerIds.includes(buyerId) ? buyerIds.filter((id) => id !== buyerId) : [...buyerIds, buyerId]);
  const selectVisibleBuyers = () => onBuyerIdsChange([...new Set([...buyerIds, ...visibleBuyers.map((buyer) => String(buyer.id))])]);
  return <div className="buyer-assignment-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="buyer-assignment-modal" role="dialog" aria-modal="true" aria-labelledby="buyer-assignment-title">
      <header><div><h3 id="buyer-assignment-title">Choose Buyer Method</h3><p>The system will assign buyers when you place the order.</p></div><button type="button" onClick={onClose}>×</button></header>
      <div className="buyer-mode-buttons">{MODES.map(([value, label]) => <button type="button" className={mode === value ? 'active' : ''} key={value} onClick={() => onModeChange(value)}>{label}</button>)}</div>
      {mode === 'random' && <div className="buyer-mode-panel"><p>Each selected product becomes a separate order from a different randomly selected virtual buyer.</p><button type="button" onClick={onAddProducts}>＋ Add Products {productCount ? `(${productCount})` : ''}</button></div>}
      {mode === 'random_country' && <div className="buyer-mode-panel"><label>Select Country<select required value={country} onChange={(event) => onCountryChange(event.target.value)}><option value="">— Select a country —</option>{countries.map(item => <option key={item} value={item}>{item}</option>)}</select></label><button type="button" disabled={!country} onClick={onAddProducts}>＋ Select Products {productCount ? `(${productCount})` : ''}</button><p>Each selected product becomes a separate order from a different random buyer in this country.</p></div>}
      {mode === 'selected' && <div className="buyer-mode-panel"><div className="buyer-picker-filters"><input type="search" value={buyerSearch} onChange={(event) => setBuyerSearch(event.target.value)} placeholder="Filter by buyer name..." aria-label="Filter buyers by name" /><select value={buyerCountryFilter} onChange={(event) => setBuyerCountryFilter(event.target.value)} aria-label="Filter buyers by country"><option value="">All countries</option>{buyerCountries.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div className="buyer-picker-actions"><span>{visibleBuyers.length} buyer{visibleBuyers.length === 1 ? '' : 's'} found</span><button type="button" disabled={!visibleBuyers.length || busy} onClick={selectVisibleBuyers}>Select shown</button><button type="button" disabled={!buyerIds.length || busy} onClick={() => onBuyerIdsChange([])}>Clear</button></div><div className="buyer-checkbox-list" role="group" aria-label="Select buyers">{visibleBuyers.map((buyer) => { const id = String(buyer.id); return <label key={id}><input type="checkbox" disabled={busy} checked={buyerIds.includes(id)} onChange={() => toggleBuyer(id)} /><span><strong>{buyer.name || 'Unnamed buyer'}</strong><small>{buyer.country || 'Country not set'}</small></span></label>; })}{!visibleBuyers.length && <p>No buyers match those filters.</p>}</div><button type="button" disabled={!buyerIds.length || busy} onClick={onAddProducts}>＋ Select Products {productCount ? `(${productCount})` : ''}</button></div>}
      {message && <p className="buyer-assignment-message" role="status">{message}</p>}
      <footer><button type="button" className="history" onClick={onHistory}>History</button><span>{mode === 'selected' ? `${buyerIds.length} buyer(s) selected` : 'Automatic buyer assignment'}</span>{productCount > 0 ? <button type="button" disabled={busy} onClick={onPlaceOrder}>{busy ? 'Creating…' : `Place ${productCount} Order${productCount === 1 ? '' : 's'}`}</button> : <button type="button" onClick={onClose}>Close</button>}</footer>
    </section>
  </div>;
}
