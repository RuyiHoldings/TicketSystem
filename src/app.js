import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALID_STATUS = ['open', 'in_progress', 'resolved', 'closed'];
const VALID_PRIORITY = ['low', 'medium', 'high'];

function parseFilters(query) {
  const filters = {};

  if (query.status) {
    filters.status = String(query.status).trim();
  }

  if (query.priority) {
    filters.priority = String(query.priority).trim();
  }

  return filters;
}

function validateTicket(ticket) {
  const errors = [];

  if (!ticket || typeof ticket !== 'object') {
    return ['Request body is required'];
  }

  if (typeof ticket.title !== 'string' || ticket.title.trim() === '') {
    errors.push('title is required');
  }

  if (ticket.description !== undefined && ticket.description !== null && typeof ticket.description !== 'string') {
    errors.push('description must be a string');
  }

  if (ticket.status !== undefined && ticket.status !== null && !VALID_STATUS.includes(ticket.status)) {
    errors.push('status must be one of: open, in_progress, resolved, closed');
  }

  if (ticket.priority !== undefined && ticket.priority !== null && !VALID_PRIORITY.includes(ticket.priority)) {
    errors.push('priority must be one of: low, medium, high');
  }

  if (ticket.assignee !== undefined && ticket.assignee !== null && typeof ticket.assignee !== 'string') {
    errors.push('assignee must be a string');
  }

  if (ticket.customerName !== undefined && ticket.customerName !== null && typeof ticket.customerName !== 'string') {
    errors.push('customerName must be a string');
  }

  if (ticket.category !== undefined && ticket.category !== null && typeof ticket.category !== 'string') {
    errors.push('category must be a string');
  }

  return errors;
}

function serializeTicket(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignee: row.assignee,
    customerName: row.customer_name,
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createApp({ dbPath = './data/tickets.db' } = {}) {
  const app = express();
  const db = createDatabase(dbPath);

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/tickets', (req, res) => {
    const filters = parseFilters(req.query);
    let query = 'SELECT * FROM tickets';
    const values = [];

    if (filters.status || filters.priority) {
      const clauses = [];

      if (filters.status) {
        clauses.push('status = ?');
        values.push(filters.status);
      }

      if (filters.priority) {
        clauses.push('priority = ?');
        values.push(filters.priority);
      }

      query += ` WHERE ${clauses.join(' AND ')}`;
    }

    query += ' ORDER BY created_at DESC';

    const rows = db.prepare(query).all(...values);
    res.json({ tickets: rows.map(serializeTicket) });
  });

  app.post('/api/tickets', (req, res) => {
    const errors = validateTicket(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO tickets (title, description, status, priority, assignee, customer_name, category, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.body.title.trim(),
      req.body.description ?? '',
      req.body.status ?? 'open',
      req.body.priority ?? 'medium',
      req.body.assignee ?? null,
      req.body.customerName ?? null,
      req.body.category ?? null,
      now,
      now
    );

    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({ ticket: serializeTicket(ticket) });
  });

  app.patch('/api/tickets/:id', (req, res) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(Number(id));

    if (!existing) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const nextValues = {
      title: req.body.title ?? existing.title,
      description: req.body.description ?? existing.description,
      status: req.body.status ?? existing.status,
      priority: req.body.priority ?? existing.priority,
      assignee: req.body.assignee ?? existing.assignee,
      customerName: req.body.customerName ?? existing.customer_name,
      category: req.body.category ?? existing.category
    };

    const validationErrors = validateTicket(nextValues);
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: validationErrors.join(', ') });
    }

    const updated = db.prepare(`
      UPDATE tickets
      SET title = ?, description = ?, status = ?, priority = ?, assignee = ?, customer_name = ?, category = ?, updated_at = ?
      WHERE id = ?
    `).run(
      nextValues.title.trim(),
      nextValues.description ?? '',
      nextValues.status,
      nextValues.priority,
      nextValues.assignee ?? null,
      nextValues.customerName ?? null,
      nextValues.category ?? null,
      new Date().toISOString(),
      Number(id)
    );

    if (updated.changes === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(Number(id));
    return res.json({ ticket: serializeTicket(ticket) });
  });

  app.delete('/api/tickets/:id', (req, res) => {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM tickets WHERE id = ?').run(Number(id));

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    return res.json({ deleted: true });
  });

  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  return app;
}
