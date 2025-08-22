// backend/src/routes/players.route.ts
import { Router } from 'express';
import multer from 'multer';
import { PlayerService } from '../services/player.service';
import { EnhancedPlayerImportService } from '../services/enhanced-player-import.service';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const router = Router();
const upload = multer({ dest: 'uploads/' });
const playerService = new PlayerService();
const prisma = new PrismaClient();

interface MulterRequest extends Express.Request {
  [x: string]: any;
  file?: Express.Multer.File;
}

// Enhanced Excel import endpoint with smart matching
router.post('/import', upload.single('file'), async (req: MulterRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const importService = new EnhancedPlayerImportService(prisma);
    
    const options = {
      updateStrategy: req.body.updateStrategy as 'merge' | 'overwrite' || 'merge',
      autoMatchThreshold: parseFloat(req.body.autoMatchThreshold) || 0.85,
      createNewPlayers: req.body.createNewPlayers !== 'false',
      preserveSleeperData: req.body.preserveSleeperData !== 'false'
    };

    const result = await importService.importFromExcel(req.file.path, options);

    res.json({
      success: true,
      message: `Import completed: ${result.summary.autoMatched} auto-matched, ${result.summary.newPlayersCreated} new players created, ${result.summary.manualReviewNeeded} need review`,
      result
    });
  } catch (error: any) {
    console.error('Enhanced import failed:', error);
    
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

// Import preview endpoint
router.post('/import/preview', upload.single('file'), async (req: MulterRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const importService = new EnhancedPlayerImportService(prisma);
    const preview = await importService.getImportPreview(req.file.path);

    res.json({
      success: true,
      preview
    });
  } catch (error: any) {
    console.error('Preview generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Preview generation failed',
      details: error.message
    });
  } finally {
    // Always cleanup preview file
    try {
      if (req.file?.path) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup preview file:', cleanupError);
    }
  }
});

// Resolve manual match endpoint
router.post('/import/resolve-match', async (req, res) => {
  try {
    const { excelRowIndex, selectedPlayerId, excelData, options } = req.body;
    
    if (!selectedPlayerId || !excelData) {
      return res.status(400).json({ 
        error: 'Missing required fields: selectedPlayerId, excelData' 
      });
    }

    const importService = new EnhancedPlayerImportService(prisma);
    const result = await importService.resolveManualMatch(
      excelRowIndex,
      selectedPlayerId,
      excelData,
      options
    );

    if (result.success) {
      res.json({
        success: true,
        message: `Player updated successfully. Fields updated: ${result.fieldsUpdated.join(', ')}`,
        fieldsUpdated: result.fieldsUpdated
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Manual match resolution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve manual match',
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
  const dataSource = req.query.dataSource as 'sleeper' | 'excel' | 'manual' | undefined;
  const position = req.query.position as string | undefined;
  const team = req.query.team as string | undefined;
  const hasSleeperId = req.query.hasSleeperId as string | undefined;

  try {
    const whereClause: any = {};
    
    if (!includeDrafted) {
      whereClause.isDrafted = false;
    }
    
    if (dataSource) {
      whereClause.dataSource = dataSource;
    }
    
    if (position) {
      whereClause.position = position;
    }
    
    if (team) {
      whereClause.team = team;
    }
    
    if (hasSleeperId === 'true') {
      whereClause.sleeperId = { not: null };
    } else if (hasSleeperId === 'false') {
      whereClause.sleeperId = null;
    }

    const players = await prisma.player.findMany({
      where: whereClause,
      include: {
        tier: true,
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: [
        { isDrafted: 'asc' },
        { rank: 'asc' },
        { customRank: 'asc' },
        { name: 'asc' }
      ]
    });

    res.json(players);
  } catch (error: any) {
    console.error('Error fetching players:', error);
    res.status(500).json({ 
      error: 'Failed to fetch players', 
      details: error.message 
    });
  }
});

// Quick update endpoint for fast editing
router.patch('/:id/quick', async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = ['customRank', 'projectedPoints', 'vorp', 'adp', 'rank', 'byeWeek'];
    
    // Filter to only allowed fields
    const updateData: any = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key) && req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        error: 'No valid fields to update',
        allowedFields 
      });
    }

    // Add update timestamp
    updateData.lastSyncAt = new Date();

    const updatedPlayer = await prisma.player.update({
      where: { id },
      data: updateData,
      // Don't include relations for speed
      select: {
        id: true,
        name: true,
        customRank: true,
        projectedPoints: true,
        vorp: true,
        adp: true,
        rank: true,
        byeWeek: true,
        lastSyncAt: true
      }
    });

    res.json(updatedPlayer);
  } catch (error: any) {
    console.error('Quick update failed:', error);
    res.status(500).json({ 
      error: 'Failed to update player', 
      details: error.message 
    });
  }
});

// Full update endpoint for complex updates
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { playerTags, notes, ...updateData } = req.body;

    // Update basic player data
    const updatedPlayer = await prisma.player.update({
      where: { id },
      data: {
        ...updateData,
        lastSyncAt: new Date()
      },
      include: {
        tier: true,
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    res.json(updatedPlayer);
  } catch (error: any) {
    console.error('Player update failed:', error);
    res.status(500).json({ 
      error: 'Failed to update player', 
      details: error.message 
    });
  }
});

// Get single player
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const player = await prisma.player.findUnique({
      where: { id },
      include: {
        tier: true,
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(player);
  } catch (error: any) {
    console.error('Error fetching player:', error);
    res.status(500).json({ 
      error: 'Failed to fetch player', 
      details: error.message 
    });
  }
});

// Delete player
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if player exists and get their data source
    const player = await prisma.player.findUnique({
      where: { id },
      select: { id: true, name: true, dataSource: true, sleeperId: true }
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Warn if trying to delete a Sleeper player
    if (player.sleeperId) {
      return res.status(400).json({ 
        error: 'Cannot delete Sleeper players. They will be restored on next sync.',
        suggestion: 'Consider marking as drafted or adding to a tier instead.'
      });
    }

    await prisma.player.delete({
      where: { id }
    });

    res.json({ 
      success: true, 
      message: `Player ${player.name} deleted successfully` 
    });
  } catch (error: any) {
    console.error('Player deletion failed:', error);
    res.status(500).json({ 
      error: 'Failed to delete player', 
      details: error.message 
    });
  }
});

// Toggle draft status
router.patch('/:id/draft', async (req, res) => {
  try {
    const { id } = req.params;
    const { isDrafted } = req.body;

    const updatedPlayer = await prisma.player.update({
      where: { id },
      data: { 
        isDrafted: isDrafted,
        lastSyncAt: new Date()
      },
      select: {
        id: true,
        name: true,
        isDrafted: true
      }
    });

    res.json(updatedPlayer);
  } catch (error: any) {
    console.error('Draft status update failed:', error);
    res.status(500).json({ 
      error: 'Failed to update draft status', 
      details: error.message 
    });
  }
});

// Assign tier
router.patch('/:id/tier', async (req, res) => {
  try {
    const { id } = req.params;
    const { tierId } = req.body;

    const updatedPlayer = await prisma.player.update({
      where: { id },
      data: { 
        tierId: tierId || null,
        lastSyncAt: new Date()
      },
      include: {
        tier: true
      }
    });

    res.json(updatedPlayer);
  } catch (error: any) {
    console.error('Tier assignment failed:', error);
    res.status(500).json({ 
      error: 'Failed to assign tier', 
      details: error.message 
    });
  }
});

// Add note to player
router.post('/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, color = '#6B7280' } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Note content is required' });
    }

    const note = await prisma.note.create({
      data: {
        playerId: id,
        content: content.trim(),
        color
      }
    });

    res.json(note);
  } catch (error: any) {
    console.error('Note creation failed:', error);
    res.status(500).json({ 
      error: 'Failed to add note', 
      details: error.message 
    });
  }
});

// Update note
router.patch('/notes/:noteId', async (req, res) => {
  try {
    const { noteId } = req.params;
    const { content, color } = req.body;

    const updateData: any = {};
    if (content !== undefined) updateData.content = content;
    if (color !== undefined) updateData.color = color;

    const updatedNote = await prisma.note.update({
      where: { id: noteId },
      data: updateData
    });

    res.json(updatedNote);
  } catch (error: any) {
    console.error('Note update failed:', error);
    res.status(500).json({ 
      error: 'Failed to update note', 
      details: error.message 
    });
  }
});

// Delete note
router.delete('/notes/:noteId', async (req, res) => {
  try {
    const { noteId } = req.params;

    await prisma.note.delete({
      where: { id: noteId }
    });

    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (error: any) {
    console.error('Note deletion failed:', error);
    res.status(500).json({ 
      error: 'Failed to delete note', 
      details: error.message 
    });
  }
});

// Tier management endpoints
router.get('/tiers/all', async (req, res) => {
  try {
    const tiers = await prisma.tier.findMany({
      orderBy: { order: 'asc' }
    });
    res.json(tiers);
  } catch (error: any) {
    console.error('Error fetching tiers:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tiers', 
      details: error.message 
    });
  }
});

router.post('/tiers', async (req, res) => {
  try {
    const { name, color = '#8B5CF6', order } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Tier name is required' });
    }

    if (order === undefined || order === null) {
      return res.status(400).json({ error: 'Tier order is required' });
    }

    const tier = await prisma.tier.create({
      data: {
        name: name.trim(),
        color,
        order: parseInt(order.toString())
      }
    });

    res.json(tier);
  } catch (error: any) {
    console.error('Tier creation failed:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Tier name already exists' });
    } else {
      res.status(500).json({ 
        error: 'Failed to create tier', 
        details: error.message 
      });
    }
  }
});

router.patch('/tiers/:tierId', async (req, res) => {
  try {
    const { tierId } = req.params;
    const { name, color, order } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (color !== undefined) updateData.color = color;
    if (order !== undefined) updateData.order = parseInt(order.toString());

    const updatedTier = await prisma.tier.update({
      where: { id: tierId },
      data: updateData
    });

    res.json(updatedTier);
  } catch (error: any) {
    console.error('Tier update failed:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Tier name already exists' });
    } else {
      res.status(500).json({ 
        error: 'Failed to update tier', 
        details: error.message 
      });
    }
  }
});

router.delete('/tiers/:tierId', async (req, res) => {
  try {
    const { tierId } = req.params;

    // Check if tier is in use
    const playersUsingTier = await prisma.player.count({
      where: { tierId }
    });

    if (playersUsingTier > 0) {
      return res.status(400).json({ 
        error: `Cannot delete tier. ${playersUsingTier} player(s) are assigned to this tier.`,
        suggestion: 'Reassign players to other tiers first.'
      });
    }

    await prisma.tier.delete({
      where: { id: tierId }
    });

    res.json({ success: true, message: 'Tier deleted successfully' });
  } catch (error: any) {
    console.error('Tier deletion failed:', error);
    res.status(500).json({ 
      error: 'Failed to delete tier', 
      details: error.message 
    });
  }
});

// Tag management endpoints
router.get('/tags/all', async (req, res) => {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(tags);
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tags', 
      details: error.message 
    });
  }
});

router.post('/tags', async (req, res) => {
  try {
    const { name, color = '#3B82F6' } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const tag = await prisma.tag.create({
      data: {
        name: name.trim(),
        color
      }
    });

    res.json(tag);
  } catch (error: any) {
    console.error('Tag creation failed:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Tag name already exists' });
    } else {
      res.status(500).json({ 
        error: 'Failed to create tag', 
        details: error.message 
      });
    }
  }
});

// Add tag to player
router.post('/:id/tags/:tagId', async (req, res) => {
  try {
    const { id: playerId, tagId } = req.params;

    const playerTag = await prisma.playerTag.create({
      data: {
        playerId,
        tagId
      },
      include: {
        tag: true
      }
    });

    res.json(playerTag);
  } catch (error: any) {
    console.error('Tag assignment failed:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Player already has this tag' });
    } else {
      res.status(500).json({ 
        error: 'Failed to assign tag', 
        details: error.message 
      });
    }
  }
});

// Remove tag from player
router.delete('/:id/tags/:tagId', async (req, res) => {
  try {
    const { id: playerId, tagId } = req.params;

    await prisma.playerTag.deleteMany({
      where: {
        playerId,
        tagId
      }
    });

    res.json({ success: true, message: 'Tag removed successfully' });
  } catch (error: any) {
    console.error('Tag removal failed:', error);
    res.status(500).json({ 
      error: 'Failed to remove tag', 
      details: error.message 
    });
  }
});

// Bulk operations
router.post('/bulk/draft', async (req, res) => {
  try {
    const { playerIds, isDrafted } = req.body;

    if (!Array.isArray(playerIds) || playerIds.length === 0) {
      return res.status(400).json({ error: 'playerIds array is required' });
    }

    const result = await prisma.player.updateMany({
      where: {
        id: { in: playerIds }
      },
      data: { 
        isDrafted,
        lastSyncAt: new Date()
      }
    });

    res.json({
      success: true,
      message: `Updated draft status for ${result.count} players`,
      count: result.count
    });
  } catch (error: any) {
    console.error('Bulk draft update failed:', error);
    res.status(500).json({ 
      error: 'Failed to update draft status', 
      details: error.message 
    });
  }
});

router.post('/bulk/tier', async (req, res) => {
  try {
    const { playerIds, tierId } = req.body;

    if (!Array.isArray(playerIds) || playerIds.length === 0) {
      return res.status(400).json({ error: 'playerIds array is required' });
    }

    const result = await prisma.player.updateMany({
      where: {
        id: { in: playerIds }
      },
      data: { 
        tierId: tierId || null,
        lastSyncAt: new Date()
      }
    });

    res.json({
      success: true,
      message: `Updated tier for ${result.count} players`,
      count: result.count
    });
  } catch (error: any) {
    console.error('Bulk tier update failed:', error);
    res.status(500).json({ 
      error: 'Failed to update tier', 
      details: error.message 
    });
  }
});

// Stats endpoint
router.get('/stats/summary', async (req, res) => {
  try {
    const [
      totalPlayers,
      sleeperPlayers,
      excelPlayers,
      manualPlayers,
      draftedPlayers,
      playersWithNotes,
      playersWithTags
    ] = await Promise.all([
      prisma.player.count(),
      prisma.player.count({ where: { dataSource: 'sleeper' } }),
      prisma.player.count({ where: { dataSource: 'excel' } }),
      prisma.player.count({ where: { dataSource: 'manual' } }),
      prisma.player.count({ where: { isDrafted: true } }),
      prisma.player.count({ where: { notes: { some: {} } } }),
      prisma.player.count({ where: { playerTags: { some: {} } } })
    ]);

    res.json({
      totalPlayers,
      bySource: {
        sleeper: sleeperPlayers,
        excel: excelPlayers,
        manual: manualPlayers
      },
      draftedPlayers,
      playersWithNotes,
      playersWithTags,
      lastUpdate: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Stats fetch failed:', error);
    res.status(500).json({ 
      error: 'Failed to fetch stats', 
      details: error.message 
    });
  }
});

export default router;