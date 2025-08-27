// backend/src/app.ts
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import playersRouter from './routes/players.route';
import tiersRouter from './routes/tiers.route';
import tagsRouter from './routes/tags.route';
import sleeperRouter from './routes/sleeper.route';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// File upload middleware
const upload = multer({ dest: 'uploads/' });

// Routes
app.use('/api/players', playersRouter);
app.use('/api/tiers', tiersRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/sleeper', sleeperRouter);

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