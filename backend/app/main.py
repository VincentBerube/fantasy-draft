from fastapi import FastAPI
from app.api import player

app = FastAPI()

app.include_router(player.router, prefix="/players", tags=["Players"])

@app.get("/")
def root():
    return {"message": "Fantasy Draft Assistant backend running"}
