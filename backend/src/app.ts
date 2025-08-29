// backend/src/app.ts
import * as express from 'express';
import * as cors from 'cors';
import playerRoutes from './routes/players.route';

const app: express.Express = express.default();

// Enhanced CORS configuration
app.use(cors.default({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Detailed request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Mount player routes
app.use('/api/players', playerRoutes);

// Print all registered routes
app._router.stack.forEach((middleware: any) => {
  if (middleware.route) {
    // Routes registered directly on the app
    console.log(`${Object.keys(middleware.route.methods)[0].toUpperCase()} ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    // Routes registered on router instances
    middleware.handle.stack.forEach((handler: any) => {
      if (handler.route) {
        console.log(`${Object.keys(handler.route.methods)[0].toUpperCase()} /api/players${handler.route.path}`);
      }
    });
  }
});

// 404 handler
app.use((req, res) => {
  console.error(`404: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Not found' });
});

export default app;