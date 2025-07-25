// backend/src/app.ts
import * as express from 'express';
import * as cors from 'cors';
import playerRoutes from './routes/players.route';

const app: express.Express = express.default(); // Explicit typing

app.use(cors.default({
  origin: 'http://localhost:5173'
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/players', playerRoutes);

export default app;