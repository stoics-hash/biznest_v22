from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)


class AnalyzeResponse(BaseModel):
    answer: str
    city_name: str