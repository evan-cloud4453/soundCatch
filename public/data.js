const quizData = [
    { 
        category: '동물!', 
        videoId: 'sS_tTj8H8sY', // 예시: 사자 울음소리
        startSeconds: 2, 
        answer: '사자', 
        difficulty: '8+' 
    },
    { 
        category: '애니메이션!', 
        videoId: 'L0MK7qz13bU', // 예시: 겨울왕국 Let it go
        startSeconds: 61, 
        answer: '겨울왕국', 
        difficulty: '8+' 
    },
    { 
        category: '게임 소리!', 
        videoId: 'NTa6XbzcqZI', // 예시: 마리오 동전 소리
        startSeconds: 0, 
        answer: '슈퍼 마리오', 
        difficulty: '8+' 
    }
];

// 브라우저에서 모듈처럼 사용할 수 있게 전역 객체에 할당
window.quizData = quizData;