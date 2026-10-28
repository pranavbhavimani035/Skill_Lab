require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Expense = require('./models/Expense');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/expense-tracker';

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Database Connection ──────────────────────────────────────────────────────

// Mongoose global settings
mongoose.set('strictQuery', true);

// Event listeners for live connection status logging
mongoose.connection.on('connected', () => {
  console.log(`✅  MongoDB connected → ${MONGO_URI}`);
});
mongoose.connection.on('error', (err) => {
  console.error(`❌  MongoDB error: ${err.message}`);
});
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️   MongoDB disconnected. Attempting to reconnect...');
});
mongoose.connection.on('reconnected', () => {
  console.log('🔄  MongoDB reconnected successfully.');
});

// Initiate connection — server stays alive even if MongoDB is temporarily down
mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,   // fail fast with a clear message
    socketTimeoutMS: 45000,           // close idle sockets after 45 s
  })
  .catch((err) => {
    // Log clearly but do NOT call process.exit — server remains available
    console.error(`❌  MongoDB initial connection failed: ${err.message}`);
    console.error('   Make sure MongoDB is running on 127.0.0.1:27017');
    console.error('   API routes will return 500 until the DB is reachable.');
  });

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/expenses
 * Fetch all expenses sorted newest-first.
 */
app.get('/api/expenses', async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ createdAt: -1 });
    res.status(200).json(expenses);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch expenses', error: err.message });
  }
});

/**
 * POST /api/expenses
 * Create a new expense document.
 */
app.post('/api/expenses', async (req, res) => {
  try {
    const { title, amount, category } = req.body;
    const newExpense = new Expense({ title, amount, category });
    const savedExpense = await newExpense.save();
    res.status(201).json(savedExpense);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: 'Validation failed', errors: messages });
    }
    res.status(500).json({ message: 'Failed to create expense', error: err.message });
  }
});

/**
 * PUT /api/expenses/:id
 * Update an existing expense by ID.
 */
app.put('/api/expenses/:id', async (req, res) => {
  try {
    const { title, amount, category } = req.body;
    const updatedExpense = await Expense.findByIdAndUpdate(
      req.params.id,
      { title, amount, category },
      { new: true, runValidators: true }
    );
    if (!updatedExpense) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    res.status(200).json(updatedExpense);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: 'Validation failed', errors: messages });
    }
    res.status(500).json({ message: 'Failed to update expense', error: err.message });
  }
});

/**
 * DELETE /api/expenses/:id
 * Delete an expense by ID.
 */
app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const deleted = await Expense.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    res.status(200).json({ message: 'Expense deleted successfully', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete expense', error: err.message });
  }
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀  Expense Tracker API running on http://localhost:${PORT}`);
});
