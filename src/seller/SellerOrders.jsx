import React, { useEffect, useMemo, useState } from 'react';
import './SellerOrders.css';

const tabs = ['All', 'Pending Ship', 'Pending Receive', 'Shipped', 'Completed', 'Refund', 'Cancelled'];

export default function SellerOrders({ client, sellerId, onBack }) {
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('All');
  const [loading, setLoading] = useState(true);

  const refreshOrders = async () => {
    if (!client || !sellerId) return;
    setLoading(true);
    const [{ data }, { data: products }] = await Promise.all([
      client.from('orders').select('*').eq('seller_id', sellerId).order('created_at', { ascending: false }),
      client.from('products').select('name,product_code,image_url'),
    ]);
    const productImage = (name) => products?.find((product) => product.name === name || product.product_code === name)?.image_url || '';
    setOrders(
      (data || []).map((item) => ({
        dbId: item.id,
        id: item.order_no,
        product: item.product_name,
        productImage: productImage(item.product_name),
        customer: item.customer_name || 'Customer',
        address: item.shipping_address || 'No shipping address on file',
        sellPrice: Number(item.sell_price || 0),
        costPrice: Number(item.cost_price || 0),
        quantity: Number(item.quantity || 1),
        status: item.status,
        date: new Date(item.created_at).toLocaleDateString(),
      })),
    );
    setLoading(false);
  };
  useEffect(() => {
    refreshOrders();
    if (!client) return;
    const channel = client.channel('seller-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refreshOrders).subscribe();
    return () => client.removeChannel(channel);
  }, [client, sellerId]);
  const visibleOrders = useMemo(() => orders.filter((order) => activeTab === 'All' || order.status === activeTab), [orders, activeTab]);

  return <main className="seller-orders-page"><div className="seller-orders-shell">
    <header><button type="button" onClick={onBack}>‹</button><h1>Orders</h1><button className="seller-orders-refresh" type="button" onClick={refreshOrders}>↻</button></header>
    <nav>{tabs.map((tab) => <button className={activeTab === tab ? 'active' : ''} type="button" key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>
    <section className="seller-order-list">{visibleOrders.map((order) => {
      const profit = order.sellPrice - order.costPrice;
      return <article key={order.dbId}><div className="seller-order-heading"><div><span>Order No:</span><strong>{order.id}</strong></div><b className={`order-${String(order.status || '').toLowerCase().replaceAll(' ', '-')}`}>{order.status}</b></div><div className="seller-order-address"><span>⌾</span><div><strong>{order.customer}</strong><p>{order.address}</p></div></div><div className="seller-order-product">{order.productImage && <img className="seller-order-product-image" src={order.productImage} alt={order.product} />}<div><strong>{order.product}</strong><span>x{order.quantity}</span></div></div><div className="seller-order-prices"><div><strong>${order.sellPrice.toFixed(2)}</strong><span>Sell Price</span></div><div><strong>${order.costPrice.toFixed(2)}</strong><span>Cost Price</span></div><div><strong>${profit.toFixed(2)}</strong><span>Profit</span></div></div></article>;
    })}{!loading && !visibleOrders.length && <div className="seller-orders-empty">No {activeTab.toLowerCase()} orders found.</div>}</section>
  </div></main>;
}
