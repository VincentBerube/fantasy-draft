// backend/src/routes/players.route.ts
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { EnhancedPlayerImportService } from '../services/enhanced-player-import.service';
import { AdvancedImportService } from '../services/advanced-import.service';
import { PlayerService } from '../services/player.service';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();
const prisma = new PrismaClient();
const playerService = new PlayerService(prisma);

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/csv'
    ];
    
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    const isValidMime = allowedMimes.includes(file.mimetype);
    const isValidExtension = allowedExtensions.includes(fileExtension);
    
    cb(null, isValidMime || isValidExtension);
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// =============================================================================
// BASIC PLAYER OPERATIONS
// =============================================================================

// Get all players with filtering and optional stats
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      position,
      team,
      includeDrafted = 'true',
      dataSource,
      hasSleeperId,
      limit,
      offset = '0',
      sortBy = 'rank',
      sortOrder = 'asc'
    } = req.query;

    const filters: any = {
      ...(position && { position: position as string }),
      ...(team && { team: team as string }),
      ...(includeDrafted === 'false' && { isDrafted: false }),
      ...(dataSource && { dataSource: dataSource as string }),
      ...(hasSleeperId === 'true' && { sleeperId: { not: null } }),
      ...(hasSleeperId === 'false' && { sleeperId: null })
    };

    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder;

    const players = await prisma.player.findMany({
      where: filters,
      include: {
        tier: true,
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true
      },
      orderBy,
      ...(limit && { take: parseInt(limit as string) }),
      skip: parseInt(offset as string)
    });

    res.json({
      success: true,
      data: players
    });
  } catch (error: any) {
    console.error('Failed to get players:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get players',
      details: error.message
    });
  }
});

// Get single player
router.get('/:id', async (req: Request, res: Response) => {
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
        notes: true
      }
    });

    if (!player) {
      return res.status(404).json({
        success: false,
        error: 'Player not found'
      });
    }

    res.json({
      success: true,
      data: player
    });
  } catch (error: any) {
    console.error('Failed to get player:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get player',
      details: error.message
    });
  }
});

// Create new player
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, position, team, tier, ...otherData } = req.body;

    if (!name || !position) {
      return res.status(400).json({
        success: false,
        error: 'Name and position are required'
      });
    }

    // Clean and validate numeric fields to prevent the ADP error
    const cleanedData: any = {
      name,
      position: position.toUpperCase(),
      team: team?.toUpperCase(),
      dataSource: 'manual',
      isDrafted: false
    };

    // Only add numeric fields if they're valid numbers
    if (otherData.rank && !isNaN(Number(otherData.rank))) {
      cleanedData.rank = Number(otherData.rank);
    }
    if (otherData.customRank && !isNaN(Number(otherData.customRank))) {
      cleanedData.customRank = Number(otherData.customRank);
    }
    if (otherData.projectedPoints && !isNaN(Number(otherData.projectedPoints))) {
      cleanedData.projectedPoints = Number(otherData.projectedPoints);
    }
    if (otherData.vorp && !isNaN(Number(otherData.vorp))) {
      cleanedData.vorp = Number(otherData.vorp);
    }
    if (otherData.adp && !isNaN(Number(otherData.adp))) {
      cleanedData.adp = Number(otherData.adp);
    }
    if (otherData.byeWeek && !isNaN(Number(otherData.byeWeek))) {
      cleanedData.byeWeek = Number(otherData.byeWeek);
    }
    if (otherData.lastSeasonPoints && !isNaN(Number(otherData.lastSeasonPoints))) {
      cleanedData.lastSeasonPoints = Number(otherData.lastSeasonPoints);
    }

    // Handle tier assignment
    if (tier) {
      cleanedData.tierId = tier;
    }

    const player = await prisma.player.create({
      data: cleanedData,
      include: {
        tier: true,
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true
      }
    });

    res.json({
      success: true,
      data: player
    });
  } catch (error: any) {
    console.error('Failed to create player:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create player',
      details: error.message
    });
  }
});

// Update player
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Clean numeric fields to prevent validation errors
    const cleanedUpdateData: any = { ...updateData };
    
    // Convert string numbers to actual numbers, or set to null if invalid
    const numericFields = ['rank', 'customRank', 'projectedPoints', 'vorp', 'adp', 'byeWeek', 'lastSeasonPoints'];
    
    for (const field of numericFields) {
      if (field in cleanedUpdateData) {
        const value = cleanedUpdateData[field];
        if (value === '' || value === null || value === undefined) {
          cleanedUpdateData[field] = null;
        } else if (!isNaN(Number(value))) {
          cleanedUpdateData[field] = Number(value);
        } else {
          // Invalid number, set to null
          cleanedUpdateData[field] = null;
        }
      }
    }

    const player = await prisma.player.update({
      where: { id },
      data: cleanedUpdateData,
      include: {
        tier: true,
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true
      }
    });

    res.json({
      success: true,
      data: player
    });
  } catch (error: any) {
    console.error('Failed to update player:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update player',
      details: error.message
    });
  }
});

// Delete player
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.player.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Player deleted successfully'
    });
  } catch (error: any) {
    console.error('Failed to delete player:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete player',
      details: error.message
    });
  }
});

// Export players
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { format = 'excel' } = req.query;
    const workbook = await playerService.exportPlayers();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="fantasy-players.xlsx"');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    console.error('Failed to export players:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export players',
      details: error.message
    });
  }
});

// =============================================================================
// IMPORT FUNCTIONALITY
// =============================================================================

// Enhanced import preview (Simple mode)
router.post('/import/preview', upload.single('file'), async (req: MulterRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ 
      success: false,
      error: 'No file uploaded' 
    });
  }

  try {
    const importService = new EnhancedPlayerImportService(prisma);
    const preview = await importService.getImportPreview(req.file.path);

    res.json({
      success: true,
      preview
    });
  } catch (error: any) {
    console.error('Preview failed:', error);
    res.status(500).json({
      success: false,
      error: 'Preview generation failed',
      details: error.message
    });
  } finally {
    // Cleanup uploaded file
    try {
      if (req.file?.path) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup preview file:', cleanupError);
    }
  }
});

// Execute enhanced import (Simple mode)
router.post('/import/enhanced-execute', upload.single('file'), async (req: MulterRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ 
      success: false,
      error: 'No file uploaded' 
    });
  }

  try {
    const options = req.body?.options ? JSON.parse(req.body.options) : {};
    
    const importService = new EnhancedPlayerImportService(prisma);
    const result = await importService.importFromExcel(req.file.path, options);

    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    console.error('Enhanced import failed:', error);
    res.status(500).json({
      success: false,
      error: 'Import failed',
      details: error.message
    });
  } finally {
    try {
      if (req.file?.path) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup import file:', cleanupError);
    }
  }
});

// Advanced import preview (Advanced mode)
router.post('/import/advanced-preview', upload.single('file'), async (req: MulterRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ 
      success: false,
      error: 'No file uploaded' 
    });
  }

  try {
    const columnMappings = req.body?.columnMappings ? JSON.parse(req.body.columnMappings) : [];
    const settings = req.body?.settings ? JSON.parse(req.body.settings) : {};

    const advancedImportService = new AdvancedImportService(prisma);
    const playerPreviews = await advancedImportService.generateAdvancedPreview(
      req.file.path, 
      columnMappings, 
      settings
    );

    res.json({
      success: true,
      playerPreviews
    });
  } catch (error: any) {
    console.error('Advanced preview failed:', error);
    res.status(500).json({
      success: false,
      error: 'Preview generation failed',
      details: error.message
    });
  } finally {
    try {
      if (req.file?.path) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup preview file:', cleanupError);
    }
  }
});

// Execute advanced import (Advanced mode)
router.post('/import/advanced-execute', upload.single('file'), async (req: MulterRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ 
      success: false,
      error: 'No file uploaded' 
    });
  }

  try {
    const importData = req.body?.importData ? JSON.parse(req.body.importData) : null;
    
    if (!importData) {
      return res.status(400).json({
        success: false,
        error: 'Import data is required'
      });
    }
    
    const advancedImportService = new AdvancedImportService(prisma);
    const session = await advancedImportService.executeControlledImport(importData);

    res.json({
      success: true,
      session
    });
  } catch (error: any) {
    console.error('Advanced import failed:', error);
    res.status(500).json({
      success: false,
      error: 'Import failed',
      details: error.message
    });
  } finally {
    try {
      if (req.file?.path) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup import file:', cleanupError);
    }
  }
});

// Manual match resolution
router.post('/resolve-manual-match', async (req: Request, res: Response) => {
  try {
    const { excelRowIndex, selectedPlayerId, excelData, options } = req.body;
    
    if (!selectedPlayerId || !excelData) {
      return res.status(400).json({
        success: false,
        error: 'Selected player ID and Excel data are required'
      });
    }

    const importService = new EnhancedPlayerImportService(prisma);
    await importService.resolveManualMatch({
      excelRowIndex,
      selectedPlayerId,
      excelData,
      options
    });
    
    res.json({
      success: true,
      message: 'Match resolved successfully'
    });
  } catch (error: any) {
    console.error('Failed to resolve match:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve match',
      details: error.message
    });
  }
});

// Import conflict resolution (alternative endpoint)
router.post('/import/resolve', async (req: Request, res: Response) => {
  try {
    const { excelRowIndex, selectedPlayerId, excelData, options } = req.body;
    
    if (!selectedPlayerId || !excelData) {
      return res.status(400).json({
        success: false,
        error: 'Selected player ID and Excel data are required'
      });
    }

    const importService = new EnhancedPlayerImportService(prisma);
    await importService.resolveManualMatch({
      excelRowIndex,
      selectedPlayerId,
      excelData,
      options
    });
    
    res.json({
      success: true,
      message: 'Conflict resolved successfully'
    });
  } catch (error: any) {
    console.error('Failed to resolve conflict:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve conflict',
      details: error.message
    });
  }
});

// Rollback import
router.post('/import/rollback/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const advancedImportService = new AdvancedImportService(prisma);
    await advancedImportService.rollbackImport(sessionId);

    res.json({
      success: true,
      message: 'Import rolled back successfully'
    });
  } catch (error: any) {
    console.error('Rollback failed:', error);
    res.status(500).json({
      success: false,
      error: 'Rollback failed',
      details: error.message
    });
  }
});

// Get import history
router.get('/import/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    const advancedImportService = new AdvancedImportService(prisma);
    const history = await advancedImportService.getImportHistory(limit);

    res.json({
      success: true,
      data: history
    });
  } catch (error: any) {
    console.error('Failed to get import history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get import history',
      details: error.message
    });
  }
});

// Get import statistics
router.get('/import/stats', async (req: Request, res: Response) => {
  try {
    const stats = await prisma.importSession.groupBy({
      by: ['rolledBack'],
      _count: {
        id: true
      }
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Failed to get import stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get import stats',
      details: error.message
    });
  }
});

// =============================================================================
// DRAFT OPERATIONS
// =============================================================================

// Draft player
router.post('/:id/draft', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { position, round } = req.body || {};

    const player = await prisma.player.update({
      where: { id },
      data: { 
        isDrafted: true,
      },
      include: {
        tier: true,
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true
      }
    });

    res.json({
      success: true,
      data: player
    });
  } catch (error: any) {
    console.error('Failed to draft player:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to draft player',
      details: error.message
    });
  }
});

// Undraft player
router.post('/:id/undraft', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const player = await prisma.player.update({
      where: { id },
      data: { isDrafted: false },
      include: {
        tier: true,
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true
      }
    });

    res.json({
      success: true,
      data: player
    });
  } catch (error: any) {
    console.error('Failed to undraft player:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to undraft player',
      details: error.message
    });
  }
});

// =============================================================================
// TIER MANAGEMENT
// =============================================================================

// Assign player to tier
router.post('/:id/tier', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tierId } = req.body;

    const player = await prisma.player.update({
      where: { id },
      data: { tierId },
      include: {
        tier: true,
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true
      }
    });

    res.json({
      success: true,
      data: player
    });
  } catch (error: any) {
    console.error('Failed to assign tier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign tier',
      details: error.message
    });
  }
});

// Remove player from tier
router.delete('/:id/tier', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const player = await prisma.player.update({
      where: { id },
      data: { tierId: null },
      include: {
        tier: true,
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true
      }
    });

    res.json({
      success: true,
      data: player
    });
  } catch (error: any) {
    console.error('Failed to remove tier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove tier',
      details: error.message
    });
  }
});

// =============================================================================
// TAG MANAGEMENT
// =============================================================================

// Add tag to player
router.post('/:id/tags', async (req: Request, res: Response) => {
  try {
    const { id: playerId } = req.params;
    const { tagId } = req.body;

    if (!tagId) {
      return res.status(400).json({
        success: false,
        error: 'Tag ID is required'
      });
    }

    await prisma.playerTag.create({
      data: {
        playerId,
        tagId
      }
    });

    // Return updated player
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        tier: true,
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true
      }
    });

    res.json({
      success: true,
      data: player
    });
  } catch (error: any) {
    console.error('Failed to add tag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add tag',
      details: error.message
    });
  }
});

// Remove tag from player
router.delete('/:id/tags/:tagId', async (req: Request, res: Response) => {
  try {
    const { id: playerId, tagId } = req.params;

    await prisma.playerTag.deleteMany({
      where: {
        playerId,
        tagId
      }
    });

    // Return updated player
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        tier: true,
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true
      }
    });

    res.json({
      success: true,
      data: player
    });
  } catch (error: any) {
    console.error('Failed to remove tag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove tag',
      details: error.message
    });
  }
});

// =============================================================================
// NOTE MANAGEMENT
// =============================================================================

// Add note to player
router.post('/:id/notes', async (req: Request, res: Response) => {
  try {
    const { id: playerId } = req.params;
    const { content, color = '#6B7280' } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Note content is required'
      });
    }

    const note = await prisma.note.create({
      data: {
        content,
        color,
        playerId
      }
    });

    res.json({
      success: true,
      data: note
    });
  } catch (error: any) {
    console.error('Failed to add note:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add note',
      details: error.message
    });
  }
});

// Update note
router.put('/:id/notes/:noteId', async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const { content, color } = req.body;

    const updateData: any = {};
    if (content !== undefined) updateData.content = content;
    if (color !== undefined) updateData.color = color;

    const note = await prisma.note.update({
      where: { id: noteId },
      data: updateData
    });

    res.json({
      success: true,
      data: note
    });
  } catch (error: any) {
    console.error('Failed to update note:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update note',
      details: error.message
    });
  }
});

// Delete note
router.delete('/:id/notes/:noteId', async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;

    await prisma.note.delete({
      where: { id: noteId }
    });

    res.json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error: any) {
    console.error('Failed to delete note:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete note',
      details: error.message
    });
  }
});

// =============================================================================
// BULK OPERATIONS
// =============================================================================

// Bulk update players
router.post('/bulk-update', async (req: Request, res: Response) => {
  try {
    const { playerIds, data } = req.body;

    if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Player IDs array is required'
      });
    }

    // Clean numeric fields in bulk data too
    const cleanedData = { ...data };
    const numericFields = ['rank', 'customRank', 'projectedPoints', 'vorp', 'adp', 'byeWeek', 'lastSeasonPoints'];
    
    for (const field of numericFields) {
      if (field in cleanedData) {
        const value = cleanedData[field];
        if (value === '' || value === null || value === undefined) {
          cleanedData[field] = null;
        } else if (!isNaN(Number(value))) {
          cleanedData[field] = Number(value);
        } else {
          cleanedData[field] = null;
        }
      }
    }

    await prisma.player.updateMany({
      where: {
        id: {
          in: playerIds
        }
      },
      data: cleanedData
    });

    res.json({
      success: true,
      message: `Successfully updated ${playerIds.length} players`
    });
  } catch (error: any) {
    console.error('Failed to bulk update players:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update players',
      details: error.message
    });
  }
});

// Bulk delete players
router.post('/bulk-delete', async (req: Request, res: Response) => {
  try {
    const { playerIds } = req.body;

    if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Player IDs array is required'
      });
    }

    const result = await prisma.player.deleteMany({
      where: {
        id: {
          in: playerIds
        }
      }
    });

    res.json({
      success: true,
      message: `Successfully deleted ${result.count} players`
    });
  } catch (error: any) {
    console.error('Failed to bulk delete players:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk delete players',
      details: error.message
    });
  }
});

// Bulk draft players
router.post('/bulk-draft', async (req: Request, res: Response) => {
  try {
    const { playerIds } = req.body;

    if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Player IDs array is required'
      });
    }

    await prisma.player.updateMany({
      where: {
        id: {
          in: playerIds
        }
      },
      data: {
        isDrafted: true
      }
    });

    res.json({
      success: true,
      message: `Successfully drafted ${playerIds.length} players`
    });
  } catch (error: any) {
    console.error('Failed to bulk draft players:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk draft players',
      details: error.message
    });
  }
});

// =============================================================================
// SEARCH AND FILTERING
// =============================================================================

// Search players
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q: query, position, team, isDrafted, limit = '50' } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }

    const filters: any = {
      name: {
        contains: query as string,
        mode: 'insensitive'
      },
      ...(position && { position: position as string }),
      ...(team && { team: team as string }),
      ...(isDrafted !== undefined && { isDrafted: isDrafted === 'true' })
    };

    const players = await prisma.player.findMany({
      where: filters,
      include: {
        tier: true,
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true
      },
      take: parseInt(limit as string),
      orderBy: { rank: 'asc' }
    });

    res.json({
      success: true,
      data: players
    });
  } catch (error: any) {
    console.error('Failed to search players:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search players',
      details: error.message
    });
  }
});

// Get player statistics - implement directly
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const totalPlayers = await prisma.player.count();
    const draftedPlayers = await prisma.player.count({ where: { isDrafted: true } });
    const undraftedPlayers = totalPlayers - draftedPlayers;

    const byPosition = await prisma.player.groupBy({
      by: ['position'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });

    const stats = {
      totalPlayers,
      draftedPlayers,
      undraftedPlayers,
      byPosition: byPosition.map(pos => ({
        position: pos.position,
        count: pos._count.id
      }))
    };

    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('Failed to get player stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get player stats',
      details: error.message
    });
  }
});

// Get position-specific statistics
router.get('/stats/position/:position', async (req: Request, res: Response) => {
  try {
    const { position } = req.params;
    
    const stats = await prisma.player.groupBy({
      by: ['position'],
      where: {
        position: position.toUpperCase()
      },
      _count: {
        id: true
      },
      _avg: {
        projectedPoints: true,
        adp: true
      }
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Failed to get position stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get position stats',
      details: error.message
    });
  }
});

export default router;