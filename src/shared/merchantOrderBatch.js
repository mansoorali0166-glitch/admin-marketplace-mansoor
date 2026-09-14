export function buildMerchantOrders({ sellerId, items, products, buyers, buyerId = '', random = Math.random, batchId = crypto.randomUUID() }) {
  if (!items.length) throw new Error('Add at least one product.');
  if (!buyers.length) throw new Error('Create a virtual buyer before creating orders.');
  const chosen = buyerId ? buyers.find(buyer => String(buyer.id) === buyerId) : null;
  if (buyerId && !chosen) throw new Error('The selected buyer is no longer available.');
  return items.map((item, index) => {
    const product = products.find(product => String(product.id) === item.productId);
    if (!product) throw new Error('A selected product is no longer available.');
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Quantity must be a positive whole number.');
    const buyer = chosen || buyers[Math.floor(random() * buyers.length)];
    const sellPrice = Number(product.sell_price), costPrice = Number(product.cost_price ?? 0);
    if (!Number.isFinite(sellPrice) || sellPrice < 0 || !Number.isFinite(costPrice) || costPrice < 0) throw new Error('This product has an invalid price.');
    return { seller_id: sellerId, order_no: `MH${batchId}-${index + 1}`, product_name: product.name || product.product_code,
      customer_name: buyer.name, shipping_address: [buyer.address, buyer.city, buyer.state, buyer.postal, buyer.country].filter(Boolean).join(', '),
      quantity, sell_price: sellPrice, cost_price: costPrice, status: 'Pending Payment' };
  });
}
