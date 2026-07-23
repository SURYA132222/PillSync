const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- AUTHENTICATION MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied. Token missing.' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
};

// --- ROLE-BASED ACCESS CONTROL MIDDLEWARE ---
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Unauthorized role.' });
    }
    next();
  };
};

// --- BACKGROUND REMINDER WORKER (NODE-CRON) ---
const initReminderCron = () => {
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            const currentTime = now.toTimeString().split(' ')[0]; 

            const query = `
                SELECT s.id as schedule_id, s.medicine_id, s.dosage_quantity, m.user_id, m.name as medicine_name
                FROM schedules s
                JOIN medicines m ON s.medicine_id = m.id
                WHERE s.is_active = TRUE AND s.time_of_day::text LIKE $1;
            `;
            const timePrefix = currentTime.substring(0, 5) + '%';
            const result = await pool.query(query, [timePrefix]);

            if (result.rows.length > 0) {
                result.rows.forEach(row => {
                    console.log(`[REMINDER TRIGGER] Time to take ${row.dosage_quantity} of ${row.medicine_name} for User ID: ${row.user_id}`);
                });
            }
        } catch (err) {
            console.error("Error running reminder cron job:", err);
        }
    });

    console.log("Medication reminder cron job initialized.");
};

// Start the cron job
initReminderCron();


// --- ROUTES ---

// 1. User Registration
app.post('/api/auth/register', async (req, res) => {
  const { email, password, role, firstName, lastName } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userRes = await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, hashedPassword, role || 'PATIENT']
    );
    
    const newUser = userRes.rows[0];
    
    await pool.query(
      'INSERT INTO profiles (user_id, first_name, last_name) VALUES ($1, $2, $3)',
      [newUser.id, firstName, lastName]
    );

    res.status(201).json({ message: 'User registered successfully!', user: newUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. User Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) return res.status(400).json({ error: 'User not found.' });

    const user = userRes.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password.' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2h' });
    res.json({ token, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Protected Test Routes
app.get('/api/patient/dashboard', authenticateToken, authorizeRoles('PATIENT', 'ADMIN'), async (req, res) => {
  res.json({ message: `Welcome to your Patient Dashboard, User ID: ${req.user.id}` });
});

app.get('/api/caregiver/dashboard', authenticateToken, authorizeRoles('CAREGIVER', 'ADMIN'), async (req, res) => {
  res.json({ message: `Welcome to the Caregiver Dashboard, User ID: ${req.user.id}` });
});

// --- MEDICINE MANAGEMENT ROUTES (Milestone 2) ---

app.post('/api/medicines', authenticateToken, async (req, res) => {
    const userId = req.user.id; 
    const { name, conditionCategory, stockQuantity, dosageUnit, timeOfDay, dosageQuantity, timeCategory } = req.body;

    try {
        await pool.query('BEGIN');

        const medicineQuery = `
            INSERT INTO medicines (user_id, name, condition_category, stock_quantity, dosage_unit)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const medicineValues = [userId, name, conditionCategory, stockQuantity || 0, dosageUnit || 'tablets'];
        const medicineResult = await pool.query(medicineQuery, medicineValues);
        const newMedicine = medicineResult.rows[0];

        const scheduleQuery = `
            INSERT INTO schedules (medicine_id, time_of_day, dosage_quantity, time_category)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const scheduleValues = [newMedicine.id, timeOfDay, dosageQuantity || 1, timeCategory];
        const scheduleResult = await pool.query(scheduleQuery, scheduleValues);

        await pool.query('COMMIT');

        res.status(201).json({
            message: "Medicine and schedule added successfully",
            medicine: newMedicine,
            schedule: scheduleResult.rows[0]
        });
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/medicines', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const query = `
            SELECT m.*, s.id as schedule_id, s.time_of_day, s.dosage_quantity, s.time_category, s.is_active
            FROM medicines m
            LEFT JOIN schedules s ON m.id = s.medicine_id
            WHERE m.user_id = $1;
        `;
        const result = await pool.query(query, [userId]);
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- MEDICATION ACTION LOGGING & ADHERENCE (Milestone 2 Completion) ---

app.post('/api/medication-logs', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { scheduleId, medicineId, status, dosageTaken } = req.body; 

    try {
        await pool.query('BEGIN');

        const logQuery = `
            INSERT INTO medication_logs (schedule_id, user_id, status, logged_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING *;
        `;
        const logResult = await pool.query(logQuery, [scheduleId, userId, status]);

        if (status === 'TAKEN' && medicineId) {
            const updateStockQuery = `
                UPDATE medicines
                SET stock_quantity = GREATEST(0, stock_quantity - $1),
                    updated_at = NOW()
                WHERE id = $2 AND user_id = $3
                RETURNING stock_quantity;
            `;
            const deductionAmount = dosageTaken || 1;
            await pool.query(updateStockQuery, [deductionAmount, medicineId, userId]);
        }

        await pool.query('COMMIT');

        res.status(201).json({
            message: `Medication action '${status}' logged successfully`,
            log: logResult.rows[0]
        });
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/medication-logs', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const query = `
            SELECT l.*, s.time_of_day, m.name as medicine_name, m.dosage_unit
            FROM medication_logs l
            JOIN schedules s ON l.schedule_id = s.id
            JOIN medicines m ON s.medicine_id = m.id
            WHERE l.user_id = $1
            ORDER BY l.logged_at DESC;
        `;
        const result = await pool.query(query, [userId]);
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running safely on port ${PORT}`));
