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

// Get all players with filtering - FIXED: Increased default limit to 1000
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      position,
      team,
      isDrafted,
      dataSource,
      search,
      limit = '1000', // FIXED: Increased from 100 to 1000
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
        { customRank: 'asc' }, // FIXED: Use customRank first, then rank
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
// STATISTICS AND ANALYTICS - FIXED VERSION
// =============================================================================

// Get player statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [totalPlayers, draftedPlayers, positionStats] = await Promise.all([
      prisma.player.count(),
      prisma.player.count({ where: { isDrafted: true } }),
      prisma.player.groupBy({
        by: ['position'],
        _count: {
          id: true
        },
        _avg: {
          projectedPoints: true,
          rank: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalPlayers,
        draftedPlayers,
        undraftedPlayers: totalPlayers - draftedPlayers,
        byPosition: positionStats.map(stat => ({
          position: stat.position,
          count: stat._count.id,
          avgProjectedPoints: stat._avg.projectedPoints,
          avgRank: stat._avg.rank
        }))
      }
    });
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
    
    const stats = await prisma.player.aggregate({
      where: { position },
      _count: {
        id: true
      },
      _avg: {
        projectedPoints: true,
        rank: true,
        vorp: true,
        adp: true
      },
      _min: {
        rank: true
      },
      _max: {
        rank: true
      }
    });

    res.json({
      success: true,
      data: {
        position,
        ...stats
      }
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
        },
        notes: true
      },
      orderBy: [
        { customRank: 'asc' },
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

// =============================================================================
// PLAYER NOTES MANAGEMENT
// =============================================================================

// Add note to player
router.post('/:id/notes', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, color = '#6B7280' } = req.body;

    const note = await prisma.note.create({
      data: {
        content,
        color,
        playerId: id
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

// Update player note
router.put('/:playerId/notes/:noteId', async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const { content, color } = req.body;

    const note = await prisma.note.update({
      where: { id: noteId },
      data: { content, color }
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

// Delete player note
router.delete('/:playerId/notes/:noteId', async (req: Request, res: Response) => {
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
// PLAYER TAG MANAGEMENT
// =============================================================================

// Add tag to player
router.post('/:id/tags', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tagId } = req.body;

    const playerTag = await prisma.playerTag.create({
      data: {
        playerId: id,
        tagId
      },
      include: {
        tag: true
      }
    });

    res.json({
      success: true,
      data: playerTag
    });
  } catch (error: any) {
    console.error('Failed to add tag to player:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add tag to player',
      details: error.message
    });
  }
});

// Remove tag from player
router.delete('/:playerId/tags/:tagId', async (req: Request, res: Response) => {
  try {
    const { playerId, tagId } = req.params;

    await prisma.playerTag.deleteMany({
      where: {
        playerId,
        tagId
      }
    });

    res.json({
      success: true,
      message: 'Tag removed from player successfully'
    });
  } catch (error: any) {
    console.error('Failed to remove tag from player:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove tag from player',
      details: error.message
    });
  }
});

// =============================================================================
// IMPORT/EXPORT OPERATIONS  
// =============================================================================

// Export players to Excel
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { format = 'excel' } = req.query;

    const players = await prisma.player.findMany({
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
        { customRank: 'asc' },
        { rank: 'asc' },
        { name: 'asc' }
      ]
    });

    if (format === 'excel') {
      // Create Excel workbook
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Players');

      // Add headers
      worksheet.addRow([
        'Name', 'Position', 'Team', 'Rank', 'Custom Rank', 'Projected Points',
        'VORP', 'ADP', 'Bye Week', 'Is Drafted', 'Tier', 'Tags', 'Notes Count',
        'Data Source', 'Sleeper ID'
      ]);

      // Add player data
      players.forEach(player => {
        worksheet.addRow([
          player.name,
          player.position,
          player.team,
          player.rank,
          player.customRank,
          player.projectedPoints,
          player.vorp,
          player.adp,
          player.byeWeek,
          player.isDrafted,
          player.tier?.name || '',
          player.playerTags.map(pt => pt.tag.name).join(', '),
          player.notes.length,
          player.dataSource,
          player.sleeperId
        ]);
      });

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=fantasy_players.xlsx');
      res.send(buffer);
    } else {
      res.json({
        success: true,
        data: players
      });
    }
  } catch (error: any) {
    console.error('Failed to export players:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export players',
      details: error.message
    });
  }
});

// Import players from Excel
router.post('/import', upload.single('file'), async (req: MulterRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    const { mergeStrategy = 'update' } = req.query;
    const enhancedImportService = new EnhancedPlayerImportService(prisma);
    
    const result = await enhancedImportService.importFromExcel(req.file.path, {
      updateStrategy: mergeStrategy as 'merge' | 'overwrite'
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Import failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import players',
      details: error.message
    });
  }
});

export default router;