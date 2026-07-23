const cron = require('node-cron');
const pool = require('../db'); // Adjust if your pool connection is imported differently

// Run every minute to check if any medication is scheduled for the current time
const initReminderCron = () => {
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            const currentTime = now.toTimeString().split(' ')[0]; // Format: HH:MM:SS

            // Fetch active schedules matching the current time
            const query = `
                SELECT s.id as schedule_id, s.medicine_id, s.dosage_quantity, m.user_id, m.name as medicine_name
                FROM schedules s
                JOIN medicines m ON s.medicine_id = m.id
                WHERE s.is_active = TRUE AND s.time_of_day::text LIKE $1;
            `;
            // Match the hours and minutes (e.g., '08:30')
            const timePrefix = currentTime.substring(0, 5) + '%';
            const result = await pool.query(query, [timePrefix]);

            if (result.rows.length > 0) {
                result.rows.forEach(row => {
                    console.log(`[REMINDER TRIGGER] Time to take ${row.dosage_quantity} of ${row.medicine_name} for User ID: ${row.user_id}`);
                    // Here you can later plug in push notifications, WebSockets, or email alerts
                });
            }
        } catch (err) {
            console.error("Error running reminder cron job:", err);
        }
    });

    console.log("Medication reminder cron job initialized.");
};

module.exports = initReminderCron;