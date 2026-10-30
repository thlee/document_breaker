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
    if (!game || game.gameRunning) return;
    if (audioManager) {
        audioManager.initAudio();
        audioManager.playRandomBackgroundMusic();
    }
    game.start();
}

function restartGame() {
    if (!game) return;
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
    const startButton = document.getElementById('startGameButton');
    if (startButton) startButton.disabled = false;
    
    document.getElementById('muteButton').addEventListener('click', toggleMute);
    
    // A키 이벤트 핸들러
    document.addEventListener('keydown', (e) => {
        const target = document.activeElement;
        if (e.isComposing || (target && (target.isContentEditable ||
            ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName) ||
            target.closest?.('[role="button"]')))) {
            return;
        }
        
        if (e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            if (game && game.gameRunning && !game.gameOver && !game.paused) {
                game.useAiToken();
            }
        }
    });

    document.getElementById('pauseButton')?.addEventListener('click', () => game.togglePause());
    
    // AI 토큰 클릭 이벤트
    const aiTokensDisplay = document.getElementById('aiTokensDisplay');
    if (aiTokensDisplay) {
        aiTokensDisplay.addEventListener('click', (e) => {
            e.preventDefault();
            if (game && game.gameRunning && !game.gameOver && !game.paused) {
                game.useAiToken();
            }
        });
        aiTokensDisplay.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                game.useAiToken();
            }
        });
    }
    
    // 마우스 이동 이벤트 추가 (총 모드용)
    let lastGunShotTime = 0;
    const fireAtPointer = (e) => {
        if (!game || !game.gameRunning || game.gameOver || game.paused || !game.isGunMode) return;
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (canvas.width / (rect.width || canvas.width));
        const mouseY = (e.clientY - rect.top) * (canvas.height / (rect.height || canvas.height));
        if (mouseX < 0 || mouseY < 0 || mouseX > canvas.width || mouseY > canvas.height) return;
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
                game.removeStackedDocument(doc);

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
    };

    // Mouse hover and held touch/pen dragging share the same game rules.
    const heldPointers = new Set();
    canvas.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        heldPointers.add(e.pointerId);
        if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
        if (game?.isGunMode && game.gameRunning && !game.gameOver && !game.paused) {
            if (e.cancelable) e.preventDefault();
            fireAtPointer(e);
        }
    });
    canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse' || heldPointers.has(e.pointerId)) {
            if (e.pointerType !== 'mouse' && e.cancelable) e.preventDefault();
            fireAtPointer(e);
        }
    });
    const releasePointer = (e) => {
        heldPointers.delete(e.pointerId);
        if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    canvas.addEventListener('pointerup', releasePointer);
    canvas.addEventListener('pointercancel', releasePointer);
    canvas.addEventListener('lostpointercapture', (e) => heldPointers.delete(e.pointerId));
    window.addEventListener('blur', () => heldPointers.clear());
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) heldPointers.clear();
    });
    
    // 채팅 시스템 초기화
    initializeChat();
});
