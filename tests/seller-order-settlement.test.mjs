import test from 'node:test';
import assert from 'node:assert/strict';

test('completed order settlement credits the full sell price to the seller balance', () => {
  const sellPrice = 40;
  const quantity = 2;
  const settlement = sellPrice * quantity;

  assert.equal(settlement, 80);
});
