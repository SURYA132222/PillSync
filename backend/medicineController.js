const pool = require('../db'); // Adjust based on your existing db pool import

// Add a new medicine and its schedule
const addMedicine = async (req, res) => {
    const { userId, name, conditionCategory, stockQuantity, dosageUnit, timeOfDay, dosageQuantity, timeCategory } = req.body;

    try {
        // Start a transaction
        await pool.query('BEGIN');

        // 1. Insert into medicines table
        const medicineQuery = `
            INSERT INTO medicines (user_id, name, condition_category, stock_quantity, dosage_unit)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const medicineValues = [userId, name, conditionCategory, stockQuantity, dosageUnit];
        const medicineResult = await pool.query(medicineQuery, medicineValues);
        const newMedicine = medicineResult.rows[0];

        // 2. Insert into schedules table
        const scheduleQuery = `
            INSERT INTO schedules (medicine_id, time_of_day, dosage_quantity, time_category)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const scheduleValues = [newMedicine.id, timeOfDay, dosageQuantity, timeCategory];
        const scheduleResult = await pool.query(scheduleQuery, scheduleValues);

        // Commit transaction
        await pool.query('COMMIT');

        res.status(201).json({
            message: "Medicine and schedule added successfully",
            medicine: newMedicine,
            schedule: scheduleResult.rows[0]
        });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error("Error adding medicine:", err);
        res.status(500).json({ error: "Server error while adding medicine" });
    }
};

// Get all medicines for a user
const getMedicines = async (req, res) => {
    const { userId } = req.params;

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
        console.error("Error fetching medicines:", err);
        res.status(500).json({ error: "Server error while fetching medicines" });
    }
};

module.exports = {
    addMedicine,
    getMedicines
};