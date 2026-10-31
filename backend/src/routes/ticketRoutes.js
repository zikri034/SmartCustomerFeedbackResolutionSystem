'use strict';

const { Router } = require('express');
const {
  createTicket,
  listTickets,
  getTicket,
  updateTicketStatus,
  getMetrics,
} = require('../controllers/ticketController');

const router = Router();

// Aggregate metrics — must be registered BEFORE /:id to avoid route shadowing
router.get('/metrics', getMetrics);

router.get('/', listTickets);
router.post('/', createTicket);
router.get('/:id', getTicket);
router.patch('/:id/status', updateTicketStatus);

module.exports = router;
