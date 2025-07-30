// backend/src/routes/players.route.ts
import { Router } from 'express';
import multer from 'multer';
import { PlayerService } from '../services/player.service';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const router = Router();
const upload = multer({ dest: 'uploads/' });
const playerService = new PlayerService();

interface MulterRequest extends Express.Request {
  [x: string]: any;
  file?: Express.Multer.File;
}

// Enhanced Excel import endpoint with merge strategy
router.post('/import', upload.single('file'), async (req: MulterRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const mergeStrategy = req.body.mergeStrategy as 'update' | 'preserve' || 'update';
  
  try {
    const result = await playerService.importAndMergeFromExcel(req.file.path, mergeStrategy);
    
    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupError) {
      console.warn('Failed to cleanup uploaded file:', cleanupError);
    }
    
    res.json({ 
      success: true,
      message: `Import completed: ${result.newCount} new players added, ${result.updatedCount} players updated, ${result.mergedCount} data merged`,
      ...result
    });
  } catch (error: any) {
    console.error('Import failed:', error);
    
    // Clean up uploaded file on error
    try {
      if (req.file?.path) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup uploaded file after error:', cleanupError);
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Import failed',
      details: error.message 
    });
  }
});

// Legacy import endpoint (for backward compatibility)
router.post('/import/legacy', upload.single('file'), async (req: MulterRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    const result = await playerService.importFromExcel(req.file.path);
    
    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupError) {
      console.warn('Failed to cleanup uploaded file:', cleanupError);
    }
    
    res.json({ 
      success: true,
      message: `Import completed: ${result.newCount} new players added, ${result.updatedCount} players updated`,
      ...result
    });
  } catch (error: any) {
    console.error('Import failed:', error);
    
    // Clean up uploaded file on error
    try {
      if (req.file?.path) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup uploaded file after error:', cleanupError);
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Import failed',
      details: error.message 
    });
  }
});

// Export players to Excel - MUST COME BEFORE DYNAMIC ROUTES
router.get('/export', async (req, res) => {
  console.log('Export endpoint called');
  try {
    const buffer = await playerService.exportPlayers();
    
    // Set headers for Excel download
    res.setHeader('Content-Disposition', 'attachment; filename=fantasy_players_export.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Length', Buffer.byteLength(buffer).toString());
    
    // Send buffer directly
    res.send(buffer);
    console.log('Export completed successfully');
  } catch (error: any) {
    console.error('Export failed:', error);
    
    // Return JSON error
    res.status(500).json({ 
      error: 'Export failed', 
      details: error.message 
    });
  }
});

// Get players endpoint with enhanced filtering
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

// Get a single player by ID
router.get('/:id', async (req, res) => {
  try {
    const player = await playerService.getPlayerById(req.params.id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json(player);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to fetch player', 
      details: error.message 
    });
  }
});

// Update player notes
router.patch('/:id/notes', async (req, res) => {
  try {
    if (!Array.isArray(req.body.notes)) {
      return res.status(400).json({ error: 'Notes must be an array of strings' });
    }
    
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
    if (!Array.isArray(req.body.tags)) {
      return res.status(400).json({ error: 'Tags must be an array of strings' });
    }
    
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

// Bulk update endpoint for advanced operations
router.patch('/bulk/update', async (req, res) => {
  try {
    const { playerIds, updates } = req.body;
    
    if (!Array.isArray(playerIds) || !updates) {
      return res.status(400).json({ error: 'Invalid bulk update request' });
    }
    
    // This would need to be implemented in the service
    // For now, return not implemented
    res.status(501).json({ error: 'Bulk update not yet implemented' });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Bulk update failed', 
      details: error.message 
    });
  }
});

export default router;