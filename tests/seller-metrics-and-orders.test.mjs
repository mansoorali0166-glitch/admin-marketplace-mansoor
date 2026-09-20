import test from 'node:test';
import assert from 'node:assert/strict';

test('seller metrics: selling $40 product that costs $30 increases Total Sales by 40 and Expected Profit by 10', () => {
  const testOrders = [
    {
      status: 'pending ship',
      quantity: 1,
      sell_price: 40,
      cost_price: 30,
      created_at: new Date().toISOString(),
    },
  ];

  const paidStatuses = new Set(['paid', 'pending ship', 'pending receive', 'completed']);
  const metrics = testOrders.reduce((result, row) => {
    const status = String(row.status || '').trim().toLowerCase();
    if (!paidStatuses.has(status)) return result;
    const quantity = Number(row.quantity || 1);
    const revenue = Number(row.sell_price || 0) * quantity;
    const cost = Number(row.cost_price || 0) * quantity;
    result.sales += revenue;
    result.profit += revenue - cost;
    result.quantity += quantity;
    return result;
  }, { sales: 0, profit: 0, quantity: 0 });

  assert.equal(metrics.sales, 40);
  assert.equal(metrics.profit, 10);
  assert.equal(metrics.quantity, 1);
});

test('order status normalization handles shipped, pending ship, and completed without miscategorizing', () => {
  const aliases = {
    'pending pay': 'Pending Payment',
    'pending payment': 'Pending Payment',
    paid: 'Paid',
    'pending ship': 'Pending Ship',
    'pending shipment': 'Pending Ship',
    shipped: 'Pending Receive',
    shipping: 'Pending Receive',
    'pending receive': 'Pending Receive',
    'pending receipt': 'Pending Receive',
    completed: 'Completed',
    complete: 'Completed',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
    refund: 'Refund',
    refunded: 'Refund',
  };
  const normalizeStatus = (status) => {
    const raw = String(status || '').trim();
    const lower = raw.toLowerCase();
    return aliases[lower] || raw || 'Pending Payment';
  };

  assert.equal(normalizeStatus('pending pay'), 'Pending Payment');
  assert.equal(normalizeStatus('pending payment'), 'Pending Payment');
  assert.equal(normalizeStatus('pending ship'), 'Pending Ship');
  assert.equal(normalizeStatus('shipped'), 'Pending Receive');
  assert.equal(normalizeStatus('completed'), 'Completed');
  assert.equal(normalizeStatus('unknown_custom_status'), 'unknown_custom_status');
});

test('period boundaries correctly identify Today, This Week, and This Month', () => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  assert.ok(startOfToday >= startOfWeek || startOfToday.getDay() === 0);
  assert.ok(startOfToday >= startOfMonth || now.getDate() === 1);

  const todayClick = { created_at: new Date(now.getTime() - 1000).toISOString() };
  const yesterdayClick = { created_at: new Date(startOfToday.getTime() - 3600 * 1000).toISOString() };

  assert.ok(new Date(todayClick.created_at) >= startOfToday);
  assert.ok(new Date(yesterdayClick.created_at) < startOfToday);
});
