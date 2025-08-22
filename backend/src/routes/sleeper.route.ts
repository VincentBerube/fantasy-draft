// backend/src/routes/sleeper.route.ts
import { Router } from 'express';
import { sleeperAPIService, SleeperSyncOptions } from '../services/sleeper-api.service';
import { prisma } from '../database';

const router = Router();

/**
 * Sync players from Sleeper API to our database
 * Preserves all existing user data (notes, tags, tiers, draft status)
 */
router.post('/sync', async (req, res) => {
  try {
    const { 
      includeProjections = true, 
      season = '2024', 
      week,
      onlyActive = true,
      positionsFilter = ['QB', 'WR', 'RB', 'TE', 'K'],
      topPlayersLimit = 500
    } = req.body;

    const syncOptions: SleeperSyncOptions = {
      includeProjections,
      season,
      week: week ? parseInt(week) : undefined,
      onlyActive,
      positionsFilter,
      topPlayersLimit: parseInt(topPlayersLimit.toString())
    };

    const result = await sleeperAPIService.syncPlayersToDatabase(prisma, syncOptions);

    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error: any) {
    console.error('Sleeper sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync Sleeper data',
      details: error.message
    });
  }
});

/**
 * Get trending players from Sleeper
 */
router.get('/trending/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { hours = 24, limit = 25 } = req.query;

    if (type !== 'add' && type !== 'drop') {
      return res.status(400).json({
        error: 'Type must be either "add" or "drop"'
      });
    }

    const trending = await sleeperAPIService.getTrendingPlayers(
      type as 'add' | 'drop',
      parseInt(hours as string) as 24 | 168,
      parseInt(limit as string)
    );

    res.json(trending);
  } catch (error: any) {
    console.error('Error fetching trending players:', error);
    res.status(500).json({
      error: 'Failed to fetch trending players',
      details: error.message
    });
  }
});

/**
 * Get current NFL state from Sleeper
 */
router.get('/nfl-state', async (req, res) => {
  try {
    const state = await sleeperAPIService.getNFLState();
    res.json(state);
  } catch (error: any) {
    console.error('Error fetching NFL state:', error);
    res.status(500).json({
      error: 'Failed to fetch NFL state',
      details: error.message
    });
  }
});

/**
 * Get projections for a specific week/season
 */
router.get('/projections', async (req, res) => {
  try {
    const { season = '2024', week } = req.query;
    
    const projections = await sleeperAPIService.getProjections(
      season as string,
      week ? parseInt(week as string) : undefined
    );

    res.json(projections);
  } catch (error: any) {
    console.error('Error fetching projections:', error);
    res.status(500).json({
      error: 'Failed to fetch projections',
      details: error.message
    });
  }
});

/**
 * Get a preview of what would be synced (without actually syncing)
 */
router.get('/sync-preview', async (req, res) => {
  try {
    const { onlyActive = true } = req.query;
    
    // Get current players from Sleeper
    const sleeperPlayers = await sleeperAPIService.getAllPlayers();
    
    // Filter active fantasy players
    const activeCount = Object.values(sleeperPlayers)
      .filter(player => {
        if (onlyActive === 'true' && player.status !== 'Active') return false;
        if (!player.fantasy_positions || player.fantasy_positions.length === 0) return false;
        return true;
      }).length;

    // Get current database stats
    const currentPlayerCount = await prisma.player.count();
    const draftedCount = await prisma.player.count({
      where: { isDrafted: true }
    });
    const withNotesCount = await prisma.player.count({
      where: { 
        OR: [
          { userNotes: { isEmpty: false } },
          { notes: { some: {} } }
        ]
      }
    });

    res.json({
      sleeper: {
        totalPlayers: Object.keys(sleeperPlayers).length,
        activeFantasyPlayers: activeCount
      },
      current: {
        totalPlayers: currentPlayerCount,
        draftedPlayers: draftedCount,
        playersWithNotes: withNotesCount
      },
      message: `Would sync ${activeCount} active players from Sleeper. Your existing ${draftedCount} drafted players and ${withNotesCount} players with notes will be preserved.`
    });
  } catch (error: any) {
    console.error('Error generating sync preview:', error);
    res.status(500).json({
      error: 'Failed to generate sync preview',
      details: error.message
    });
  }
});

export default router;