// backend/src/server.ts
import app from './app';
import dotenv from 'dotenv';
import type { Express } from 'express';

dotenv.config();
const PORT = process.env.PORT || 3001;

console.log(`Starting server on port ${PORT}`);
console.log('Environment variables:');
console.log(`- PORT: ${PORT}`);
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

// Start server
(app as Express).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Base URL: http://localhost:${PORT}/api`);
});