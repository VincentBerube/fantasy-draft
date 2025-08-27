// backend/src/routes/players.routes.ts
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { EnhancedPlayerImportService } from '../services/enhanced-player-import.service';
import { AdvancedImportService } from '../services/advanced-import.service';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();
const prisma = new PrismaClient();

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

// Get all players with filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      position,
      team,
      isDrafted,
      dataSource,
      search,
      limit = '100',
      offset = '0'
    } = req.query;

    const where: any = {};
    
    if (position) where.position = position;
    if (team) where.team = team;
    if (isDrafted !== undefined) where.isDrafted = isDrafted === 'true';
    if (dataSource) where.dataSource = dataSource;
    if (search) {
      where.name = {
        contains: search as string,
        mode: 'insensitive'
      };
    }

    const players = await prisma.player.findMany({
      where,
      include: {
        tier: true,
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true
      },
      orderBy: [
        { rank: 'asc' },
        { name: 'asc' }
      ],
      take: parseInt(limit as string),
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
        notes: {
          orderBy: { createdAt: 'desc' }
        }
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

// Update player
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const player = await prisma.player.update({
      where: { id },
      data: updateData,
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
      history
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
    const importService = new EnhancedPlayerImportService(prisma);
    const stats = await importService.getImportStats();

    res.json({
      success: true,
      stats
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
        // You can add draftPosition and draftRound fields if needed
      },
      include: {
        tier: true,
        playerTags: {
          include: {
            tag: true
          }
        }
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
        }
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
// BULK OPERATIONS
// =============================================================================

// Bulk update players
router.post('/bulk-update', async (req: Request, res: Response) => {
  try {
    const { playerIds, data } = req.body || {};

    if (!playerIds || !Array.isArray(playerIds)) {
      return res.status(400).json({
        success: false,
        error: 'playerIds array is required'
      });
    }

    await prisma.player.updateMany({
      where: {
        id: {
          in: playerIds
        }
      },
      data
    });

    res.json({
      success: true,
      message: `${playerIds.length} players updated successfully`
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
    const { playerIds } = req.body || {};

    if (!playerIds || !Array.isArray(playerIds)) {
      return res.status(400).json({
        success: false,
        error: 'playerIds array is required'
      });
    }

    await prisma.player.deleteMany({
      where: {
        id: {
          in: playerIds
        }
      }
    });

    res.json({
      success: true,
      message: `${playerIds.length} players deleted successfully`
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

// Search players
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q: query, position, team, isDrafted, limit = '20' } = req.query;

    const where: any = {};
    
    if (query) {
      where.name = {
        contains: query as string,
        mode: 'insensitive'
      };
    }
    
    if (position) where.position = position;
    if (team) where.team = team;
    if (isDrafted !== undefined) where.isDrafted = isDrafted === 'true';

    const players = await prisma.player.findMany({
      where,
      include: {
        tier: true,
        playerTags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: [
        { rank: 'asc' },
        { name: 'asc' }
      ],
      take: parseInt(limit as string)
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

export default router;