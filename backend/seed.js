require('dotenv').config();
const mongoose = require('mongoose');
const Expense = require('./models/Expense');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/expense-tracker';

// ─── Seed Data Dictionaries ───────────────────────────────────────────────────
const seedData = {
  Food: [
    'Morning Coffee',
    'Lunch at Cafe',
    'Grocery Run',
    'Pizza Night',
    'Sushi Dinner',
    'Breakfast Burrito',
    'Farmers Market',
    'Burger and Fries',
    'Smoothie Bowl',
    'Thai Takeout',
  ],
  Transport: [
    'Uber Ride',
    'Monthly Metro Pass',
    'Gas Station Fill-Up',
    'Lyft to Airport',
    'Parking Fee',
    'Toll Charges',
    'Bike Share Rental',
    'Bus Ticket',
    'Car Wash',
    'Oil Change',
  ],
  Entertainment: [
    'Netflix Subscription',
    'Movie Tickets',
    'Concert Entry',
    'Spotify Premium',
    'Video Game Purchase',
    'Museum Visit',
    'Bowling Night',
    'Comedy Show',
    'Book Purchase',
    'Escape Room',
  ],
  Utilities: [
    'Electricity Bill',
    'Water Bill',
    'Internet Subscription',
    'Phone Bill',
    'Gas Bill',
    'Cloud Storage Plan',
    'Streaming Bundle',
    'Gym Membership',
    'Software License',
    'Domain Renewal',
  ],
  General: [
    'Amazon Purchase',
    'Clothing Haul',
    'Haircut',
    'Doctor Visit Copay',
    'Birthday Gift',
    'Office Supplies',
    'Home Decor',
    'Pharmacy Run',
    'Laundry Service',
    'Stationery Pack',
  ],
};

const categories = Object.keys(seedData);

// ─── Utility Helpers ─────────────────────────────────────────────────────────
/**
 * Returns a random float between min and max, rounded to 2 decimal places.
 */
function randomAmount(min = 5, max = 120) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

/**
 * Returns a Date object for a random moment within the past `maxDaysAgo` days.
 * Uses a square-root bias so recent days appear more frequently, simulating
 * real spending patterns.
 */
function randomPastDate(maxDaysAgo = 90) {
  const biasedRatio = Math.pow(Math.random(), 0.7);
  const daysAgo = Math.floor(biasedRatio * maxDaysAgo);
  const hoursAgo = Math.floor(Math.random() * 24);
  const minutesAgo = Math.floor(Math.random() * 60);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(date.getHours() - hoursAgo);
  date.setMinutes(date.getMinutes() - minutesAgo);
  return date;
}

/**
 * Picks a random element from an array.
 */
function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Generate Mock Expenses ───────────────────────────────────────────────────
function generateExpenses(count = 50) {
  const expenses = [];

  // Distribute categories with weighted probability (Food & Transport more frequent)
  const weightedCategories = [
    ...Array(14).fill('Food'),
    ...Array(10).fill('Transport'),
    ...Array(10).fill('Entertainment'),
    ...Array(8).fill('Utilities'),
    ...Array(8).fill('General'),
  ];

  for (let i = 0; i < count; i++) {
    const category = randomPick(weightedCategories);
    const titles = seedData[category];
    const title = randomPick(titles);
    const amount = randomAmount(5, 120);
    const date = randomPastDate(90);

    expenses.push({
      title,
      amount,
      category,
      createdAt: date,
      updatedAt: date,
    });
  }

  // Sort by date ascending so insertMany preserves chronological order in DB
  expenses.sort((a, b) => a.createdAt - b.createdAt);
  return expenses;
}

// ─── Main Seeder ─────────────────────────────────────────────────────────────
async function seed() {
  try {
    console.log('🔌  Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅  Connected to MongoDB');

    console.log('🗑️   Clearing existing expenses...');
    const deleteResult = await Expense.deleteMany({});
    console.log(`   Deleted ${deleteResult.deletedCount} existing records.`);

    console.log('🌱  Generating 50 mock expenses...');
    const mockExpenses = generateExpenses(50);

    // Use insertMany with timestamps: false so we can set our own createdAt/updatedAt
    const inserted = await Expense.insertMany(mockExpenses, { timestamps: false });
    console.log(`✅  Successfully seeded ${inserted.length} expenses into the database.`);

    // Print a summary by category
    const summary = {};
    inserted.forEach((e) => {
      summary[e.category] = (summary[e.category] || 0) + 1;
    });
    console.log('\n📊  Seed Summary by Category:');
    Object.entries(summary).forEach(([cat, count]) => {
      console.log(`   ${cat.padEnd(15)} → ${count} records`);
    });

    const total = inserted.reduce((sum, e) => sum + e.amount, 0);
    console.log(`\n💰  Total seeded amount: $${total.toFixed(2)}`);
  } catch (err) {
    console.error('❌  Seeding failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔒  MongoDB connection closed. Seeding complete!');
    process.exit(0);
  }
}

seed();
