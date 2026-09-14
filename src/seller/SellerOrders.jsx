import { useCallback, useEffect, useMemo, useState } from 'react';
import './SellerOrders.css';
import './SellerOrderPayment.css';

const statuses = [
  { value: 'Pending Payment', label: 'Pending Pay' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Pending Ship', label: 'Pending Ship' },
  { value: 'Pending Receive', label: 'Pending Receive' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Cancelled', label: 'Cancelled' },
  { value: 'Refund', label: 'Refund' },
];
const tabs = ['All', ...statuses.map(({ label }) => label)];
const aliases = {
  'pending pay': 'Pending Payment', 'pending payment': 'Pending Payment', paid: 'Paid',
  'pending ship': 'Pending Ship', 'pending receive': 'Pending Receive', completed: 'Completed',
  rejected: 'Rejected', cancelled: 'Cancelled', canceled: 'Cancelled', refund: 'Refund', refunded: 'Refund',
};
const normalizeStatus = (status) => aliases[String(status || '').trim().toLowerCase()] || 'Pending Payment';
const statusLabel = (status) => statuses.find(({ value }) => value === status)?.label || status;

export default function SellerOrders({ client, sellerId, onBack }) {
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('All');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [tradePassword, setTradePassword] = useState('');
  const [paying, setPaying] = useState(false);

  const refreshOrders = useCallback(async () => {
    if (!client || !sellerId) return;
    setLoading(true);
    setMessage('');
    const [ordersResult, productsResult] = await Promise.all([
      client.from('orders').select('*').eq('seller_id', sellerId).order('created_at', { ascending: false }),
      client.from('products').select('name,product_code,image_url'),
    ]);
    if (ordersResult.error) {
      setOrders([]);
      setMessage(`Could not load orders: ${ordersResult.error.message}`);
      setLoading(false);
      return;
    }
    const productImage = (name) => productsResult.data?.find((product) => product.name === name || product.product_code === name)?.image_url || '';
    setOrders((ordersResult.data || []).map((item) => ({
      dbId: item.id,
      id: item.order_no || item.id,
      product: item.product_name || 'Product',
      productImage: productImage(item.product_name),
      customer: item.customer_name || 'Customer',
      address: item.shipping_address || 'No shipping address on file',
      sellPrice: Number(item.sell_price || 0),
      costPrice: Number(item.cost_price || 0),
      quantity: Number(item.quantity || 1),
      status: normalizeStatus(item.status),
      date: item.created_at ? new Date(item.created_at).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
    })));
    setLoading(false);
  }, [client, sellerId]);

  useEffect(() => {
    refreshOrders();
    if (!client || !sellerId) return undefined;
    const channel = client.channel(`seller-orders-${sellerId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${sellerId}` }, refreshOrders).subscribe();
    return () => client.removeChannel(channel);
  }, [client, sellerId, refreshOrders]);

  const selectedStatus = activeTab === 'All' ? 'All' : normalizeStatus(activeTab);
  const visibleOrders = useMemo(() => orders.filter((order) => selectedStatus === 'All' || order.status === selectedStatus), [orders, selectedStatus]);
  const payOrder = async (event) => {
    event.preventDefault();
    if (!paymentOrder || paying) return;
    setPaying(true);
    setMessage('');
    const { error } = await client.rpc('pay_seller_order', { target_order_id: paymentOrder.dbId, supplied_trade_password: tradePassword });
    setPaying(false);
    if (error) return setMessage(error.message);
    await refreshOrders();
    setPaymentOrder(null);
    setTradePassword('');
    setMessage('Payment successful. Your order is now pending shipment.');
  };

  return <main className="seller-orders-page"><div className="seller-orders-shell">
    <header><button type="button" onClick={onBack}>‹</button><h1>Orders</h1><button className="seller-orders-refresh" type="button" onClick={refreshOrders}>↻</button></header>
    <nav>{tabs.map((tab) => <button className={activeTab === tab ? 'active' : ''} type="button" key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>
    {message && <p className="seller-orders-error" role="alert">{message}</p>}
    <section className="seller-order-list">{visibleOrders.map((order) => {
      const profit = (order.sellPrice - order.costPrice) * order.quantity;
      return <article className={order.status === 'Pending Payment' ? 'seller-order-payable' : ''} key={order.dbId} onClick={() => order.status === 'Pending Payment' && setPaymentOrder(order)}>{order.status === 'Pending Payment' && <div className="seller-new-order"><b>New Order</b><span>You have a new order. Please pay as soon as possible.</span></div>}<div className="seller-order-heading"><div><span>Order No:</span><strong>{order.id}</strong><time>{order.date}</time></div><b className={`order-${order.status.toLowerCase().replaceAll(' ', '-')}`}>{statusLabel(order.status)}</b></div><div className="seller-order-address"><span>⌾</span><div><strong>{order.customer}</strong><p>{order.address}</p></div></div><div className="seller-order-product">{order.productImage && <img className="seller-order-product-image" src={order.productImage} alt={order.product} />}<div><strong>{order.product}</strong><span>x{order.quantity}</span></div></div><div className="seller-order-prices"><div><strong>${order.sellPrice.toFixed(2)}</strong><span>Sell Price</span></div><div><strong>${order.costPrice.toFixed(2)}</strong><span>Cost Price</span></div><div><strong>${profit.toFixed(2)}</strong><span>Profit</span></div></div></article>;
    })}{!loading && !visibleOrders.length && <div className="seller-orders-empty">No {activeTab.toLowerCase()} orders found.</div>}</section>
    {paymentOrder && <div className="seller-payment-overlay" onMouseDown={(event) => event.target === event.currentTarget && setPaymentOrder(null)}><form className="seller-payment-modal" onSubmit={payOrder}><header><div><h2>Pay Order</h2><p>Order No: {paymentOrder.id}</p></div><button type="button" onClick={() => setPaymentOrder(null)}>×</button></header><div className="seller-payment-amount"><span>Order amount</span><strong>${(paymentOrder.costPrice * paymentOrder.quantity).toFixed(2)}</strong></div><label>Trade Password<input autoFocus required type="password" autoComplete="current-password" placeholder="Enter your bank card trade password" value={tradePassword} onChange={(event) => setTradePassword(event.target.value)} /></label>{message && <p className="seller-orders-error" role="alert">{message}</p>}<button className="seller-confirm-pay" disabled={paying}>{paying ? 'Processing Payment…' : 'Click to Confirm Pay'}</button></form></div>}
  </div></main>;
}
