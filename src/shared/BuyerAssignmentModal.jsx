import './BuyerAssignmentModal.css';

const MODES = [
  ['random', 'Random buyers'],
  ['random_country', 'Random from country'],
  ['selected', 'Select buyers'],
];

export default function BuyerAssignmentModal({ mode, country, countries, buyers, buyerIds, productCount, busy, message, onModeChange, onCountryChange, onBuyerIdsChange, onAddProducts, onPlaceOrder, onHistory, onClose }) {
  const selectBuyers = (event) => onBuyerIdsChange(Array.from(event.target.selectedOptions, option => option.value));
  return <div className="buyer-assignment-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="buyer-assignment-modal" role="dialog" aria-modal="true" aria-labelledby="buyer-assignment-title">
      <header><div><h3 id="buyer-assignment-title">Choose Buyer Method</h3><p>The system will assign buyers when you place the order.</p></div><button type="button" onClick={onClose}>×</button></header>
      <div className="buyer-mode-buttons">{MODES.map(([value, label]) => <button type="button" className={mode === value ? 'active' : ''} key={value} onClick={() => onModeChange(value)}>{label}</button>)}</div>
      {mode === 'random' && <div className="buyer-mode-panel"><p>Buyers will be selected automatically from all virtual buyers, based on the number of selected products.</p><button type="button" onClick={onAddProducts}>＋ Add Products {productCount ? `(${productCount})` : ''}</button></div>}
      {mode === 'random_country' && <div className="buyer-mode-panel"><label>Select Country<select required value={country} onChange={(event) => onCountryChange(event.target.value)}><option value="">— Select a country —</option>{countries.map(item => <option key={item} value={item}>{item}</option>)}</select></label><button type="button" disabled={!country} onClick={onAddProducts}>＋ Select Products {productCount ? `(${productCount})` : ''}</button><p>Only virtual buyers from the selected country will be assigned automatically.</p></div>}
      {mode === 'selected' && <div className="buyer-mode-panel"><label>Select Buyers<select multiple size={Math.min(6, Math.max(3, buyers.length))} value={buyerIds} onChange={selectBuyers}>{buyers.map(buyer => <option key={buyer.id} value={String(buyer.id)}>{buyer.name}{buyer.country ? ` · ${buyer.country}` : ''}</option>)}</select><small>Hold Ctrl or Command to select more than one buyer.</small></label><button type="button" disabled={!buyerIds.length || busy} onClick={onAddProducts}>＋ Select Products {productCount ? `(${productCount})` : ''}</button></div>}
      {message && <p className="buyer-assignment-message" role="status">{message}</p>}
      <footer><button type="button" className="history" onClick={onHistory}>History</button><span>{mode === 'selected' ? `${buyerIds.length} buyer(s) selected` : 'Automatic buyer assignment'}</span>{productCount > 0 ? <button type="button" disabled={busy} onClick={onPlaceOrder}>{busy ? 'Creating…' : `Place ${productCount} Order${productCount === 1 ? '' : 's'}`}</button> : <button type="button" onClick={onClose}>Close</button>}</footer>
    </section>
  </div>;
}
