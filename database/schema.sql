-- Create custom types for Roles
CREATE TYPE user_role AS ENUM ('PATIENT', 'CAREGIVER', 'ADMIN');

-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'PATIENT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Profiles Table
CREATE TABLE profiles (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(15),
    date_of_birth DATE,
    medical_conditions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Caregiver-Patient Mapping Table
CREATE TABLE caregiver_patients (
    id SERIAL PRIMARY KEY,
    caregiver_id INT REFERENCES users(id) ON DELETE CASCADE,
    patient_id INT REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_assignment UNIQUE(caregiver_id, patient_id)
);