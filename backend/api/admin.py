from fastapi import FastAPI

router = FastAPI()

@router.get("/")
async def root():
    return {"message": "Admin API"}
