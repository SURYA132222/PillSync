-- 1. Medicines Table
CREATE TABLE medicines (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    condition_category VARCHAR(100), -- e.g., 'Blood Pressure', 'Diabetes'
    stock_quantity INT DEFAULT 0,
    dosage_unit VARCHAR(50) DEFAULT 'tablets', -- e.g., 'pills', 'mg', 'ml'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Schedules Table
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    medicine_id INT REFERENCES medicines(id) ON DELETE CASCADE,
    time_of_day TIME NOT NULL, -- e.g., '08:00:00'
    dosage_quantity INT DEFAULT 1,
    time_category VARCHAR(20), -- 'MORNING', 'AFTERNOON', 'NIGHT'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Medication Logs (History & Adherence)
CREATE TABLE medication_logs (
    id SERIAL PRIMARY KEY,
    schedule_id INT REFERENCES schedules(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    scheduled_time TIMESTAMP NOT NULL,
    action_status VARCHAR(20) CHECK (action_status IN ('TAKEN', 'MISSED', 'SNOOZED')),
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);