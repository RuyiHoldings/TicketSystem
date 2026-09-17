import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from '../app.js';

test('POST /api/tickets creates a new ticket', async () => {
  const app = createApp({ dbPath: ':memory:' });

  const response = await request(app)
    .post('/api/tickets')
    .send({
      title: 'Login issue',
      description: 'Users cannot sign in with SSO',
      status: 'open',
      priority: 'high',
      assignee: 'Alicia',
      customerName: 'Maya Chen',
      category: 'IT Support'
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.ticket.title, 'Login issue');
  assert.equal(response.body.ticket.status, 'open');
  assert.equal(response.body.ticket.priority, 'high');
  assert.equal(response.body.ticket.customerName, 'Maya Chen');
  assert.equal(response.body.ticket.category, 'IT Support');
});

test('GET /api/tickets supports filtering by status and priority', async () => {
  const app = createApp({ dbPath: ':memory:' });

  await request(app).post('/api/tickets').send({
    title: 'First ticket',
    description: 'Needs attention',
    status: 'open',
    priority: 'high'
  });

  await request(app).post('/api/tickets').send({
    title: 'Second ticket',
    description: 'Resolved already',
    status: 'resolved',
    priority: 'low'
  });

  const response = await request(app)
    .get('/api/tickets')
    .query({ status: 'open', priority: 'high' });

  assert.equal(response.status, 200);
  assert.equal(response.body.tickets.length, 1);
  assert.equal(response.body.tickets[0].title, 'First ticket');
});

test('PATCH /api/tickets/:id updates the ticket', async () => {
  const app = createApp({ dbPath: ':memory:' });

  const created = await request(app).post('/api/tickets').send({
    title: 'Escalation',
    description: 'Server is lagging',
    status: 'open',
    priority: 'medium'
  });

  const response = await request(app)
    .patch(`/api/tickets/${created.body.ticket.id}`)
    .send({ status: 'in_progress', priority: 'high' });

  assert.equal(response.status, 200);
  assert.equal(response.body.ticket.status, 'in_progress');
  assert.equal(response.body.ticket.priority, 'high');
});

test('DELETE /api/tickets/:id removes the ticket', async () => {
  const app = createApp({ dbPath: ':memory:' });

  const created = await request(app).post('/api/tickets').send({
    title: 'Cleanup',
    description: 'Archive old tickets',
    status: 'open',
    priority: 'low'
  });

  const response = await request(app).delete(`/api/tickets/${created.body.ticket.id}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.deleted, true);

  const list = await request(app).get('/api/tickets');
  assert.equal(list.body.tickets.length, 0);
});

test('POST /api/tickets rejects invalid payloads', async () => {
  const app = createApp({ dbPath: ':memory:' });

  const response = await request(app)
    .post('/api/tickets')
    .send({ title: '', priority: 'critical' });

  assert.equal(response.status, 400);
  assert.match(response.body.error, /title|priority/i);
});
