// backend/src/services/advanced-import.service.ts
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

export interface ImportSession {
  id: string;
  timestamp: string;
  summary: {
    totalProcessed: number;
    playersModified: number;
    playersCreated: number;
    fieldsChanged: number;
  };
  changes: Array<{
    playerId: string;
    playerName: string;
    action: 'create' | 'update';
    oldData?: Record<string, any>;
    newData: Record<string, any>;
    fieldsChanged: string[];
  }>;
}

export class AdvancedImportService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Execute controlled import with detailed tracking
   */
  async executeControlledImport(
    importData: {
      columnMappings: any[];
      playerSelections: any[];
      settings: any;
    }
  ): Promise<ImportSession> {
    const sessionId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const session: ImportSession = {
      id: sessionId,
      timestamp,
      summary: {
        totalProcessed: 0,
        playersModified: 0,
        playersCreated: 0,
        fieldsChanged: 0
      },
      changes: []
    };

    try {
      // Process each selected player
      for (const playerSelection of importData.playerSelections) {
        if (!playerSelection.willImport) continue;

        session.summary.totalProcessed++;

        if (playerSelection.matchType === 'new') {
          // Create new player
          const newPlayer = await this.createPlayerFromImport(playerSelection, sessionId);
          
          session.changes.push({
            playerId: newPlayer.id,
            playerName: newPlayer.name,
            action: 'create',
            newData: playerSelection.newData,
            fieldsChanged: Object.keys(playerSelection.newData)
          });

          session.summary.playersCreated++;
          session.summary.fieldsChanged += Object.keys(playerSelection.newData).length;
        } else {
          // Update existing player
          const oldData = await this.getPlayerCurrentData(playerSelection.matchedPlayer.id);
          const updatedPlayer = await this.updatePlayerFromImport(
            playerSelection.matchedPlayer.id,
            playerSelection.newData,
            importData.settings,
            sessionId
          );

          const fieldsChanged = Object.keys(playerSelection.newData);

          session.changes.push({
            playerId: playerSelection.matchedPlayer.id,
            playerName: playerSelection.name,
            action: 'update',
            oldData,
            newData: playerSelection.newData,
            fieldsChanged
          });

          session.summary.playersModified++;
          session.summary.fieldsChanged += fieldsChanged.length;
        }
      }

      // Store the import session for rollback purposes
      await this.storeImportSession(session);

      return session;

    } catch (error) {
      console.error('Advanced import failed:', error);
      throw error;
    }
  }

  /**
   * Rollback an import session
   */
  async rollbackImport(sessionId: string): Promise<void> {
    try {
      const session = await this.getImportSession(sessionId);
      if (!session) {
        throw new Error('Import session not found');
      }

      // Process rollback in reverse order
      for (const change of session.changes.reverse()) {
        if (change.action === 'create') {
          // Delete the created player
          await this.prisma.player.delete({
            where: { id: change.playerId }
          });
        } else if (change.action === 'update' && change.oldData) {
          // Restore the old data
          await this.prisma.player.update({
            where: { id: change.playerId },
            data: {
              ...change.oldData,
              lastSyncAt: new Date()
            }
          });
        }
      }

      // Mark session as rolled back
      await this.markSessionRolledBack(sessionId);

    } catch (error) {
      console.error('Rollback failed:', error);
      throw error;
    }
  }

  /**
   * Get import history for a user
   */
  async getImportHistory(limit: number = 10): Promise<ImportSession[]> {
    try {
      const sessions = await this.prisma.importSession.findMany({
        where: {
          rolledBack: false
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit
      });

      return sessions.map(session => ({
        id: session.id,
        timestamp: session.createdAt.toISOString(),
        summary: session.summary as any,
        changes: session.changes as any
      }));
    } catch (error) {
      console.error('Failed to get import history:', error);
      return [];
    }
  }

  // Private helper methods
  private async createPlayerFromImport(playerSelection: any, sessionId: string): Promise<any> {
    const playerData = {
      name: playerSelection.name,
      position: playerSelection.position || 'UNKNOWN',
      team: playerSelection.team || null,
      dataSource: 'excel',
      lastSyncAt: new Date(),
      importSessionId: sessionId,
      ...playerSelection.newData
    };

    return await this.prisma.player.create({
      data: playerData
    });
  }

  private async updatePlayerFromImport(
    playerId: string, 
    newData: Record<string, any>, 
    settings: any,
    sessionId: string
  ): Promise<any> {
    // Get current player data
    const currentPlayer = await this.prisma.player.findUnique({
      where: { id: playerId }
    });

    if (!currentPlayer) {
      throw new Error('Player not found');
    }

    // Apply update strategy
    let updateData = { ...newData };
    
    if (settings.updateStrategy === 'merge') {
      // Only update fields that have values
      updateData = Object.fromEntries(
        Object.entries(newData).filter(([key, value]) => value !== null && value !== undefined)
      );
    }

    // Protect Sleeper data if setting is enabled
    if (settings.preserveSleeperData && currentPlayer.sleeperId) {
      const protectedFields = ['name', 'position', 'team'];
      protectedFields.forEach(field => {
        delete updateData[field];
      });
    }

    updateData.lastSyncAt = new Date();
    updateData.importSessionId = sessionId;

    return await this.prisma.player.update({
      where: { id: playerId },
      data: updateData
    });
  }

  private async getPlayerCurrentData(playerId: string): Promise<Record<string, any>> {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: {
        name: true,
        position: true,
        team: true,
        rank: true,
        customRank: true,
        projectedPoints: true,
        vorp: true,
        adp: true,
        byeWeek: true,
        tierId: true,
        isDrafted: true
      }
    });

    return player || {};
  }

  private async storeImportSession(session: ImportSession): Promise<void> {
    await this.prisma.importSession.create({
      data: {
        id: session.id,
        summary: session.summary as any,
        changes: session.changes as any,
        rolledBack: false
      }
    });
  }

  private async getImportSession(sessionId: string): Promise<ImportSession | null> {
    const session = await this.prisma.importSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) return null;

    return {
      id: session.id,
      timestamp: session.createdAt.toISOString(),
      summary: session.summary as any,
      changes: session.changes as any
    };
  }

  private async markSessionRolledBack(sessionId: string): Promise<void> {
    await this.prisma.importSession.update({
      where: { id: sessionId },
      data: { rolledBack: true }
    });
  }
}

// Add these routes to your players.route.ts

// Advanced import preview with column mappings
router.post('/import/advanced-preview', upload.single('file'), async (req: MulterRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const columnMappings = req.body.columnMappings ? JSON.parse(req.body.columnMappings) : [];
    const settings = req.body.settings ? JSON.parse(req.body.settings) : {};

    // Generate detailed player previews with the configured mappings
    const importService = new EnhancedPlayerImportService(prisma);
    const preview = await importService.getAdvancedPreview(req.file.path, columnMappings, settings);

    res.json({
      success: true,
      playerPreviews: preview
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

// Execute advanced import
router.post('/import/advanced-execute', upload.single('file'), async (req: MulterRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const importData = JSON.parse(req.body.importData);
    
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
router.post('/import/rollback/:sessionId', async (req, res) => {
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
router.get('/import/history', async (req, res) => {
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