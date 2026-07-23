const express = require('express');
const router = express.Router();
const { addMedicine, getMedicines } = require('../controllers/medicineController');

// POST /api/medicines -> Add medicine & schedule
router.post('/', addMedicine);

// GET /api/medicines/:userId -> Get user's medicines
router.get('/:userId', getMedicines);

module.exports = router;