// backend/src/app.ts
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import playersRouter from './routes/players.route';
import sleeperRouter from './routes/sleeper.route'; // New import

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// File upload middleware
const upload = multer({ dest: 'uploads/' });

// Routes
app.use('/api/players', playersRouter);
app.use('/api/sleeper', sleeperRouter); // New route

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      sleeper: 'available'
    }
  });
});

export default app;