import { SePayPgClient } from 'sepay-pg-node';
import 'dotenv/config';

const sepayClient = new SePayPgClient({
  env: 'live',
  merchant_id: process.env.SEPAY_MERCHANT_ID,
  secret_key: process.env.SEPAY_SECRET_KEY
});

export default sepayClient;
