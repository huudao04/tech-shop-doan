import express from 'express';
import { calculateShippingFee } from '../controllers/shippingController.js';

const router = express.Router();

// API nhận tọa độ để tính khoảng cách và trả về số tiền ship
router.post('/calculate-fee', calculateShippingFee);

export default router;