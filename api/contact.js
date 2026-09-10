/* =============================================================
   api/contact.js — POST /api/contact
   Saves contact / newsletter form submissions to SQLite
   ============================================================= */

'use strict';

module.exports = async function contactPlugin(fastify) {
  const contactSchema = {
    body: {
      type: 'object',
      required: ['name', 'email'],
      properties: {
        name:    { type: 'string', minLength: 1, maxLength: 120 },
        email:   { type: 'string', format: 'email', maxLength: 254 },
        message: { type: 'string', maxLength: 2000 },
        subject: { type: 'string', maxLength: 200 },
      },
    },
  };

  fastify.post('/api/contact', { schema: contactSchema }, async (req, reply) => {
    const { name, email, message = '', subject = 'General Enquiry' } = req.body;

    const db = fastify.db;

    /* Prevent duplicate submissions — same email + message within 5 minutes */
    const recent = db.prepare(`
      SELECT id FROM contacts
      WHERE email = ? AND message = ?
        AND created_at > datetime('now', '-5 minutes')
      LIMIT 1
    `).get(email, message);

    if (recent) {
      return reply.code(429).send({ error: 'Duplicate submission. Please wait a few minutes before trying again.' });
    }

    db.prepare(`
      INSERT INTO contacts (name, email, subject, message, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(name, email, subject, message);

    fastify.log.info({ email, subject }, 'New contact submission');

    return reply.code(201).send({
      success: true,
      message: "Thanks for reaching out! We'll get back to you within 24 hours.",
    });
  });
};
