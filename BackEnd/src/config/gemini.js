import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

export const GEMINI_MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

export const EMBEDDING_MODEL_CANDIDATES = Array.from(new Set([
  process.env.EMBEDDING_MODEL,
  'gemini-embedding-2',
  'gemini-embedding-001'
].filter(Boolean)));
