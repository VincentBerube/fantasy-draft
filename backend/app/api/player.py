from fastapi import APIRouter
from app.models.player import Player

router = APIRouter()

@router.get("/")
def list_players():
    # Placeholder response
    return [{"name": "Justin Jefferson", "position": "WR", "team": "MIN"}]
