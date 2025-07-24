/* import express from 'express';
import { DraftService } from '../services/draft.service';

const router = express.Router();
const draftService = new DraftService();

// Start new draft session
router.post('/start', (req, res) => {
  const { scoringType, teamCount } = req.body;
  const draft = draftService.createDraft(scoringType, teamCount);
  res.json(draft);
});

// Record a pick
router.post('/:draftId/pick', (req, res) => {
  const { playerId, team } = req.body;
  const updatedDraft = draftService.recordPick(
    req.params.draftId, 
    playerId, 
    team
  );
  res.json(updatedDraft);
});

export default router; */