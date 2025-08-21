// backend/src/routes/players.route.ts
import { Router } from 'express';
import multer from 'multer';
import { PlayerService } from '../services/player.service';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const router = Router();
const upload = multer({ dest: 'uploads/' });
const playerService = new PlayerService();
const prisma = new PrismaClient();

interface MulterRequest extends Express.Request {
  [x: string]: any;
  file?: Express.Multer.File;
}

// Enhanced Excel import endpoint with merge strategy and duplicate detection
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
      message: `Import completed: ${result.newCount} new players added, ${result.updatedCount} players updated, ${result.duplicateCount} duplicates handled`,
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
    
    res.setHeader('Content-Disposition', 'attachment; filename=fantasy_players_export.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Length', Buffer.byteLength(buffer).toString());
    
    res.send(buffer);
    console.log('Export completed successfully');
  } catch (error: any) {
    console.error('Export failed:', error);
    
    res.status(500).json({ 
      error: 'Export failed', 
      details: error.message 
    });
  }
});

// Get players endpoint with enhanced filtering
router.get('/', async (req, res) => {
  const scoring = req.query.scoring as 'PPR' | 'Standard' | undefined;
  const includeDrafted = req.query.includeDrafted !== 'false';
  
  try {
    const players = await playerService.getPlayers(scoring, includeDrafted);
    res.json(players);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to fetch players', 
      details: error.message 
    });
  }
});

// FAST UPDATE endpoint for inline editing (no joins) - MUST COME BEFORE /:id route
router.patch('/:id/quick', async (req, res) => {
  console.log('Fast update called for player:', req.params.id, 'with data:', req.body);
  try {
    // Simple update without expensive joins for better performance
    const player = await prisma.player.update({
      where: { id: req.params.id },
      data: req.body,
      select: {
        id: true,
        name: true,
        position: true,
        customRank: true,
        projectedPoints: true,
        vorp: true,
        adp: true,
        rank: true,
        team: true,
        byeWeek: true,
        tierId: true,
        isDrafted: true,
      }
    });
    
    console.log('Fast update successful:', player);
    res.json(player);
  } catch (error: any) {
    console.error('Fast update failed:', error);
    res.status(500).json({ 
      error: 'Failed to update player', 
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

// Update player (for complex updates that need relations)
router.patch('/:id', async (req, res) => {
  try {
    const player = await playerService.updatePlayer(req.params.id, req.body);
    res.json(player);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to update player', 
      details: error.message 
    });
  }
});

// Delete player
router.delete('/:id', async (req, res) => {
  try {
    await playerService.deletePlayer(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to delete player', 
      details: error.message 
    });
  }
});

// Update player ranking
router.patch('/:id/rank', async (req, res) => {
  try {
    const { rank } = req.body;
    if (typeof rank !== 'number') {
      return res.status(400).json({ error: 'Rank must be a number' });
    }
    
    const player = await playerService.updatePlayerRanking(req.params.id, rank);
    res.json(player);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to update ranking', 
      details: error.message 
    });
  }
});

// Toggle draft status
router.patch('/:id/draft', async (req, res) => {
  try {
    const { isDrafted } = req.body;
    if (typeof isDrafted !== 'boolean') {
      return res.status(400).json({ error: 'isDrafted must be a boolean' });
    }
    
    const player = await playerService.toggleDraftStatus(req.params.id, isDrafted);
    res.json(player);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to update draft status', 
      details: error.message 
    });
  }
});

// Tag management endpoints
router.get('/tags/all', async (req, res) => {
  try {
    const tags = await playerService.getTags();
    res.json(tags);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to fetch tags', 
      details: error.message 
    });
  }
});

router.post('/tags', async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Tag name is required' });
    }
    
    const tag = await playerService.createTag(name, color || '#3B82F6');
    res.json(tag);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to create tag', 
      details: error.message 
    });
  }
});

router.patch('/tags/:tagId', async (req, res) => {
  try {
    const { name, color } = req.body;
    const tag = await playerService.updateTag(req.params.tagId, name, color);
    res.json(tag);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to update tag', 
      details: error.message 
    });
  }
});

router.delete('/tags/:tagId', async (req, res) => {
  try {
    await playerService.deleteTag(req.params.tagId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to delete tag', 
      details: error.message 
    });
  }
});

// Player-Tag association endpoints
router.post('/:playerId/tags/:tagId', async (req, res) => {
  try {
    await playerService.addTagToPlayer(req.params.playerId, req.params.tagId);
    const player = await playerService.getPlayerById(req.params.playerId);
    res.json(player);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to add tag to player', 
      details: error.message 
    });
  }
});

router.delete('/:playerId/tags/:tagId', async (req, res) => {
  try {
    await playerService.removeTagFromPlayer(req.params.playerId, req.params.tagId);
    const player = await playerService.getPlayerById(req.params.playerId);
    res.json(player);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to remove tag from player', 
      details: error.message 
    });
  }
});

// Note management endpoints
router.post('/:playerId/notes', async (req, res) => {
  try {
    const { content, color } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Note content is required' });
    }
    
    const note = await playerService.addNote(req.params.playerId, content, color);
    res.json(note);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to add note', 
      details: error.message 
    });
  }
});

router.patch('/notes/:noteId', async (req, res) => {
  try {
    const { content, color } = req.body;
    const note = await playerService.updateNote(req.params.noteId, content, color);
    res.json(note);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to update note', 
      details: error.message 
    });
  }
});

router.delete('/notes/:noteId', async (req, res) => {
  try {
    await playerService.deleteNote(req.params.noteId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to delete note', 
      details: error.message 
    });
  }
});

// Tier management endpoints
router.get('/tiers/all', async (req, res) => {
  try {
    const tiers = await playerService.getTiers();
    res.json(tiers);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to fetch tiers', 
      details: error.message 
    });
  }
});

router.post('/tiers', async (req, res) => {
  try {
    const { name, color, order } = req.body;
    if (!name || typeof order !== 'number') {
      return res.status(400).json({ error: 'Tier name and order are required' });
    }
    
    const tier = await playerService.createTier(name, color || '#8B5CF6', order);
    res.json(tier);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to create tier', 
      details: error.message 
    });
  }
});

router.patch('/tiers/:tierId', async (req, res) => {
  try {
    const { name, color, order } = req.body;
    const tier = await playerService.updateTier(req.params.tierId, name, color, order);
    res.json(tier);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to update tier', 
      details: error.message 
    });
  }
});

router.delete('/tiers/:tierId', async (req, res) => {
  try {
    await playerService.deleteTier(req.params.tierId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to delete tier', 
      details: error.message 
    });
  }
});

// Assign player to tier
router.patch('/:id/tier', async (req, res) => {
  try {
    const { tierId } = req.body;
    await playerService.assignPlayerToTier(req.params.id, tierId);
    const player = await playerService.getPlayerById(req.params.id);
    res.json(player);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to assign tier', 
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