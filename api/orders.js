/* =============================================================
   api/orders.js — POST /api/order
   Validates incoming cart data, saves to SQLite, returns order ID
   ============================================================= */

'use strict';

const crypto = require('crypto');

/* Allowed product IDs — single source of truth */
const VALID_PRODUCTS = {
  'chocolate':        { name: 'Chocolate',        price: 899 },
  'unflavored':       { name: 'Unflavored',        price: 749 },
  'cheese-berry':     { name: 'Cheese Berry',      price: 999 },
  'honey-black-pepper': { name: 'Honey Black Pepper', price: 949 },
};

module.exports = async function ordersPlugin(fastify) {
  /* Schema for fast validation (Fastify uses ajv under the hood) */
  const orderSchema = {
    body: {
      type: 'object',
      required: ['items', 'customer'],
      properties: {
        customer: {
          type: 'object',
          required: ['name', 'phone'],
          properties: {
            name:    { type: 'string', minLength: 1, maxLength: 120 },
            phone:   { type: 'string', pattern: '^[6-9]\\d{9}$' },
            email:   { type: 'string', format: 'email', maxLength: 254 },
            address: { type: 'string', maxLength: 500 },
          },
        },
        items: {
          type: 'array',
          minItems: 1,
          maxItems: 20,
          items: {
            type: 'object',
            required: ['id', 'qty'],
            properties: {
              id:  { type: 'string', maxLength: 40 },
              qty: { type: 'integer', minimum: 1, maximum: 50 },
            },
          },
        },
      },
    },
  };

  fastify.post('/api/order', { schema: orderSchema }, async (req, reply) => {
    const { items, customer } = req.body;

    /* Validate each product ID and recompute total server-side
       (never trust client-sent prices) */
    let total = 0;
    const resolvedItems = [];

    for (const item of items) {
      const product = VALID_PRODUCTS[item.id];
      if (!product) {
        return reply.code(400).send({ error: `Unknown product: ${item.id}` });
      }
      const lineTotal = product.price * item.qty;
      total += lineTotal;
      resolvedItems.push({ id: item.id, name: product.name, price: product.price, qty: item.qty, lineTotal });
    }

    /* Free shipping rule: 3+ pouches */
    const totalQty   = resolvedItems.reduce((s, i) => s + i.qty, 0);
    const shipping   = totalQty >= 3 ? 0 : 79;
    const grandTotal = total + shipping;

    /* Generate unique order ID */
    const orderId = 'HK-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    /* Persist to SQLite */
    const db = fastify.db;
    db.prepare(`
      INSERT INTO orders (order_id, customer_name, customer_phone, customer_email, customer_address, items_json, subtotal, shipping, grand_total, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
    `).run(
      orderId,
      customer.name,
      customer.phone,
      customer.email   || null,
      customer.address || null,
      JSON.stringify(resolvedItems),
      total,
      shipping,
      grandTotal,
    );

    fastify.log.info({ orderId, grandTotal }, 'New order placed');

    return reply.code(201).send({
      success:    true,
      orderId,
      subtotal:   total,
      shipping,
      grandTotal,
      message:    `Order ${orderId} placed successfully! We'll confirm within 24 hours.`,
    });
  });
};
