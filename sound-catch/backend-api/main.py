from fastapi import FastAPI
from pydantic import BaseModel
from scoring import smart_grading

app = FastAPI()

class AnswerPayload(BaseModel):
    user_input: str
    correct_answers: list[str]

@app.post("/api/grade")
def grade_answer(payload: AnswerPayload):
    is_correct = smart_grading(payload.user_input, payload.correct_answers)
    return {"is_correct": is_correct}