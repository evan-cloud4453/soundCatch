import re
import Levenshtein

def preprocess(text: str) -> str:
    # 공백 및 특수문자 제거, 소문자 변환
    return re.sub(r'[^a-z0-9가-힣]', '', text.lower())

def smart_grading(user_input: str, correct_answers: list[str]) -> bool:
    processed_input = preprocess(user_input)

    # 1단계: 빠른 완전 일치 검사
    for answer in correct_answers:
        processed_answer = preprocess(answer)
        if processed_input == processed_answer:
            return True

    # 2단계: 유사도 검사 (오타 보정)
    for answer in correct_answers:
        processed_answer = preprocess(answer)
        answer_length = len(processed_answer)
        
        if answer_length >= 3:
            distance = Levenshtein.distance(processed_input, processed_answer)
            similarity = 1 - (distance / max(len(processed_input), answer_length))
            
            # 허용 오차(delta) 설정: 1글자 오차 허용 또는 유사도 80% 이상
            delta = 1 
            
            if similarity >= 0.8 or distance <= delta:
                return True
                
    return False