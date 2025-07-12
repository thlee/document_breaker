// 전역 변수 선언
let game;
let canvas;
let currentLanguage = 'ko';
let translations = {};
let leaderboardUpdateInterval;
let lastUpdateTime = Date.now();

// 클래스 정의들
class Document {
    constructor(x, y, size, color, lifespan) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.color = color;
        this.lifespan = lifespan;
        this.age = 0;
        this.clicked = false;
        this.explosionParticles = [];
        this.sinking = false;
        this.sinkSpeed = 2;
        this.originalY = y;
        
        // 움직임 속성 추가
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.bounceDamping = 0.8;
    }

    update() {
        this.age++;
        
        if (this.clicked) {
            // 파티클 생성은 Game 클래스에서 처리하므로, 여기서는 단순히 소멸되도록 함
            return false;
        }
        
        if (this.age >= this.lifespan && !this.sinking) {
            this.sinking = true;
            this.y = canvas.height - this.size;
        }
        
        if (this.sinking) {
            return false;
        }
        
        // 움직임 업데이트
        this.x += this.vx;
        this.y += this.vy;
        
        // 벽면 충돌 처리
        if (this.x <= 0 || this.x >= canvas.width - this.size) {
            this.vx *= -this.bounceDamping;
            this.x = Math.max(0, Math.min(canvas.width - this.size, this.x));
        }
        
        if (this.y <= 80 || this.y >= canvas.height - this.size) {
            this.vy *= -this.bounceDamping;
            this.y = Math.max(80, Math.min(canvas.height - this.size, this.y));
        }
        
        return true;
    }

    click() {
        if (this.clicked) return false;
        
        this.clicked = true;
        // 통합 파티클 시스템으로 폭발 효과 생성
        game.createParticles(this.x, this.y, this.size, this.color);
        
        if (audioManager && !audioManager.isMutedState()) {
            audioManager.playExplosionSound();
        }
        
        return true;
    }

    getScore() {
        const sizeMultiplier = Math.max(0.5, (70 - this.size) / 40);
        const timeMultiplier = Math.max(0.5, (180 - this.lifespan) / 120);
        return Math.round(10 * sizeMultiplier * timeMultiplier);
    }

    draw(ctx) {
        if (this.clicked) {
            // 파티클 렌더링은 Game 클래스에서 처리
            return;
        }
        
        ctx.save();
        
        const alpha = this.sinking ? 0.3 : Math.max(0.3, 1 - this.age / this.lifespan);
        ctx.globalAlpha = alpha;
        
        // 3D 입체감 효과를 위한 그림자 추가
        const centerX = this.x + this.size / 2;
        const centerY = this.y + this.size / 2;
        
        // 그림자 렌더링
        ctx.save();
        ctx.globalAlpha = alpha * 0.3;
        ctx.filter = 'blur(2px)';
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        ctx.fillText('📄', centerX + 3, centerY + 3);
        ctx.restore();
        
        // 메인 문서 렌더링 (입체감을 위한 그라데이션 효과)
        ctx.filter = `hue-rotate(${this.color.replace('#', '')}) saturate(150%) drop-shadow(2px 2px 4px rgba(0,0,0,0.3))`;
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 하이라이트 효과
        ctx.save();
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('📄', centerX - 1, centerY - 1);
        ctx.restore();
        
        // 메인 아이템
        ctx.fillText('📄', centerX, centerY);
        
        ctx.restore();
    }

    drawExplosion(ctx) {
        for (const particle of this.explosionParticles) {
            ctx.save();
            
            // 투명도 설정
            const alpha = particle.life / particle.maxLife;
            ctx.globalAlpha = alpha;
            
            // 파티클 중심으로 이동
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.rotation);
            
            // 반짝이는 효과
            if (particle.sparkle) {
                const sparkleAlpha = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);
                ctx.globalAlpha = alpha * sparkleAlpha;
            }
            
            // 파티클 종류에 따라 다른 모양 그리기
            if (particle.sparkle) {
                // 별 모양
                ctx.fillStyle = particle.color;
                ctx.beginPath();
                const spikes = 6;
                const outerRadius = particle.size;
                const innerRadius = particle.size * 0.4;
                
                for (let i = 0; i < spikes * 2; i++) {
                    const angle = (i * Math.PI) / spikes;
                    const radius = i % 2 === 0 ? outerRadius : innerRadius;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();
                ctx.fill();
            } else {
                // 원형 파티클
                ctx.fillStyle = particle.color;
                ctx.beginPath();
                ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
                ctx.fill();
                
                // 중심에 밝은 점
                ctx.fillStyle = '#FFFFFF';
                ctx.globalAlpha = alpha * 0.7;
                ctx.beginPath();
                ctx.arc(0, 0, particle.size * 0.3, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
        }
    }

    isClicked(mouseX, mouseY) {
        return mouseX >= this.x && mouseX <= this.x + this.size &&
               mouseY >= this.y && mouseY <= this.y + this.size;
    }
}

class AIItem {
    constructor(x, y, size, lifespan) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.lifespan = lifespan;
        this.age = 0;
        this.clicked = false;
        this.pulsePhase = 0;
    }

    update() {
        this.age++;
        this.pulsePhase += 0.1;
        return this.age < this.lifespan && !this.clicked;
    }

    draw(ctx) {
        if (this.clicked) return;

        const alpha = Math.max(0, 1 - (this.age / this.lifespan) * 0.5);
        const pulse = Math.sin(this.pulsePhase) * 0.3 + 0.7;
        const baseAlpha = alpha * pulse;

        const centerX = this.x + this.size / 2;
        const centerY = this.y + this.size / 2;

        // AI 글로우 효과
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.4;
        ctx.filter = 'blur(4px)';
        ctx.font = `${this.size + 8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#00FF00';
        ctx.fillText('🤖', centerX, centerY);
        ctx.restore();
        
        // 그림자 효과
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.3;
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        ctx.fillText('🤖', centerX + 2, centerY + 2);
        ctx.restore();
        
        // 메인 AI (입체감을 위한 그라데이션 효과)
        ctx.globalAlpha = baseAlpha;
        ctx.filter = 'drop-shadow(1px 1px 3px rgba(0,0,0,0.5))';
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 하이라이트 효과
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.8;
        ctx.fillStyle = '#90EE90';
        ctx.fillText('🤖', centerX - 0.5, centerY - 0.5);
        ctx.restore();
        
        // 메인 AI
        ctx.fillStyle = '#00FF00';
        ctx.fillText('🤖', centerX, centerY);
        
        ctx.restore();
    }

    isClicked(x, y) {
        return x >= this.x && x <= this.x + this.size &&
               y >= this.y && y <= this.y + this.size && !this.clicked;
    }
}

class Star {
    constructor(x, y, size, lifespan) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.lifespan = lifespan;
        this.age = 0;
        this.clicked = false;
        this.vx = (Math.random() - 0.5) * 1;
        this.vy = (Math.random() - 0.5) * 1;
        this.bounceDamping = 0.9;
        this.twinkle = 0;
    }

    update() {
        this.age++;
        this.twinkle += 0.2;
        
        if (this.clicked || this.age >= this.lifespan) {
            return false;
        }
        
        this.x += this.vx;
        this.y += this.vy;
        
        if (this.x <= 0 || this.x >= canvas.width - this.size) {
            this.vx *= -this.bounceDamping;
            this.x = Math.max(0, Math.min(canvas.width - this.size, this.x));
        }
        
        if (this.y <= 80 || this.y >= canvas.height - this.size) {
            this.vy *= -this.bounceDamping;
            this.y = Math.max(80, Math.min(canvas.height - this.size, this.y));
        }
        
        return true;
    }

    draw(ctx) {
        ctx.save();
        
        const baseAlpha = 0.7 + 0.3 * Math.sin(this.twinkle);
        const centerX = this.x + this.size / 2;
        const centerY = this.y + this.size / 2;
        
        // 메일 주변 글로우 효과
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.4;
        ctx.filter = 'blur(4px)';
        ctx.font = `${this.size + 8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#4A90E2';
        ctx.fillText('📧', centerX, centerY);
        ctx.restore();
        
        // 그림자 효과
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.3;
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        ctx.fillText('📧', centerX + 2, centerY + 2);
        ctx.restore();
        
        // 메인 메일 (입체감을 위한 그라데이션 효과)
        ctx.globalAlpha = baseAlpha;
        ctx.filter = 'drop-shadow(1px 1px 3px rgba(0,0,0,0.5))';
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 하이라이트 효과
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.8;
        ctx.fillStyle = '#87CEEB';
        ctx.fillText('📧', centerX - 0.5, centerY - 0.5);
        ctx.restore();
        
        // 메인 메일
        ctx.fillStyle = '#4A90E2';
        ctx.fillText('📧', centerX, centerY);
        
        ctx.restore();
    }

    isClicked(mouseX, mouseY) {
        return mouseX >= this.x && mouseX <= this.x + this.size &&
               mouseY >= this.y && mouseY <= this.y + this.size;
    }
}

class Newbie {
    constructor(x, y, size, lifespan) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.lifespan = lifespan;
        this.age = 0;
        this.clicked = false;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5;
        this.bounceDamping = 0.8;
        
        // 랜덤하게 신입사원 타입 선택 (0 또는 1)
        this.newbieType = Math.floor(Math.random() * 2);
        this.newbieImage = null;
    }

    update() {
        this.age++;
        
        if (this.clicked || this.age >= this.lifespan) {
            return false;
        }
        
        this.x += this.vx;
        this.y += this.vy;
        
        if (this.x <= 0 || this.x >= canvas.width - this.size) {
            this.vx *= -this.bounceDamping;
            this.x = Math.max(0, Math.min(canvas.width - this.size, this.x));
        }
        
        if (this.y <= 80 || this.y >= canvas.height - this.size) {
            this.vy *= -this.bounceDamping;
            this.y = Math.max(80, Math.min(canvas.height - this.size, this.y));
        }
        
        return true;
    }

    draw(ctx) {
        ctx.save();
        
        const centerX = this.x + this.size / 2;
        const centerY = this.y + this.size / 2;
        const radius = this.size / 2;
        
        // 그림자 효과
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.filter = 'blur(3px)';
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(centerX + 3, centerY + 3, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        // 외곽 테두리 (입체감)
        ctx.save();
        ctx.strokeStyle = '#CCCCCC';
        ctx.lineWidth = 2;
        ctx.filter = 'drop-shadow(1px 1px 2px rgba(0,0,0,0.3))';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        
        // 원형 클리핑 마스크 생성
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.clip();
        
        // 메인 이미지 렌더링
        if (this.newbieImage && this.newbieImage.complete) {
            ctx.drawImage(this.newbieImage, this.x, this.y, this.size, this.size);
        }
        
        ctx.restore();
        
        // 하이라이트 효과 (입체감 강화)
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isClicked(mouseX, mouseY) {
        return mouseX >= this.x && mouseX <= this.x + this.size &&
               mouseY >= this.y && mouseY <= this.y + this.size;
    }
}

// 트래픽 제한 관리 클래스
class RateLimiter {
    constructor() {
        this.requests = [];
        this.maxRequests = 5; // 1분간 최대 5회
        this.timeWindow = 60000; // 1분
    }
    
    canMakeRequest() {
        const now = Date.now();
        // 1분 이전의 요청들 제거
        this.requests = this.requests.filter(time => now - time < this.timeWindow);
        
        if (this.requests.length >= this.maxRequests) {
            return false;
        }
        
        this.requests.push(now);
        return true;
    }
    
    getTimeUntilReset() {
        if (this.requests.length === 0) return 0;
        const oldestRequest = Math.min(...this.requests);
        return Math.max(0, this.timeWindow - (Date.now() - oldestRequest));
    }
}

// Firebase 설정
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
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Functions 지역 설정 (asia-northeast1으로 명시적 설정)
const functions = firebase.app().functions('asia-northeast1');

// Firebase 연결 테스트
console.log('Firebase 초기화 완료');

// 전역 인스턴스 생성
const rateLimiter = new RateLimiter();

// 게임 함수들
function startGame() {
    if (audioManager) {
        audioManager.initAudio();
        audioManager.playRandomBackgroundMusic(); // 게임 시작 시 랜덤 음악 재생
    }
    game.start();
}

function restartGame() {
    game.reset();
    if (audioManager) {
        audioManager.playRandomBackgroundMusic(); // 재시작 시에도 새로운 음악 재생
    }
    game.start();
}

function toggleMute() {
    if (audioManager) {
        audioManager.toggleMute();
    }
}

// 점수 등록 팝업 표시
function showScorePopup(score) {
    const popup = document.getElementById('scorePopup');
    const popupTitle = document.getElementById('popupTitle');
    const popupScoreText = document.getElementById('popupScoreText');
    const popupQuestion = document.getElementById('popupQuestion');
    const popupPlayerName = document.getElementById('popupPlayerName');
    const popupSubmitBtn = document.getElementById('popupSubmitBtn');
    const popupStatus = document.getElementById('popupStatus');
    
    // 팝업 텍스트 업데이트
    popupTitle.textContent = t('scoreRegistration');
    popupScoreText.innerHTML = `${t('score')}: <span id="popupScore" data-score="${score}">${score.toLocaleString()}</span>${t('points')}`;
    popupQuestion.textContent = t('registerScore');
    popupPlayerName.placeholder = t('playerNamePlaceholder');
    popupSubmitBtn.textContent = t('register');
    document.querySelector('.popup-skip-btn').textContent = t('skip');
    
    // 폼 초기화
    popupPlayerName.value = '';
    popupStatus.textContent = '';
    popupSubmitBtn.disabled = false;
    
    // 엔터키 처리
    popupPlayerName.onkeypress = function(e) {
        if (e.key === 'Enter') {
            submitScoreFromPopup();
        }
    };
    
    popup.style.display = 'flex';
    
    // 입력 필드에 포커스
    setTimeout(() => {
        popupPlayerName.focus();
    }, 100);
}

// 점수 등록 팝업 닫기
function closeScorePopup() {
    document.getElementById('scorePopup').style.display = 'none';
}

// 팝업에서 점수 제출
async function submitScoreFromPopup() {
    const playerNameElement = document.getElementById('popupPlayerName');
    const submitBtn = document.getElementById('popupSubmitBtn');
    const statusMsg = document.getElementById('popupStatus');
    const scoreElement = document.getElementById('popupScore');
    
    const playerName = playerNameElement ? playerNameElement.value : '';
    // data-score 속성에서 원본 점수 값 가져오기
    const score = scoreElement ? parseInt(scoreElement.getAttribute('data-score')) || 0 : 0;
    
    if (!playerName || playerName.trim() === '') {
        statusMsg.textContent = t('enterPlayerName');
        statusMsg.style.color = '#f44336';
        return;
    }
    
    submitBtn.disabled = true;
    statusMsg.textContent = t('savingScore');
    statusMsg.style.color = '#FFD700';
    
    const saveResult = await saveScore(playerName, score);
    
    if (saveResult.success) {
        if (saveResult.message === 'Score too low to be saved in top 50') {
            statusMsg.textContent = t('scoreNotInTop50');
            statusMsg.style.color = '#FFC107';
        } else {
            statusMsg.textContent = t('scoreSaved');
            statusMsg.style.color = '#4CAF50';
        }
        
        // 랭킹 업데이트 (즉시)
        await loadLeaderboard('leaderboardList');
        lastUpdateTime = Date.now();
        updateLeaderboardTitle();
        
        // 2초 후 팝업 닫기
        setTimeout(() => {
            closeScorePopup();
        }, 2000);
    } else {
        statusMsg.textContent = t('scoreSaveFailed');
        statusMsg.style.color = '#f44336';
        submitBtn.disabled = false;
    }
}

// 언어 파일 로드 함수
async function loadLanguage(langCode) {
    try {
        const response = await fetch(`lang/${langCode}.json`);
        if (!response.ok) {
            throw new Error(`언어 파일을 불러올 수 없습니다: ${langCode}`);
        }
        const langData = await response.json();
        translations = langData;
        currentLanguage = langCode;
        return true;
    } catch (error) {
        // 기본 언어(영어)로 폴백
        if (langCode !== 'en') {
            return await loadLanguage('en');
        }
        return false;
    }
}

// IP 기반 국가 정보 가져오기 (캐싱 포함)
async function getCountryInfo() {
    const CACHE_KEY = 'country_info_cache';
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24시간
    
    // 캐시에서 데이터 확인
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            const now = Date.now();
            
            // 캐시가 유효한 경우
            if (parsed.timestamp && (now - parsed.timestamp) < CACHE_DURATION) {
                currentLanguage = parsed.data.countryCode === 'KR' ? 'ko' : 'en';
                return parsed.data;
            }
        } catch (error) {
            // 캐시 데이터가 손상된 경우 삭제
            localStorage.removeItem(CACHE_KEY);
        }
    }
    
    // API 호출로 새 데이터 가져오기
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        
        // 언어 설정 (한국이 아닌 경우 영어로 설정)
        currentLanguage = data.country_code === 'KR' ? 'ko' : 'en';
        
        const countryInfo = {
            country: data.country_name || 'Unknown',
            countryCode: data.country_code || 'XX',
            flag: getCountryFlag(data.country_code || 'XX')
        };
        
        // 캐시에 저장
        const cacheData = {
            timestamp: Date.now(),
            data: countryInfo
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        
        return countryInfo;
    } catch (error) {
        currentLanguage = 'en'; // 기본값은 영어
        
        // API 호출 실패 시 기본값 반환
        const defaultInfo = {
            country: 'Unknown',
            countryCode: 'XX',
            flag: '🌍'
        };
        
        // 기본값도 캐시에 저장 (짧은 시간 동안)
        const cacheData = {
            timestamp: Date.now(),
            data: defaultInfo
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        
        return defaultInfo;
    }
}

// 번역 함수
function t(key, ...args) {
    let text = translations[key] || key;
    // 플레이스홀더 교체 ({0}, {1}, ... 형태)
    args.forEach((arg, index) => {
        text = text.replace(new RegExp(`\\{${index}\\}`, 'g'), arg);
    });
    return text;
}

// UI 텍스트 업데이트 함수
function updateUITexts() {
    // 시작 화면 텍스트
    const startScreen = document.getElementById('startScreen');
    if (startScreen) {
        startScreen.querySelector('#gameTitle').textContent = t('gameTitle');
        startScreen.querySelector('h3:nth-of-type(1)').textContent = t('gameObjective');
        startScreen.querySelector('p:nth-of-type(1)').innerHTML = t('gameObjectiveDesc');
        startScreen.querySelector('h3:nth-of-type(2)').textContent = t('gameElements');
        startScreen.querySelector('p:nth-of-type(2)').innerHTML = t('gameElementsDesc');
        startScreen.querySelector('h3:nth-of-type(3)').textContent = t('gameTips');
        startScreen.querySelector('p:nth-of-type(3)').innerHTML = t('gameTipsDesc');
        startScreen.querySelector('.start-button').textContent = t('startGame');
    }

    // 게임 오버 화면 텍스트
    const gameOverScreen = document.getElementById('gameOverScreen');
    if (gameOverScreen) {
        gameOverScreen.querySelector('h1').textContent = t('bossAnger');
        gameOverScreen.querySelector('#gameOverMessage').textContent = t('tooManyDocuments');
        gameOverScreen.querySelector('.restart-button').textContent = t('restartGame');
    }

    // 랭킹 제목
    const gameLeaderboard = document.getElementById('gameLeaderboard');
    if (gameLeaderboard) {
        gameLeaderboard.querySelector('h3').textContent = t('liveRanking');
    }

    // 점수 표시 업데이트
    const scoreElement = document.querySelector('.score');
    if (scoreElement) {
        const currentScore = document.getElementById('scoreValue').textContent;
        scoreElement.innerHTML = `${t('score')}: <span id="scoreValue">${currentScore}</span>`;
    }
}

// 국가 코드를 국기 이모지로 변환
function getCountryFlag(countryCode) {
    const flagMap = {
        'KR': '🇰🇷', 'US': '🇺🇸', 'JP': '🇯🇵', 'CN': '🇨🇳', 'DE': '🇩🇪',
        'FR': '🇫🇷', 'GB': '🇬🇧', 'IT': '🇮🇹', 'ES': '🇪🇸', 'CA': '🇨🇦',
        'AU': '🇦🇺', 'BR': '🇧🇷', 'IN': '🇮🇳', 'RU': '🇷🇺', 'MX': '🇲🇽',
        'TH': '🇹🇭', 'VN': '🇻🇳', 'SG': '🇸🇬', 'MY': '🇲🇾', 'PH': '🇵🇭',
        'ID': '🇮🇩', 'TW': '🇹🇼', 'HK': '🇭🇰', 'NL': '🇳🇱', 'SE': '🇸🇪',
        'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮', 'CH': '🇨🇭', 'AT': '🇦🇹',
        'BE': '🇧🇪', 'PT': '🇵🇹', 'PL': '🇵🇱', 'CZ': '🇨🇿', 'HU': '🇭🇺',
        'GR': '🇬🇷', 'TR': '🇹🇷', 'EG': '🇪🇬', 'SA': '🇸🇦', 'AE': '🇦🇪',
        'IL': '🇮🇱', 'ZA': '🇿🇦', 'NG': '🇳🇬', 'KE': '🇰🇪', 'AR': '🇦🇷',
        'CL': '🇨🇱', 'CO': '🇨🇴', 'PE': '🇵🇪', 'VE': '🇻🇪', 'UY': '🇺🇾'
    };
    return flagMap[countryCode] || '🌍';
}

// 새로운 점수 저장 함수
async function saveScore(playerName, score) {
    console.log('=== saveScore called ===');
    console.log('받은 playerName:', JSON.stringify(playerName));
    console.log('받은 playerName 타입:', typeof playerName);
    console.log('받은 score:', score);
    console.log('받은 score 타입:', typeof score);
    
    // 기본 검증
    if (!playerName || typeof playerName !== 'string' || playerName.trim() === '') {
        console.error('플레이어 이름이 필요합니다');
        return false;
    }
    
    if (typeof score !== 'number' || score < 0 || score > 100000) {
        console.error('유효하지 않은 점수:', score);
        return false;
    }
    
    // 트래픽 제한 확인
    if (!rateLimiter.canMakeRequest()) {
        const waitTime = Math.ceil(rateLimiter.getTimeUntilReset() / 1000);
        console.error('너무 많은 요청:', waitTime + '초 후 다시 시도');
        return false;
    }
    
    try {
        // Cloud Function 호출
        const submitScoreFunction = functions.httpsCallable('submitScore');
        
        // 국가 정보 가져오기
        const countryInfo = await getCountryInfo();
        
        // 전송할 데이터 객체 생성
        const requestData = {
            playerName: playerName.trim(),
            score: score,
            country: countryInfo.country,
            countryCode: countryInfo.countryCode,
            flag: countryInfo.flag
        };
        
        const result = await submitScoreFunction(requestData);
        
        return result.data;
        
    } catch (error) {
        console.error('점수 저장 실패:', error);
        
        // 오류 타입별 처리
        if (error.code === 'invalid-argument') {
            console.error('잘못된 데이터:', error.message);
        } else if (error.code === 'unavailable') {
            console.error('서버 연결 실패');
        } else {
            console.error('알 수 없는 오류:', error.message);
        }
        
        return false;
    }
}

// 랭킹 불러오기 함수
async function loadLeaderboard(containerId = 'leaderboardList') {
    try {
        const snapshot = await db.collection('scores')
            .orderBy('score', 'desc')
            .limit(50)
            .get();
        
        const leaderboardList = document.getElementById(containerId);
        leaderboardList.innerHTML = '';
        
        if (snapshot.empty) {
            leaderboardList.innerHTML = `<div class="leaderboard-item"><span>${t('noRecords')}</span><span></span></div>`;
            return;
        }
        
        snapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            
            const rank = index + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
            const flag = data.flag || '🌍';
            const playerName = data.playerName || 'Unknown';
            const score = Number(data.score) || 0;
            
            // 시간 경과 계산
            const timeElapsed = getTimeElapsed(data.timestamp);
            const timeDisplay = timeElapsed ? ` (${timeElapsed})` : '';
            
            // 디버깅 로그
            if (isNaN(rank) || rank === undefined) {
                console.error('랭킹 오류:', { index, rank, data });
                return; // 오류 발생 시 해당 항목 건너뛰기
            }
            
            item.innerHTML = `
                <div class="player-info">
                    <span>${medal}</span>
                    <span class="country-flag">${flag}</span>
                    <span>${playerName}</span>
                </div>
                <span class="leaderboard-score">${score.toLocaleString()}${t('points')}${timeDisplay}</span>
            `;
            leaderboardList.appendChild(item);
        });
    } catch (error) {
        console.error('랭킹 불러오기 중 오류:', error);
        document.getElementById(containerId).innerHTML = 
            `<div class="leaderboard-item"><span>${t('loadingError')}</span><span></span></div>`;
    }
}

// 시간 경과 계산 함수
function getTimeElapsed(timestamp) {
    if (!timestamp) return '';
    
    const now = Date.now();
    const recordTime = timestamp.seconds ? timestamp.seconds * 1000 : timestamp;
    const diff = now - recordTime;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days > 0) {
        return currentLanguage === 'ko' ? `${days}일 전` : `${days} days ago`;
    } else {
        return currentLanguage === 'ko' ? '오늘' : 'Today';
    }
}

// 마지막 갱신 시간 표시
function updateLeaderboardTitle() {
    const titleElement = document.getElementById('leaderboardTitle');
    const updateTimeElement = document.getElementById('lastUpdateTime');
    
    if (titleElement) {
        titleElement.textContent = '🏆 실시간 랭킹';
    }
    
    if (updateTimeElement) {
        const now = new Date(lastUpdateTime);
        const timeString = now.toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        updateTimeElement.textContent = `(${timeString})`;
    }
}

// 랭킹 자동 갱신 시작
function startLeaderboardAutoUpdate() {
    // 기존 인터벌이 있다면 제거
    if (leaderboardUpdateInterval) {
        clearInterval(leaderboardUpdateInterval);
    }
    
    // 5분(300초)마다 랭킹 갱신
    leaderboardUpdateInterval = setInterval(async () => {
        try {
            await loadLeaderboard('leaderboardList');
            lastUpdateTime = Date.now();
            updateLeaderboardTitle();
        } catch (error) {
            // 랭킹 갱신 실패 시 무시
        }
    }, 300000); // 300초 = 300000ms
}

// 랭킹 자동 갱신 중지
function stopLeaderboardAutoUpdate() {
    if (leaderboardUpdateInterval) {
        clearInterval(leaderboardUpdateInterval);
        leaderboardUpdateInterval = null;
    }
}

// 초기화 함수
async function initializeGame() {
    try {
        // 국가 정보 가져오기 및 언어 설정
        const countryInfo = await getCountryInfo();
        
        // 언어 파일 로드
        const langCode = countryInfo.countryCode === 'KR' ? 'ko' : 'en';
        const langLoaded = await loadLanguage(langCode);
        
        if (!langLoaded) {
            // 기본 텍스트 설정
            translations = {
                connectingFirebase: 'Loading...',
                loadingRanking: 'Loading rankings...',
                liveRanking: '🏆 Live Ranking'
            };
        }
        
        // UI 텍스트 업데이트
        updateUITexts();
        
        // 초기 랭킹 로드 (로딩 메시지 표시)
        document.getElementById('leaderboardList').innerHTML = 
            `<div class="leaderboard-item"><span>${t('loadingRanking')}</span><span></span></div>`;
        
        // 랭킹 로드
        await loadLeaderboard('leaderboardList');
        lastUpdateTime = Date.now();
        updateLeaderboardTitle();
        
        // 랭킹 자동 갱신 시작
        startLeaderboardAutoUpdate();
        
    } catch (error) {
        // 기본 설정으로 계속 진행
        document.getElementById('leaderboardList').innerHTML = 
            `<div class="leaderboard-item"><span>Loading...</span><span></span></div>`;
        
        // 오류가 있어도 자동 갱신은 시작
        startLeaderboardAutoUpdate();
    }
}

// DOMContentLoaded 이벤트 리스너
window.addEventListener('load', () => {
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
            console.log('A키 눌림 - 게임 상태 확인', game ? '게임 있음' : '게임 없음');
            if (game && game.gameRunning && !game.gameOver && !game.paused) {
                console.log('AI 토큰 사용 시도');
                game.useAiToken();
            } else {
                console.log('게임 상태가 올바르지 않음:', {
                    gameExists: !!game,
                    gameRunning: game ? game.gameRunning : 'N/A',
                    gameOver: game ? game.gameOver : 'N/A',
                    paused: game ? game.paused : 'N/A'
                });
            }
        }
    });
    
    // AI 토큰 클릭 이벤트
    const aiTokensDisplay = document.getElementById('aiTokensDisplay');
    if (aiTokensDisplay) {
        aiTokensDisplay.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('AI 토큰 클릭됨');
            if (game && game.gameRunning && !game.gameOver && !game.paused) {
                console.log('AI 토큰 사용 시도');
                game.useAiToken();
            } else {
                console.log('게임 상태가 올바르지 않음:', {
                    gameExists: !!game,
                    gameRunning: game ? game.gameRunning : 'N/A',
                    gameOver: game ? game.gameOver : 'N/A',
                    paused: game ? game.paused : 'N/A'
                });
            }
        });
    } else {
        console.log('aiTokensDisplay 요소를 찾을 수 없음');
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
            // 문서의 실제 크기로 충돌 검사 (size 속성 사용)
            if (mouseX >= doc.x && mouseX <= doc.x + doc.size &&
                mouseY >= doc.y && mouseY <= doc.y + doc.size && !doc.clicked) {

                // 문서의 click 메서드를 호출하여 파괴 처리
                if (doc.click()) {
                    game.score += doc.getScore();
                    game.updateScore();

                    // 총 소리 재생 (연속 재생)
                    if (audioManager && !audioManager.isMutedState() && currentTime - lastGunShotTime > 100) {
                        audioManager.playGunSound();
                        lastGunShotTime = currentTime;
                    }
                }
                break; // 한 번에 하나의 문서만 파괴
            }
        }
        
        // 쌓여있는 문서들과 충돌 검사
        for (let i = game.stackedDocuments.length - 1; i >= 0; i--) {
            const doc = game.stackedDocuments[i];
            // 문서의 실제 크기로 충돌 검사 (size 속성 사용)
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
                break; // 한 번에 하나의 문서만 파괴
            }
        }
    });
    
    initializeGame();
    initializeChat();
});

// 페이지 언로드 시 자동 갱신 중지
window.addEventListener('beforeunload', () => {
    stopLeaderboardAutoUpdate();
});

// 페이지 가시성 변경 시 처리
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // 페이지가 백그라운드로 가면 자동 갱신 중지
        stopLeaderboardAutoUpdate();
    } else {
        // 페이지가 다시 보이면 자동 갱신 시작
        startLeaderboardAutoUpdate();
        // 즉시 한 번 갱신
        loadLeaderboard('leaderboardList').then(() => {
            lastUpdateTime = Date.now();
            updateLeaderboardTitle();
        }).catch(() => {});
    }
});