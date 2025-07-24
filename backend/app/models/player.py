from pydantic import BaseModel

class Player(BaseModel):
    name: str
    team: str
    position: str
    adp: float | None = None
    projection: float | None = None
