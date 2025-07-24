import express from 'express';
import multer from 'multer';
import { PlayerService } from '../services/player.service';

const router = express.Router();
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

export default router;