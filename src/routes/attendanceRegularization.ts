import express from 'express';
import { AttendanceRegularizationController } from '../controllers/AttendanceRegularizationController.js';

const router = express.Router();

// Save attendance regularizations
router.post('/regularize', AttendanceRegularizationController.saveRegularizations);

// Get regularizations for employee and month
router.get('/regularization/:employeeCode', AttendanceRegularizationController.getRegularizations);

// Delete a regularization
router.delete('/regularization/:employeeCode/:date', AttendanceRegularizationController.deleteRegularization);

export default router;

