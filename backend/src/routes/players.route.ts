import { Router } from 'express';
import multer from 'multer';
import { PlayerService } from '../services/player.service';

const router = Router();
const upload = multer({ dest: 'uploads/' });
const playerService = new PlayerService();

interface MulterRequest extends Express.Request {
  file?: Express.Multer.File;
}

// Excel import endpoint
router.post('/import', upload.single('file'), async (req: MulterRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    const result = await playerService.importFromExcel(req.file.path);
    res.json({ 
      success: true,
      message: `Import completed: ${result.newCount} new players added, ${result.updatedCount} players updated`,
      ...result
    });
  } catch (error: any) {
    console.error('Import failed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Import failed',
      details: error.message 
    });
  }
});

// Get players endpoint
router.get('/', async (req, res) => {
  const scoring = req.query.scoring as 'PPR' | 'Standard' | undefined;
  
  try {
    const players = await playerService.getPlayers(scoring);
    res.json(players);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to fetch players', 
      details: error.message 
    });
  }
});

// Update player notes
router.patch('/:id/notes', async (req, res) => {
  try {
    const player = await playerService.updatePlayerNotes(
      req.params.id,
      req.body.notes
    );
    res.json(player);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to update notes', 
      details: error.message 
    });
  }
});

// Update player tags
router.patch('/:id/tags', async (req, res) => {
  try {
    const player = await playerService.updatePlayerTags(
      req.params.id,
      req.body.tags
    );
    res.json(player);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to update tags', 
      details: error.message 
    });
  }
});

export default router;