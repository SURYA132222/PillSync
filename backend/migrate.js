const { Pool } = require('pg');
require('dotenv').config();

// This automatically uses the DATABASE_URL from your .env file
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
});

const createTables = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS medicines (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            condition_category VARCHAR(100),
            stock_quantity INT DEFAULT 0,
            dosage_unit VARCHAR(50) DEFAULT 'tablets',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS schedules (
            id SERIAL PRIMARY KEY,
            medicine_id INT REFERENCES medicines(id) ON DELETE CASCADE,
            time_of_day TIME NOT NULL,
            dosage_quantity INT DEFAULT 1,
            time_category VARCHAR(20),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS medication_logs (
            id SERIAL PRIMARY KEY,
            schedule_id INT REFERENCES schedules(id) ON DELETE CASCADE,
            user_id INT REFERENCES users(id) ON DELETE CASCADE,
            scheduled_time TIMESTAMP NOT NULL,
            action_status VARCHAR(20) CHECK (action_status IN ('TAKEN', 'MISSED', 'SNOOZED')),
            logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    try {
        await pool.query(query);
        console.log("Milestone 2 tables created successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Error creating tables:", err);
        process.exit(1);
    }
};

createTables();