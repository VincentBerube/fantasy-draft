import app from './app';
import dotenv from 'dotenv';
import type { Express } from 'express'; // Add this import

dotenv.config();
const PORT = process.env.PORT || 3001;

// Add type assertion
(app as Express).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});