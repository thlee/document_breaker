// 전역 변수 선언
let game;
let canvas;
let currentLanguage = 'ko';
let translations = {};
let leaderboardUpdateInterval;
let lastUpdateTime = Date.now();
let isMuted = false;
let audioContext;
let audioManager;

// Firebase 설정 (원래 작동했던 프로젝트)
const firebaseConfig = {
    apiKey: "AIzaSyAr6n19PDSSc-ctcTj_0H57OrIJ0NZToxI",
    authDomain: "document-breaker.firebaseapp.com",
    projectId: "document-breaker",
    storageBucket: "document-breaker.firebasestorage.app",
    messagingSenderId: "593392485742",
    appId: "1:593392485742:web:2937714a798e582e10ed7f",
    measurementId: "G-PTN3JYHWB2"
};

// Firebase 초기화
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const functions = firebase.app().functions('asia-northeast1');

// playSound 전역 함수 (AudioManager 래퍼)
function playSound(frequency, duration, type = 'sine') {
    if (audioManager) {
        audioManager.playSound(frequency, duration, type);
    }
}

// 게임 메인 함수들
function startGame() {
    if (audioManager) {
        audioManager.initAudio();
        audioManager.playRandomBackgroundMusic();
    }
    game.start();
}

function restartGame() {
    game.reset();
    if (audioManager) {
        audioManager.playRandomBackgroundMusic();
    }
    game.start();
}

function toggleMute() {
    if (audioManager) {
        audioManager.toggleMute();
    }
}

// 초기화 및 이벤트 리스너
window.addEventListener('load', async () => {
    // 언어 시스템 초기화
    await loadLanguage('ko');
    
    // AudioManager 초기화
    audioManager = new AudioManager();
    audioManager.initAudio();
    audioContext = audioManager.audioContext;
    
    game = new Game();
    canvas = document.getElementById('gameCanvas');
    
    document.getElementById('muteButton').addEventListener('click', toggleMute);
    
    // A키 이벤트 핸들러
    document.addEventListener('keydown', (e) => {
        // 채팅 입력창에 포커스가 있으면 게임 키 이벤트 무시
        if (document.activeElement && 
            (document.activeElement.id === 'chatInput' || 
             document.activeElement.id === 'chatUsername')) {
            return;
        }
        
        if (e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            if (game && game.gameRunning && !game.gameOver && !game.paused) {
                game.useAiToken();
            }
        }
    });
    
    // AI 토큰 클릭 이벤트
    const aiTokensDisplay = document.getElementById('aiTokensDisplay');
    if (aiTokensDisplay) {
        aiTokensDisplay.addEventListener('click', (e) => {
            e.preventDefault();
            if (game && game.gameRunning && !game.gameOver && !game.paused) {
                game.useAiToken();
            }
        });
    }
    
    // 마우스 이동 이벤트 추가 (총 모드용)
    let lastGunShotTime = 0;
    canvas.addEventListener('mousemove', (e) => {
        if (!game || !game.isGunMode) return;
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const currentTime = Date.now();
        
        // 문서들과 충돌 검사
        for (let i = game.documents.length - 1; i >= 0; i--) {
            const doc = game.documents[i];
            if (mouseX >= doc.x && mouseX <= doc.x + doc.size &&
                mouseY >= doc.y && mouseY <= doc.y + doc.size && !doc.clicked) {

                // 문서의 click 메서드를 호출하여 파괴 처리
                if (doc.click()) {
                    game.score += doc.getScore();
                    game.updateScore();

                    // 폭발 소리 재생
                    if (audioManager && !audioManager.isMutedState()) {
                        audioManager.playExplosionSound();
                    }

                    // 총 소리 재생 (연속 재생)
                    if (audioManager && !audioManager.isMutedState() && currentTime - lastGunShotTime > 100) {
                        audioManager.playGunSound();
                        lastGunShotTime = currentTime;
                    }
                    
                    break;
                }
            }
        }
        
        // 쌓인 문서들과 충돌 검사
        for (let i = game.stackedDocuments.length - 1; i >= 0; i--) {
            const doc = game.stackedDocuments[i];
            if (mouseX >= doc.x && mouseX <= doc.x + doc.size &&
                mouseY >= doc.y && mouseY <= doc.y + doc.size) {
                
                // 쌓인 문서는 단순 객체이므로 직접 파괴 처리
                game.score += 10; // AI 모드에서 쌓인 문서 파괴 시 10점
                game.updateScore();
                
                // 폭발 효과 생성 (쌓인 문서용)
                game.createParticles(doc.x, doc.y, doc.size, doc.color);
                
                // 쌓인 문서 배열에서 제거
                game.stackedDocuments.splice(i, 1);
                game.updateHealthBar(); // 체력바 업데이트

                // 폭발 소리 재생
                if (audioManager && !audioManager.isMutedState()) {
                    audioManager.playExplosionSound();
                }

                // 총 소리 재생 (연속 재생)
                if (audioManager && !audioManager.isMutedState() && currentTime - lastGunShotTime > 100) {
                    audioManager.playGunSound();
                    lastGunShotTime = currentTime;
                }
                
                break;
            }
        }
    });
    
    // 채팅 시스템 초기화
    initializeChat();
});