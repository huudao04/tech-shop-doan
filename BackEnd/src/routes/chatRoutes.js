import express from 'express';
import { handleChat, clearChatHistory } from '../controllers/chatController.js';

const router = express.Router();

router.post('/', handleChat);
router.post('/ask', handleChat);
router.delete('/clear', clearChatHistory);

export default router;
