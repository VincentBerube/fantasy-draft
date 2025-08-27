// backend/src/routes/tags.route.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PlayerService } from '../services/player.service';

const router = Router();
const prisma = new PrismaClient();
const playerService = new PlayerService(prisma);

// Get all tags
router.get('/', async (req: Request, res: Response) => {
  try {
    const tags = await playerService.getTags();
    res.json({
      success: true,
      data: tags
    });
  } catch (error: any) {
    console.error('Failed to get tags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tags',
      details: error.message
    });
  }
});

// Create tag
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, color } = req.body;
    
    if (!name || !color) {
      return res.status(400).json({
        success: false,
        error: 'Name and color are required'
      });
    }

    const tag = await playerService.createTag(name, color);
    res.json({
      success: true,
      data: tag
    });
  } catch (error: any) {
    console.error('Failed to create tag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create tag',
      details: error.message
    });
  }
});

// Update tag
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    const tag = await playerService.updateTag(id, name, color);
    res.json({
      success: true,
      data: tag
    });
  } catch (error: any) {
    console.error('Failed to update tag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update tag',
      details: error.message
    });
  }
});

// Delete tag
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await playerService.deleteTag(id);
    
    res.json({
      success: true,
      message: 'Tag deleted successfully'
    });
  } catch (error: any) {
    console.error('Failed to delete tag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete tag',
      details: error.message
    });
  }
});

export default router;