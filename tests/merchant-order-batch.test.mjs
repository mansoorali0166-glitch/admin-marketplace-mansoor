import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMerchantOrders } from '../src/shared/merchantOrderBatch.js';

const products = [
  { id: 1, name: 'A', sell_price: 10, cost_price: 5 },
  { id: 2, name: 'B', sell_price: 20, cost_price: 12 },
  { id: 3, name: 'C', sell_price: 30, cost_price: 18 },
];
const items = products.map(product => ({ productId: String(product.id), quantity: 1 }));
const buyers = [
  { id: 1, name: 'One', country: 'Pakistan', address: 'A' },
  { id: 2, name: 'Two', country: 'Pakistan', address: 'B' },
  { id: 3, name: 'Three', country: 'Germany', address: 'C' },
  { id: 4, name: 'Four', country: 'Pakistan', address: 'D' },
];

test('random buyer mode uses a different buyer for every product order', () => {
  const rows = buildMerchantOrders({ sellerId: 'seller', items, products, buyers, buyerId: 'random', random: () => 0, batchId: 'batch' });
  assert.equal(new Set(rows.map(row => row.customer_name)).size, 3);
  assert.ok(rows.every(row => row.status === 'Pending Payment'));
});

test('country mode only uses distinct buyers from the selected country', () => {
  const rows = buildMerchantOrders({ sellerId: 'seller', items, products, buyers, buyerId: 'random_country', buyerCountry: 'Pakistan', random: () => 0, batchId: 'batch' });
  assert.equal(new Set(rows.map(row => row.customer_name)).size, 3);
  assert.ok(rows.every(row => row.shipping_address.endsWith('Pakistan')));
});

test('random mode refuses to reuse buyers when there are not enough', () => {
  assert.throws(() => buildMerchantOrders({ sellerId: 'seller', items, products, buyers: buyers.slice(0, 2), buyerId: 'random' }), /at least 3 different eligible buyers/);
});
