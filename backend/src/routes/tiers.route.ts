// backend/src/routes/tiers.route.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PlayerService } from '../services/player.service';

const router = Router();
const prisma = new PrismaClient();
const playerService = new PlayerService(prisma);

// Get all tiers
router.get('/', async (req: Request, res: Response) => {
  try {
    const tiers = await playerService.getTiers();
    res.json({
      success: true,
      data: tiers
    });
  } catch (error: any) {
    console.error('Failed to get tiers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tiers',
      details: error.message
    });
  }
});

// Create tier
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, color, order } = req.body;
    
    if (!name || !color || order === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Name, color, and order are required'
      });
    }

    const tier = await playerService.createTier(name, color, parseInt(order));
    res.json({
      success: true,
      data: tier
    });
  } catch (error: any) {
    console.error('Failed to create tier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create tier',
      details: error.message
    });
  }
});

// Update tier
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, color, order } = req.body;

    const tier = await playerService.updateTier(
      id, 
      name, 
      color, 
      order !== undefined ? parseInt(order) : undefined
    );
    
    res.json({
      success: true,
      data: tier
    });
  } catch (error: any) {
    console.error('Failed to update tier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update tier',
      details: error.message
    });
  }
});

// Delete tier
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await playerService.deleteTier(id);
    
    res.json({
      success: true,
      message: 'Tier deleted successfully'
    });
  } catch (error: any) {
    console.error('Failed to delete tier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete tier',
      details: error.message
    });
  }
});

export default router;