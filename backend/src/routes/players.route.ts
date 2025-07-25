import express from 'express';
import { Router } from 'express';
import multer from 'multer';
import { PlayerService } from '../services/player.service';
import { PrismaClient } from '@prisma/client';


const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

const router = Router();
const upload = multer({ dest: 'uploads/' });
const playerService = new PlayerService();

// Excel import endpoint
router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  try {
    const result = await playerService.importFromExcel(req.file.path);
    res.json({ message: `Imported ${result.count} players` });
  } catch (error) {
    res.status(500).json({ error: 'Import failed' });
  }
});

// Get players endpoint
router.get('/', async (req, res) => {
  const scoring = req.query.scoring as 'PPR' | 'Standard' | undefined;
  const players = await playerService.getPlayers(scoring);
  res.json(players);
});

router.get('/test-db', async (req, res) => {
  try {
    await prisma.$connect();
    const playerCount = await prisma.player.count();
    res.json({ status: 'connected', playerCount });
  } catch (error) {
    res.status(500).json({ error: 'Connection failed', details: error });
  }
});

export default router;