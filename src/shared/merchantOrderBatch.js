export function buildMerchantOrders({ sellerId, items, products, buyers, buyerId = 'random', buyerIds = [], buyerCountry = '', random = Math.random, batchId = crypto.randomUUID() }) {
  if (!items.length) throw new Error('Add at least one product.');
  if (!buyers.length) throw new Error('Create a virtual buyer before creating orders.');

  const selectedBuyerIds = buyerIds.length ? buyerIds : buyerId && !['random', 'random_country', 'selected'].includes(buyerId) ? [buyerId] : [];
  const selectedBuyers = selectedBuyerIds.map(id => buyers.find(buyer => String(buyer.id) === String(id)));
  if (selectedBuyers.some(buyer => !buyer)) throw new Error('A selected buyer is no longer available.');
  if (buyerId === 'selected' && !selectedBuyers.length) throw new Error('Select at least one buyer.');
  if (buyerId === 'random_country' && !buyerCountry) throw new Error('Choose a buyer country.');

  const countryKey = buyerCountry.trim().toLowerCase();
  const eligibleBuyers = buyerId === 'random_country'
    ? buyers.filter(buyer => String(buyer.country || '').trim().toLowerCase() === countryKey)
    : buyers;
  const usesRandomBuyers = !selectedBuyers.length;
  if (usesRandomBuyers && eligibleBuyers.length < items.length) {
    throw new Error(`You need at least ${items.length} different eligible buyers for these orders.`);
  }
  const shuffledBuyers = [...eligibleBuyers];
  for (let index = 0; index < shuffledBuyers.length - 1; index += 1) {
    const swapIndex = index + Math.floor(random() * (shuffledBuyers.length - index));
    [shuffledBuyers[index], shuffledBuyers[swapIndex]] = [shuffledBuyers[swapIndex], shuffledBuyers[index]];
  }

  return items.flatMap((item, itemIndex) => {
    const product = products.find(product => String(product.id) === item.productId);
    if (!product) throw new Error('A selected product is no longer available.');
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Quantity must be a positive whole number.');
    const sellPrice = Number(product.sell_price), costPrice = Number(product.cost_price ?? 0);
    if (!Number.isFinite(sellPrice) || sellPrice < 0 || !Number.isFinite(costPrice) || costPrice < 0) throw new Error('This product has an invalid price.');
    const buyersForItem = selectedBuyers.length ? selectedBuyers : [shuffledBuyers[itemIndex]];
    return buyersForItem.map((buyer, buyerIndex) => ({
      seller_id: sellerId,
      order_no: `MH${batchId}-${itemIndex * buyersForItem.length + buyerIndex + 1}`,
      product_name: product.name || product.product_code,
      customer_name: buyer.name,
      shipping_address: [buyer.address, buyer.city, buyer.state, buyer.postal, buyer.country].filter(Boolean).join(', '),
      quantity,
      sell_price: sellPrice,
      cost_price: costPrice,
      status: 'Pending Payment',
    }));
  });
}
