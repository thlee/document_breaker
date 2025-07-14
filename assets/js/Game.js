class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.resizeCanvas();

        this.initializeGameVariables();
        
        this.aiItems = [];
        this.aiItemInterval = 30000; // AI 아이템 스폰 주기 (30초)
        this.aiItemSpawnChance = 0.05;    // AI 아이템 스폰 확률 (5%)
        this.lastAiItemTime = 0;
        
        this.isGunMode = false;
        this.gunModeEndTime = 0;
        
        // AI 사용권 시스템
        this.aiTokens = 2; // 시작 시 2개
        this.maxAiTokens = 5; // 최대 5개
        
        // 신입사원 이미지들 초기화
        this.newbieImages = [];
        this.newbieImages[0] = new Image();
        this.newbieImages[0].src = 'assets/images/office_newbie_small_0.png';
        this.newbieImages[1] = new Image();
        this.newbieImages[1].src = 'assets/images/office_newbie_small_1.png';
        this.jobChangeMessage = '';
        this.jobChangeTime = 0;
        
        // 상사 레어 이벤트 관련
        this.lastBossTime = 0;
        this.bossInterval = 60000; // 1분 간격
        this.bossAppearChance = 0.2; // 20% 확률
        this.bossHighDocumentThreshold = 20; // 문서 임계값
        this.bossHighDocumentInterval = 30000; // 문서 많을 때 간격 (30초)
        this.bossHighDocumentChance = 0.5; // 문서 많을 때 확률 (50%)
        this.bossActive = false;
        this.bossStartTime = 0;
        this.bossDuration = 2000; // 2초
        this.bossClicked = false;
        this.bossX = 0;
        this.bossY = 0;
        this.bossSize = 30;
        this.bossType = 0; // 보스 타입 (0 또는 1)
        
        // 블럭 깨기 모드 관련
        this.blockBreakerMode = false;
        this.blockBreakerStartTime = 0;
        this.blockBreakerDuration = 10000; // 10초
        
        // 폭탄 문서 시스템
        this.bombDocument = null;
        this.bombStartTime = 0;
        this.bombDuration = 0;
        this.bombRemainingTime = 0; // 남은 시간을 별도로 관리
        this.bombSirenPlaying = false;
        this.lastBombSpawnTime = 0;
        this.bombSpawnInterval = this.getRandomBombInterval(); // 30-60초 랜덤 간격
        this.lastCountdown = 0; // 마지막 카운트다운 숫자 추적
        this.ballX = 0;
        this.ballY = 0;
        this.ballVX = 0;
        this.ballVY = 0;
        this.ballSize = 30;
        this.ballSpeed = 8;
        
        // 델타 타임 계산용
        this.lastFrameTime = 0;
        
        // 보스 이미지들 초기화
        this.bossImages = [];
        this.bossImages[0] = new Image();
        this.bossImages[0].src = 'assets/images/boss_small_0.png';
        this.bossImages[1] = new Image();
        this.bossImages[1].src = 'assets/images/boss_small_1.png';
        
        // 통합 파티클 시스템
        this.particles = [];
        
        this.currentBackgroundIndex = -1;
        
        this.setupEventListeners();
        this.gameLoop();
    }

    initializeGameVariables() {
        this.documents = [];
        this.stackedDocuments = [];
        this.newbies = [];
        this.stars = [];
        this.score = 0;
        this.gameStartTime = 0;
        this.maxStackedDocuments = 25;
        this.gameRunning = false;
        this.gameOver = false;
        this.paused = false;
        this.pauseTime = 0;
        this.lastDocumentTime = 0;
        this.documentInterval = 2000;
        this.lastNewbieTime = 0;
        this.newbieInterval = 8000;
        this.lastStarTime = 0;
        this.starInterval = 30000;
        this.jobChangeMessage = '';
        this.jobChangeTime = 0;
        
        // AI 토큰 초기화
        this.aiTokens = 2;
        this.aiItems = [];
        
        // 상사 및 블럭 깨기 모드 초기화
        this.lastBossTime = 0;
        this.bossActive = false;
        this.bossClicked = false;
        
        // 폭탄 문서 초기화
        this.bombDocument = null;
        this.bombStartTime = 0;
        this.bombDuration = 0;
        this.bombRemainingTime = 0;
        this.bombSirenPlaying = false;
        this.lastBombSpawnTime = 0;
        this.bombSpawnInterval = this.getRandomBombInterval();
        this.lastCountdown = 0;
        
        this.blockBreakerMode = false;
        
        // 경보음 정지
        if (typeof alarmSound !== 'undefined' && alarmSound) {
            alarmSound.pause();
            alarmSound.currentTime = 0;
        }
    }

    // .game-container에 맞춰 캔버스 크기를 조절하는 메서드
    resizeCanvas() {
        const container = document.querySelector('.game-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => {
            if (!this.gameRunning) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            this.handleClick(mouseX, mouseY);
        });

        window.addEventListener('keydown', (e) => {
            // 채팅 입력창에 포커스가 있으면 게임 키 이벤트 무시
            if (document.activeElement && 
                (document.activeElement.id === 'chatInput' || 
                 document.activeElement.id === 'chatUsername')) {
                return;
            }
            
            if (e.key === ' ' || (e.key && e.key.toLowerCase() === 'p')) {
                e.preventDefault(); // 스페이스바 스크롤 방지
                this.togglePause();
            }
        });

        // 창 크기가 변경될 때 캔버스 크기 다시 조절
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            // 게임이 실행 중이라면, 변경된 크기에 맞춰 다시 그리기
            if (this.gameRunning) {
                this.draw();
            }
        });

        // 브라우저 창이 뒤로 가면 자동 일시정지
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.gameRunning && !this.gameOver && !this.paused) {
                this.togglePause();
            }
        });
    }

    handleClick(mouseX, mouseY) {
        // 일시정지 중에는 클릭 무시
        if (this.paused) return;

        // 상사 클릭 체크 (최우선)
        if (this.bossActive && !this.bossClicked) {
            if (mouseX >= this.bossX && mouseX <= this.bossX + this.bossSize &&
                mouseY >= this.bossY && mouseY <= this.bossY + this.bossSize) {
                this.bossClicked = true;
                this.triggerBlockBreakerMode(mouseX, mouseY);
                
                if (audioContext) {
                    playSound(880, 0.3, 'square');
                    setTimeout(() => playSound(1100, 0.3, 'square'), 100);
                    setTimeout(() => playSound(1320, 0.5, 'square'), 200);
                }
                
                return;
            }
        }
        
        // 블럭 깨기 모드에서는 다른 클릭 무시
        if (this.blockBreakerMode) {
            return;
        }
        
        // 폭탄 문서 클릭 체크
        if (this.bombDocument) {
            const bombDoc = this.stackedDocuments[this.bombDocument.index];
            if (bombDoc && mouseX >= bombDoc.x && mouseX <= bombDoc.x + bombDoc.size &&
                mouseY >= bombDoc.y && mouseY <= bombDoc.y + bombDoc.size) {
                this.defuseBomb();
                return;
            }
        }
        
        for (let i = this.stars.length - 1; i >= 0; i--) {
            const star = this.stars[i];
            if (star.isClicked(mouseX, mouseY)) {
                star.clicked = true;
                this.triggerJobChange();
                
                // 이직 효과음 재생
                if (!isMuted && goodByeSound) {
                    try {
                        goodByeSound.currentTime = 0;
                        goodByeSound.volume = 0.6;
                        goodByeSound.play();
                    } catch (error) {
                        // 오디오 재생 실패 시 기본 효과음으로 대체
                        if (audioContext) {
                            playSound(800, 0.2, 'sine');
                            setTimeout(() => playSound(1000, 0.2, 'sine'), 100);
                            setTimeout(() => playSound(1200, 0.3, 'sine'), 200);
                        }
                    }
                } else if (audioContext) {
                    // 기본 효과음 재생
                    playSound(800, 0.2, 'sine');
                    setTimeout(() => playSound(1000, 0.2, 'sine'), 100);
                    setTimeout(() => playSound(1200, 0.3, 'sine'), 200);
                }
                
                return;
            }
        }
        
        // AI 아이템 클릭 확인 (사용권 추가)
        for (let i = this.aiItems.length - 1; i >= 0; i--) {
            const aiItem = this.aiItems[i];
            if (aiItem.isClicked(mouseX, mouseY)) {
                aiItem.clicked = true;
                this.addAiToken();
                
                // AI 사용권 획득 효과음
                if (audioContext && !isMuted) {
                    playSound(1000, 0.2, 'sine');
                    setTimeout(() => playSound(1200, 0.15, 'triangle'), 100);
                }
                return;
            }
        }
        
        for (let i = this.newbies.length - 1; i >= 0; i--) {
            const newbie = this.newbies[i];
            if (newbie.isClicked(mouseX, mouseY)) {
                newbie.clicked = true;
                this.addStackedDocuments(5);
                
                if (audioContext) {
                    playSound(150, 0.3, 'sawtooth');
                }
                
                return;
            }
        }
        
        for (let i = this.documents.length - 1; i >= 0; i--) {
            const doc = this.documents[i];
            if (doc.isClicked(mouseX, mouseY) && doc.click()) {
                this.score += doc.getScore();
                this.updateScore();
                break;
            }
        }
    }

    // 일시정지 토글 (간소화)
    togglePause() {
        if (!this.gameRunning || this.gameOver) return;

        this.paused = !this.paused;
        
        if (this.paused) {
            this.pauseTime = Date.now();
            this.pauseAllAudio();
            if (audioContext) playSound(500, 0.1, 'triangle');
        } else {
            const pausedDuration = Date.now() - this.pauseTime;
            this.adjustAllTimersForPause(pausedDuration);
            this.resumeAllAudio();
            if (audioContext) playSound(700, 0.1, 'triangle');
        }
    }

    // 모든 오디오 일시정지
    pauseAllAudio() {
        const backgroundMusic = document.getElementById('backgroundMusic');
        const gunModeMusic = document.getElementById('gunModeLoopSound');
        
        if (backgroundMusic) backgroundMusic.pause();
        if (this.isGunMode && gunModeMusic) gunModeMusic.pause();
    }

    // 모든 오디오 재개
    resumeAllAudio() {
        const backgroundMusic = document.getElementById('backgroundMusic');
        const gunModeMusic = document.getElementById('gunModeLoopSound');
        
        if (backgroundMusic) backgroundMusic.play().catch(e => {});
        if (this.isGunMode && gunModeMusic) gunModeMusic.play().catch(e => {});
    }

    // 모든 타이머를 일시정지 시간만큼 조정
    adjustAllTimersForPause(pausedDuration) {
        // 게임 시작 시간 조정 (타이머가 멈추도록)
        this.gameStartTime += pausedDuration;
        
        // 스폰 타이머들
        this.lastDocumentTime += pausedDuration;
        this.lastNewbieTime += pausedDuration;
        this.lastStarTime += pausedDuration;
        this.lastBossTime += pausedDuration;
        this.lastAiItemTime += pausedDuration;
        this.lastBombSpawnTime += pausedDuration;
        
        // 모드 타이머들
        if (this.isGunMode) {
            this.gunModeEndTime += pausedDuration;
        }
        if (this.bossActive) {
            this.bossStartTime += pausedDuration;
        }
        if (this.blockBreakerMode) {
            this.blockBreakerStartTime += pausedDuration;
        }
        if (this.bombDocument) {
            this.bombStartTime += pausedDuration;
        }
        if (this.jobChangeMessage) {
            this.jobChangeTime += pausedDuration;
        }
    }

    spawnDocument() {
        const size = Math.random() * 40 + 30;
        const x = Math.random() * (this.canvas.width - size);
        const y = Math.random() * (this.canvas.height * 0.6 - size) + 80;
        const colors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd',
            '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43', '#10ac84',
            '#ee5a6f', '#0abde3', '#3867d6', '#8854d0', '#a55eea', '#26de81',
            '#fd79a8', '#fdcb6e', '#e17055', '#74b9ff', '#81ecec', '#fab1a0',
            '#ff7675', '#6c5ce7', '#a29bfe', '#ffeaa7', '#55a3ff', '#fd79a8'
        ];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const difficultyFactor = Math.max(0.5, 1 - (this.score / 500));
        const lifespan = Math.max(180, (Math.random() * 90 + 120) * difficultyFactor);
        
        this.documents.push(new Document(x, y, size, color, lifespan));
    }

    spawnNewbie() {
        const size = Math.random() * 30 + 50;
        const x = Math.random() * (this.canvas.width - size);
        const y = Math.random() * (this.canvas.height * 0.6 - size) + 80;
        const lifespan = Math.random() * 180 + 120;
        
        const newbie = new Newbie(x, y, size, lifespan);
        // 신입사원 타입에 맞는 이미지 설정
        newbie.newbieImage = this.newbieImages[newbie.newbieType];
        this.newbies.push(newbie);
        
        // 신입사원 타입에 맞는 효과음 재생
        const newbieSound = newbie.newbieType === 0 ? newbieAppearSound0 : newbieAppearSound1;
        if (!isMuted && newbieSound) {
            try {
                newbieSound.currentTime = 0;
                newbieSound.volume = 0.8;
                newbieSound.play();
            } catch (error) {
                // 오디오 재생 실패 시 무시
            }
        }
    }

    spawnStar() {
        const size = Math.random() * 10 + 20;
        const x = Math.random() * (this.canvas.width - size);
        const y = Math.random() * (this.canvas.height * 0.6 - size) + 80;
        const lifespan = 120;
        
        this.stars.push(new Star(x, y, size, lifespan));
        
        // 메일 나타날 때 효과음
        if (audioContext && !isMuted) {
            playSound(800, 0.2, 'sine');
            setTimeout(() => playSound(1000, 0.15, 'triangle'), 100);
        }
    }

    spawnAIItem() {
        const size = Math.random() * 10 + 25;
        const x = Math.random() * (this.canvas.width - size);
        const y = Math.random() * (this.canvas.height * 0.6 - size) + 80;
        const lifespan = 180; // 3초 더 오래 표시
        
        this.aiItems.push(new AIItem(x, y, size, lifespan));
        
        // AI 아이템 나타날 때 효과음
        if (audioContext && !isMuted) {
            playSound(1200, 0.15, 'square');
            setTimeout(() => playSound(1500, 0.1, 'sawtooth'), 80);
        }
    }

    useAiToken() {
        if (this.blockBreakerMode) return;
        if (this.isGunMode) return; // AI 모드 중에는 중복 사용 방지
        if (this.aiTokens > 0) {
            this.aiTokens--;
            this.updateAiTokensDisplay();
            this.activateGunMode();
        } else {
        }
    }

    activateGunMode() {
        this.isGunMode = true;
        this.gunModeEndTime = Date.now() + 5000; // 5초간
        document.getElementById('gameCanvas').style.cursor = 'crosshair';
        
        // AI 모드 활성화 효과음
        if (audioContext && !isMuted) {
            playSound(500, 0.3, 'square');
            setTimeout(() => playSound(800, 0.2, 'sine'), 100);
        }

        // 총 모드 배경음악 재생 (기존 배경음악은 멈추지 않음)
        if (gunModeLoopSound && !isMuted) {
            gunModeLoopSound.currentTime = 0;
            gunModeLoopSound.playbackRate = 2;
            gunModeLoopSound.volume = 1.0; // 볼륨 조절
            gunModeLoopSound.play().catch(e => console.error('총 모드 배경음악 재생 실패:', e));
        }
    }
    
    addAiToken() {
        if (this.aiTokens < this.maxAiTokens) {
            this.aiTokens++;
            this.updateAiTokensDisplay();
        }
    }
    
    updateAiTokensDisplay() {
        const display = document.getElementById('aiTokensDisplay');
        if (display) {
            display.innerHTML = '';
            if (this.aiTokens === 0) {
                const emptyToken = document.createElement('span');
                emptyToken.className = 'ai-empty';
                emptyToken.textContent = '💀';
                display.appendChild(emptyToken);
            } else {
                for (let i = 0; i < this.aiTokens; i++) {
                    const token = document.createElement('span');
                    token.className = 'ai-token';
                    token.textContent = '🤖';
                    display.appendChild(token);
                }
            }
        }
    }

    triggerJobChange() {
        this.jobChangeMessage = t('jobChange');
        this.jobChangeTime = Date.now();
        
        // 이직 시 점수 30점 차감 (0점 이하로는 내려가지 않음)
        this.score = Math.max(0, this.score - 20);
        this.updateScore();
        
        // 모든 문서들 제거 (쌓인 문서 + 날아다니는 문서)
        this.stackedDocuments = [];
        this.documents = [];
        this.newbies = [];
        this.stars = [];
        this.aiItems = [];
        this.updateHealthBar();
        
        // 이직 시 배경음악 변경
        playRandomBackgroundMusic();
        
        // 폭탄 문서 리셋
        this.bombDocument = null;
        this.bombStartTime = 0;
        this.bombDuration = 0;
        
        this.setRandomBackground();
        
        setTimeout(() => {
            this.jobChangeMessage = '';
        }, 2000);
    }

    spawnBombDocument() {
        // 쌓인 문서가 없거나 이미 폭탄이 활성 상태면 생성하지 않음
        if (this.stackedDocuments.length === 0 || this.bombDocument) return;
        
        // 랜덤하게 쌓인 문서 중 하나를 선택
        const randomIndex = Math.floor(Math.random() * this.stackedDocuments.length);
        const selectedDoc = this.stackedDocuments[randomIndex];
        
        // 10-20초 사이의 랜덤 카운트다운 시간 설정
        this.bombDuration = Math.floor(Math.random() * 11 + 10) * 1000; // 10000-20000ms
        this.bombRemainingTime = this.bombDuration; // 남은 시간 초기화
        this.bombStartTime = Date.now();
        this.bombSirenPlaying = false;
        this.lastCountdown = 0;
        
        // 폭탄 문서 정보 저장
        this.bombDocument = {
            index: randomIndex,
            ...selectedDoc
        };
        
        console.log('폭탄 문서 생성:', this.bombDuration / 1000 + '초');
        
        // 다음 폭탄 생성 간격을 새로 랜덤 설정
        this.bombSpawnInterval = this.getRandomBombInterval();
    }

    getRandomBombInterval() {
        // 30초(30000ms) ~ 60초(60000ms) 사이의 랜덤 값
        return Math.floor(Math.random() * 30000) + 30000;
    }

    defuseBomb() {
        if (!this.bombDocument) return;
        
        // 폭탄 해제 성공 - 50점 추가
        this.score += 50;
        this.updateScore();
        
        // 해당 문서 제거
        this.stackedDocuments.splice(this.bombDocument.index, 1);
        this.updateHealthBar();
        
        // "좋았어.mp3" 재생
        if (!isMuted && goodJobSound) {
            try {
                goodJobSound.currentTime = 0;
                goodJobSound.volume = 0.8;
                goodJobSound.play();
            } catch (error) {
                // 오디오 재생 실패 시 기본 효과음으로 대체
                if (audioContext) {
                    playSound(800, 0.3, 'square');
                    setTimeout(() => playSound(1000, 0.2, 'square'), 100);
                    setTimeout(() => playSound(1200, 0.3, 'square'), 200);
                }
            }
        } else if (audioContext && !isMuted) {
            // 기본 폭발 효과음
            playSound(800, 0.3, 'square');
            setTimeout(() => playSound(1000, 0.2, 'square'), 100);
            setTimeout(() => playSound(1200, 0.3, 'square'), 200);
        }
        
        // 경보음 정지
        if (alarmSound) {
            alarmSound.pause();
            alarmSound.currentTime = 0;
        }
        
        // 폭탄 상태 초기화
        this.bombDocument = null;
        this.bombRemainingTime = 0;
        this.bombSirenPlaying = false;
        this.lastCountdown = 0;
        
        console.log('폭탄 해제 성공! +50점');
    }

    explodeBomb() {
        if (!this.bombDocument) return;
        
        // 폭탄 폭발 - 50점 감소 (0점 이하로는 내려가지 않음)
        this.score = Math.max(0, this.score - 50);
        this.updateScore();
        
        // 문서 3개 추가
        this.addStackedDocuments(3);
        
        // "아안돼.mp3" 재생
        if (!isMuted && ohNoSound) {
            try {
                ohNoSound.currentTime = 0;
                ohNoSound.volume = 0.8;
                ohNoSound.play();
            } catch (error) {
                // 오디오 재생 실패 시 기본 효과음으로 대체
                if (audioContext) {
                    playSound(150, 0.5, 'sawtooth');
                    setTimeout(() => playSound(100, 0.3, 'sawtooth'), 100);
                    setTimeout(() => playSound(80, 0.2, 'sawtooth'), 200);
                }
            }
        } else if (audioContext && !isMuted) {
            // 기본 폭탄 터지는 효과음
            playSound(150, 0.5, 'sawtooth');
            setTimeout(() => playSound(100, 0.3, 'sawtooth'), 100);
            setTimeout(() => playSound(80, 0.2, 'sawtooth'), 200);
        }
        
        // 경보음 정지
        if (alarmSound) {
            alarmSound.pause();
            alarmSound.currentTime = 0;
        }
        
        // 폭탄 상태 초기화
        this.bombDocument = null;
        this.bombRemainingTime = 0;
        this.bombSirenPlaying = false;
        this.lastCountdown = 0;
        
        console.log('폭탄 폭발! -50점, 문서 3개 추가');
    }

    spawnBoss() {
        if (this.bossActive || this.blockBreakerMode || this.isGunMode) return; // 다른 모드 중에는 보스 스폰 방지
        
        // 문서 20개 이상일 때 보스 확률 및 간격 조정
        const currentBossChance = this.stackedDocuments.length >= this.bossHighDocumentThreshold ? this.bossHighDocumentChance : this.bossAppearChance;
        
        // 레어 확률 체크
        if (Math.random() > currentBossChance) return;
        
        this.bossActive = true;
        this.bossStartTime = Date.now();
        this.bossClicked = false;
        
        // 랜덤하게 보스 타입 선택 (0 또는 1)
        this.bossType = Math.floor(Math.random() * 2);
        
        // 랜덤 위치에 상사 스폰
        this.bossX = Math.random() * (this.canvas.width - this.bossSize);
        this.bossY = Math.random() * (this.canvas.height - this.bossSize - 80) + 80;
        
        // 보스 타입에 맞는 효과음 재생
        const bossSound = this.bossType === 0 ? bossAppearSound0 : bossAppearSound1;
        if (!isMuted && bossSound) {
            try {
                bossSound.currentTime = 0;
                bossSound.volume = 0.7;
                bossSound.play();
            } catch (error) {
                // 오디오 재생 실패 시 기본 효과음으로 대체
                if (audioContext) {
                    playSound(350, 0.3, 'sawtooth');
                }
            }
        } else if (audioContext) {
            // 기본 효과음 재생
            playSound(350, 0.3, 'sawtooth');
        }
    }

    triggerBlockBreakerMode(startX, startY) {
        this.blockBreakerMode = true;
        this.blockBreakerStartTime = Date.now();
        this.bossActive = false;
        
        // 볼 초기 위치 및 속도 설정
        this.ballX = startX;
        this.ballY = startY;
        this.ballVX = (Math.random() - 0.5) * this.ballSpeed;
        this.ballVY = -Math.abs(this.ballSpeed * 0.7); // 위쪽으로 시작
    }

    updateDocuments() {
        // 블럭 깨기 모드 또는 일반 모드 업데이트
        if (this.blockBreakerMode) {
            this.updateBlockBreaker();
        } else {
            for (let i = this.documents.length - 1; i >= 0; i--) {
                const doc = this.documents[i];
                
                if (!doc.update()) {
                    if (doc.sinking) {
                        const randomX = Math.random() * (this.canvas.width - doc.size);
                        const randomY = Math.random() * (this.canvas.height - doc.size - 80) + 80;
                        
                        this.stackedDocuments.push({
                            x: randomX,
                            y: randomY,
                            size: doc.size,
                            color: doc.color
                        });
                        this.updateHealthBar();
                    }
                    
                    this.documents.splice(i, 1);
                }
            }

            for (let i = this.newbies.length - 1; i >= 0; i--) {
                const newbie = this.newbies[i];
                
                if (!newbie.update()) {
                    this.newbies.splice(i, 1);
                }
            }

            for (let i = this.stars.length - 1; i >= 0; i--) {
                const star = this.stars[i];
                
                if (!star.update()) {
                    this.stars.splice(i, 1);
                }
            }

            for (let i = this.aiItems.length - 1; i >= 0; i--) {
                const aiItem = this.aiItems[i];
                
                if (!aiItem.update()) {
                    this.aiItems.splice(i, 1);
                }
            }
        }
        
        // 통합 파티클 시스템 업데이트 (항상 실행)
        this.updateParticles();
    }

    updateBlockBreaker() {
        const currentTime = Date.now();
        
        // 10초 후 블럭 깨기 모드 종료
        if (currentTime - this.blockBreakerStartTime >= this.blockBreakerDuration) {
            this.blockBreakerMode = false;
            // 모든 파티클 정리 (블럭깨기 모드에서 생성된 모든 파티클들)
            this.particles = [];
            // 남은 쌓인 문서들은 유지 (볼이 부딪치지 않은 문서들)
            this.updateHealthBar();
            return;
        }
        
        // 볼 이동
        this.ballX += this.ballVX;
        this.ballY += this.ballVY;
        
        const ballRadius = this.ballSize / 2;

        // 벽면 충돌
        if (this.ballX <= ballRadius || this.ballX >= this.canvas.width - ballRadius) {
            this.ballVX = -this.ballVX;
            this.ballX = Math.max(ballRadius, Math.min(this.canvas.width - ballRadius, this.ballX));
        }
        
        if (this.ballY <= 80 + ballRadius || this.ballY >= this.canvas.height - ballRadius) {
            this.ballVY = -this.ballVY;
            this.ballY = Math.max(80 + ballRadius, Math.min(this.canvas.height - ballRadius, this.ballY));
        }
        
        // 쌓인 문서와 충돌 체크
        for (let i = this.stackedDocuments.length - 1; i >= 0; i--) {
            const doc = this.stackedDocuments[i];
            
            if (this.ballX >= doc.x - ballRadius && 
                this.ballX <= doc.x + doc.size + ballRadius &&
                this.ballY >= doc.y - ballRadius && 
                this.ballY <= doc.y + doc.size + ballRadius) {
                
                // 통합 파티클 시스템으로 폭발 효과 생성
                game.createParticles(doc.x, doc.y, doc.size, doc.color);
        
                if (explosionSound && !isMuted) {
                    explosionSound.currentTime = 0;
                    explosionSound.volume = 0.3;
                    explosionSound.play().catch(e => console.log('폭발 소리 재생 실패:', e));
                }
                
                // 문서 제거
                this.stackedDocuments.splice(i, 1);
                this.updateHealthBar();
                
                // 점수 추가
                this.score += 20;
                this.updateScore();
                
                // 볼 반사
                const centerX = doc.x + doc.size / 2;
                const centerY = doc.y + doc.size / 2;
                
                if (Math.abs(this.ballX - centerX) > Math.abs(this.ballY - centerY)) {
                    this.ballVX = -this.ballVX;
                } else {
                    this.ballVY = -this.ballVY;
                }
               
                break;
            }
        }
    }

    updateHealthBar() {
        const healthPercentage = Math.max(0, 100 - (this.stackedDocuments.length / this.maxStackedDocuments) * 100);
        document.getElementById('healthFill').style.width = healthPercentage + '%';
        
        // health 퍼센트 텍스트 업데이트
        const healthText = document.getElementById('healthText');
        healthText.textContent = Math.round(healthPercentage) + '%';
        
        // health 상태에 따른 색상 변경
        if (healthPercentage > 60) {
            healthText.style.color = '#4CAF50'; // 녹색
        } else if (healthPercentage > 30) {
            healthText.style.color = '#FFC107'; // 노란색
        } else {
            healthText.style.color = '#F44336'; // 빨간색
        }
        
        // 25개 이상 쌓이면 게임 종료
        if (this.stackedDocuments.length >= this.maxStackedDocuments) {
            this.endGame();
        }
    }

    updateScore() {
        document.getElementById('scoreValue').textContent = this.score.toLocaleString();
    }

    updateTimer() {
        if (!this.gameRunning || this.gameOver) return;
        
        const currentTime = Date.now();
        const elapsedTime = Math.floor((currentTime - this.gameStartTime) / 1000);
        const minutes = Math.floor(elapsedTime / 60);
        const seconds = elapsedTime % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        document.getElementById('timerValue').textContent = timeString;
    }

    async endGame() {
        this.gameRunning = false;
        this.gameOver = true;
        
        // 배경음악 완전히 정지
        const backgroundMusic = document.getElementById('backgroundMusic');
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
        
        document.getElementById('gunModeLoopSound').pause(); // 총 모드 음악도 정지
        
        if (audioContext) {
            playSound(150, 0.5, 'sawtooth');
        }
        
        document.getElementById('finalScore').textContent = this.score.toLocaleString();
        
        // 최종 점수 텍스트 업데이트
        const finalScoreContainer = document.getElementById('gameOverScreen').querySelector('p:nth-of-type(2)');
        finalScoreContainer.innerHTML = `${t('finalScore')}: <span id="finalScore">${this.score.toLocaleString()}</span>${t('points')}`;
        
        document.getElementById('gameOverScreen').style.display = 'flex';
        
        // 점수 등록 팝업 표시 (0점이 아닐 때만)
        setTimeout(() => {
            if (this.score > 0) {
                showScorePopup(this.score);
            }
        }, 1000);
    }

    reset() {
        this.initializeGameVariables();
        this.updateAiTokensDisplay();

        // 총 모드 배경음악 정지
        const gunModeMusic = document.getElementById('gunModeLoopSound');
        if (gunModeMusic) {
            gunModeMusic.pause();
            gunModeMusic.currentTime = 0;
        }                

        this.updateScore();
        this.updateHealthBar();
        document.getElementById('gameOverScreen').style.display = 'none';
    }

    addStackedDocuments(count) {
        for (let i = 0; i < count; i++) {
            const size = Math.random() * 40 + 30;
            const randomX = Math.random() * (this.canvas.width - size);
            const randomY = Math.random() * (this.canvas.height - size - 80) + 80;
            const colors = [
                '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd',
                '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43', '#10ac84',
                '#ee5a6f', '#0abde3', '#3867d6', '#8854d0', '#a55eea', '#26de81',
                '#fd79a8', '#fdcb6e', '#e17055', '#74b9ff', '#81ecec', '#fab1a0',
                '#ff7675', '#6c5ce7', '#a29bfe', '#ffeaa7', '#55a3ff', '#fd79a8'
            ];
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            this.stackedDocuments.push({
                x: randomX,
                y: randomY,
                size: size,
                color: color
            });
        }
        this.updateHealthBar();
    }
    
    // 통합 파티클 생성 메서드
    createParticles(x, y, size, color) {
        // 기본 폭발 파티클 (30개)
        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 * i) / 30;
            const speed = Math.random() * 12 + 6;
            const particleSize = Math.random() * 4 + 2;
            
            this.particles.push({
                type: 'explosion',
                x: x + size / 2,
                y: y + size / 2,
                vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 4,
                vy: Math.sin(angle) * speed + (Math.random() - 0.5) * 4,
                life: Math.random() * 30 + 20,
                maxLife: Math.random() * 30 + 20,
                color: color,
                size: particleSize,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.3,
                gravity: 0.4,
                bounce: 0.7,
                sparkle: Math.random() > 0.6
            });
        }
        
        // 중앙 황금 파티클 (10개)
        for (let i = 0; i < 10; i++) {
            this.particles.push({
                type: 'explosion',
                x: x + size / 2,
                y: y + size / 2,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15,
                life: 15,
                maxLife: 15,
                color: '#FFD700',
                size: Math.random() * 6 + 4,
                rotation: 0,
                rotationSpeed: 0,
                gravity: 0.3,
                bounce: 0.8,
                sparkle: true
            });
        }
    }
   
    // 통합 파티클 업데이트 메서드
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            // 위치 업데이트
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // 중력 적용
            particle.vy += particle.gravity;
            
            // 회전 업데이트
            particle.rotation += particle.rotationSpeed;
            
            // 바닥 충돌 처리
            if (particle.y + particle.size > this.canvas.height) {
                particle.y = this.canvas.height - particle.size;
                particle.vy *= -particle.bounce;
                particle.vx *= 0.9; // 마찰
            }
            
            // 벽 충돌 처리
            if (particle.x < 0 || particle.x + particle.size > this.canvas.width) {
                particle.vx *= -particle.bounce;
                particle.x = Math.max(0, Math.min(this.canvas.width - particle.size, particle.x));
            }
            
            // 수명 감소
            particle.life--;
            
            // 파티클 제거
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    // 통합 파티클 렌더링 메서드
    renderParticles() {
        for (const particle of this.particles) {
            this.ctx.save();
            
            // 투명도 설정
            const alpha = particle.life / particle.maxLife;
            this.ctx.globalAlpha = alpha;
            
            // 파티클 중심으로 이동
            this.ctx.translate(particle.x, particle.y);
            this.ctx.rotate(particle.rotation);
            
            // 반짝이는 효과
            if (particle.sparkle) {
                const sparkleAlpha = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);
                this.ctx.globalAlpha = alpha * sparkleAlpha;
            }
            
            // 파티클 종류에 따라 다른 모양 그리기
            if (particle.sparkle) {
                // 별 모양
                this.ctx.fillStyle = particle.color;
                this.ctx.beginPath();
                const spikes = 6;
                const outerRadius = particle.size;
                const innerRadius = particle.size * 0.4;
                
                for (let i = 0; i < spikes * 2; i++) {
                    const angle = (i * Math.PI) / spikes;
                    const radius = i % 2 === 0 ? outerRadius : innerRadius;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    
                    if (i === 0) {
                        this.ctx.moveTo(x, y);
                    } else {
                        this.ctx.lineTo(x, y);
                    }
                }
                this.ctx.closePath();
                this.ctx.fill();
            } else {
                // 원형 파티클
                this.ctx.fillStyle = particle.color;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
                this.ctx.fill();
                
                // 중심에 밝은 점
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.globalAlpha = alpha * 0.7;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, particle.size * 0.3, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            this.ctx.restore();
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (const stackedDoc of this.stackedDocuments) {
            this.ctx.save();
            this.ctx.globalAlpha = 1.0;
            this.ctx.filter = `hue-rotate(${stackedDoc.color.replace('#', '')}) saturate(150%)`;
            this.ctx.font = `${stackedDoc.size}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('📄', stackedDoc.x + stackedDoc.size / 2, stackedDoc.y + stackedDoc.size / 2);
            this.ctx.restore();
        }
        
        // 폭탄 문서 렌더링
        if (this.bombDocument && this.stackedDocuments[this.bombDocument.index]) {
            const bombDoc = this.stackedDocuments[this.bombDocument.index];
            const countdown = Math.ceil(this.bombRemainingTime / 1000);
            
            // 폭탄 문서 배경 (빨간 글로우)
            this.ctx.save();
            this.ctx.globalAlpha = 0.5;
            this.ctx.filter = 'blur(6px)';
            this.ctx.fillStyle = '#FF0000';
            this.ctx.beginPath();
            this.ctx.arc(bombDoc.x + bombDoc.size / 2, bombDoc.y + bombDoc.size / 2, bombDoc.size / 2 - 5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
            
            // 카운트다운 숫자 렌더링
            this.ctx.save();
            this.ctx.font = `bold ${bombDoc.size * 0.5}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // 숫자 그림자
            this.ctx.fillStyle = '#000000';
            this.ctx.fillText(countdown.toString(), bombDoc.x + bombDoc.size / 2 + 2, bombDoc.y + bombDoc.size / 2 + 2);
            
            // 메인 숫자 (빨간색)
            this.ctx.fillStyle = countdown <= 5 ? '#FF0000' : '#FF4444';
            this.ctx.fillText(countdown.toString(), bombDoc.x + bombDoc.size / 2, bombDoc.y + bombDoc.size / 2);
            this.ctx.restore();
        }
        
        // 통합 파티클 렌더링
        this.renderParticles();
        
            for (const doc of this.documents) {
                doc.draw(this.ctx);
            }
            
            for (const newbie of this.newbies) {
                newbie.draw(this.ctx);
            }
            
            for (const star of this.stars) {
                star.draw(this.ctx);
            }

            for (const aiItem of this.aiItems) {
                aiItem.draw(this.ctx);
            }
        
        // 상사 렌더링
        if (this.bossActive) {
            this.ctx.save();
            
            // 깜빡이는 효과
            const elapsed = Date.now() - this.bossStartTime;
            const opacity = 0.5 + 0.5 * Math.sin(elapsed * 0.01);
            
            const centerX = this.bossX + this.bossSize / 2;
            const centerY = this.bossY + this.bossSize / 2;
            const radius = this.bossSize / 2;
            
            // 특별 이벤트 효과 - 노란 글로우
            this.ctx.save();
            this.ctx.globalAlpha = opacity * 0.6;
            this.ctx.filter = 'blur(8px)';
            this.ctx.fillStyle = '#FFD700';
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius + 10, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
            
            // 그림자 효과
            this.ctx.save();
            this.ctx.globalAlpha = opacity * 0.4;
            this.ctx.filter = 'blur(4px)';
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.arc(centerX + 4, centerY + 4, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
            
            // 외곽 테두리 (특별 이벤트 표시)
            this.ctx.save();
            this.ctx.globalAlpha = opacity;
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 3;
            this.ctx.filter = 'drop-shadow(2px 2px 4px rgba(255,215,0,0.8))';
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius + 2, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.restore();
            
            // 원형 클리핑 마스크 생성
            this.ctx.globalAlpha = opacity;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            this.ctx.clip();

            // 보스 타입에 맞는 이미지 사용
            const bossImage = this.bossImages[this.bossType];
            if (bossImage && bossImage.complete && bossImage.naturalHeight !== 0) {
                this.ctx.drawImage(bossImage, this.bossX, this.bossY, this.bossSize, this.bossSize);
            } else {
                // 이미지 로드 실패 시 대체 이모지 표시
                this.ctx.font = `${this.bossSize}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('😡', centerX, centerY);
            }
            
            this.ctx.restore();
            
            // 하이라이트 효과 (특별 이벤트 느낌)
            this.ctx.save();
            this.ctx.globalAlpha = opacity * 0.4;
            this.ctx.fillStyle = '#FFFF99';
            this.ctx.beginPath();
            this.ctx.arc(centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }
        
        // 블럭 깨기 모드 렌더링
        if (this.blockBreakerMode) {
            // 블럭 깨기 파티클 렌더링
            // this.renderParticles();
            
            // 볼 렌더링
            // 3D 블럭 깨기 볼 렌더링 (강화된 입체감)
            this.ctx.save();
            
            const radius = this.ballSize / 2;
            
            // 볼 색칠 효과 (전체적인 글로우)
            this.ctx.save();
            this.ctx.globalAlpha = 0.7;
            this.ctx.filter = 'blur(12px)';
            this.ctx.fillStyle = '#FF6B6B';
            this.ctx.beginPath();
            this.ctx.arc(this.ballX, this.ballY, radius + 15, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
            
            // 볼 그림자 (더 진한 그림자)
            this.ctx.save();
            this.ctx.globalAlpha = 0.5;
            this.ctx.filter = 'blur(6px)';
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.arc(this.ballX + 5, this.ballY + 5, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
            
            // 외곽 테두리 (금속성 느낌)
            this.ctx.save();
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 4;
            this.ctx.filter = 'drop-shadow(0 0 8px rgba(255,215,0,0.8))';
            this.ctx.beginPath();
            this.ctx.arc(this.ballX, this.ballY, radius + 3, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.restore();
            
            this.ctx.save();
            
            // 회전하는 상사 얼굴로 볼 렌더링
            const rotation = (Date.now() / 150) % (Math.PI * 2); // 회전 속도 조절
            
            this.ctx.translate(this.ballX, this.ballY); // 볼의 중심으로 이동
            this.ctx.rotate(rotation); // 회전
            
            // 원형 클리핑
            this.ctx.beginPath();
            this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
            this.ctx.clip();
            
            // 보스 타입에 맞는 이미지 사용
            const bossImage = this.bossImages[this.bossType];
            if (bossImage && bossImage.complete && bossImage.naturalHeight !== 0) {
                this.ctx.drawImage(bossImage, -radius, -radius, this.ballSize, this.ballSize);
            } else {
                // 이미지 로드 실패 시 대체 이모지 표시
                this.ctx.font = `${this.ballSize}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('😡', 0, 0);
            }
            
            this.ctx.restore();
            
            // 볼 하이라이트 (광택 효과)
            this.ctx.save();
            this.ctx.globalAlpha = 0.4;
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(this.ballX - radius * 0.3, this.ballY - radius * 0.3, radius * 0.5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
            
            // 남은 시간 표시 (캔버스에 직접 렌더링)
            const timeLeft = Math.max(0, this.blockBreakerDuration - (Date.now() - this.blockBreakerStartTime));
            const seconds = Math.ceil(timeLeft / 1000);
            const timerText = currentLanguage === 'ko' ? `상사 찬스: ${seconds}초` : `Boss Solves: ${seconds}s`;

            // 3D 타이머 효과
            this.ctx.save();
            
            const timerX = this.canvas.width - 20;
            const timerY = this.canvas.height - 20;
            
            // 배경 그림자 (깔이감)
            this.ctx.save();
            this.ctx.filter = 'blur(4px)';
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.font = 'bold 26px Arial';
            this.ctx.textAlign = 'right';
            this.ctx.textBaseline = 'bottom';
            this.ctx.fillText(timerText, timerX + 2, timerY + 2);
            this.ctx.restore();
            
            // 메인 텍스트 외곽선
            this.ctx.font = 'bold 24px Arial';
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 3;
            this.ctx.textAlign = 'right';
            this.ctx.textBaseline = 'bottom';
            this.ctx.strokeText(timerText, timerX, timerY);
            
            // 그라데이션 효과 (금색 타이머)
            const gradient = this.ctx.createLinearGradient(timerX - 100, timerY - 12, timerX, timerY + 12);
            gradient.addColorStop(0, '#FFFF00');
            gradient.addColorStop(0.5, '#FFD700');
            gradient.addColorStop(1, '#FFA500');
            this.ctx.fillStyle = gradient;
            this.ctx.fillText(timerText, timerX, timerY);
            
            // 하이라이트
            this.ctx.save();
            this.ctx.globalAlpha = 0.6;
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fillText(timerText, timerX - 1, timerY - 1);
            this.ctx.restore();
            
            this.ctx.restore();
        }

        // AI 모드 남은 시간 표시
        if (this.isGunMode) {
            const timeLeft = Math.max(0, this.gunModeEndTime - Date.now());
            const seconds = Math.ceil(timeLeft / 1000);
            const timerText = currentLanguage === 'ko' ? `AI 시간: ${seconds}초` : `AI Time: ${seconds}s`;

            // 3D 타이머 효과
            this.ctx.save();
            
            const timerX = 20; // 왼쪽 정렬
            const timerY = this.canvas.height - 20;
            
            // 배경 그림자 (깔끔함)
            this.ctx.save();
            this.ctx.filter = 'blur(4px)';
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.font = 'bold 26px Arial';
            this.ctx.textAlign = 'left'; // 왼쪽 정렬
            this.ctx.textBaseline = 'bottom';
            this.ctx.fillText(timerText, timerX + 2, timerY + 2);
            this.ctx.restore();
            
            // 메인 텍스트 외곽선
            this.ctx.font = 'bold 24px Arial';
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 3;
            this.ctx.textAlign = 'left'; // 왼쪽 정렬
            this.ctx.textBaseline = 'bottom';
            this.ctx.strokeText(timerText, timerX, timerY);
            
            // 그라데이션 효과 (AI 느낌 - 녹색 계열)
            const gradient = this.ctx.createLinearGradient(timerX, timerY - 12, timerX + 100, timerY + 12);
            gradient.addColorStop(0, '#00FF00');
            gradient.addColorStop(0.5, '#39FF14');
            gradient.addColorStop(1, '#90EE90');
            this.ctx.fillStyle = gradient;
            this.ctx.fillText(timerText, timerX, timerY);
            
            // 하이라이트
            this.ctx.save();
            this.ctx.globalAlpha = 0.6;
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fillText(timerText, timerX - 1, timerY - 1);
            this.ctx.restore();
            
            this.ctx.restore();
        }
        
        // 이직 메시지 렌더링 (3D 효과)
        if (this.jobChangeMessage) {
            this.ctx.save();
            
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            const message = this.jobChangeMessage;
            
            // 애니메이션 효과 (맥동 효과)
            const elapsed = Date.now() - this.jobChangeTime;
            const pulse = 0.9 + 0.1 * Math.sin(elapsed * 0.01);
            const fontSize = 72 * pulse;
            
            // 배경 글로우 (경고 효과)
            this.ctx.save();
            this.ctx.globalAlpha = 0.6;
            this.ctx.filter = 'blur(15px)';
            this.ctx.fillStyle = '#FF4444';
            this.ctx.font = `bold ${fontSize + 20}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(message, centerX, centerY);
            this.ctx.restore();
            
            // 연한 그림자
            this.ctx.save();
            this.ctx.filter = 'blur(6px)';
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.font = `bold ${fontSize}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(message, centerX + 4, centerY + 4);
            this.ctx.restore();
            
            // 진한 그림자
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
            this.ctx.font = `bold ${fontSize}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(message, centerX + 2, centerY + 2);
            this.ctx.restore();
            
            // 메인 텍스트 외곽선
            this.ctx.font = `bold ${fontSize}px Arial`;
            this.ctx.strokeStyle = '#8B0000';
            this.ctx.lineWidth = 6;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.strokeText(message, centerX, centerY);
            
            // 그라데이션 효과 (금색 비상 메시지)
            const gradient = this.ctx.createLinearGradient(centerX, centerY - fontSize/2, centerX, centerY + fontSize/2);
            gradient.addColorStop(0, '#FFFF99');
            gradient.addColorStop(0.3, '#FFD700');
            gradient.addColorStop(0.7, '#FF8C00');
            gradient.addColorStop(1, '#FF6B6B');
            this.ctx.fillStyle = gradient;
            this.ctx.fillText(message, centerX, centerY);
            
            // 하이라이트 (반짝이는 효과)
            this.ctx.save();
            this.ctx.globalAlpha = 0.7;
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fillText(message, centerX - 2, centerY - 3);
            this.ctx.restore();
            
            this.ctx.restore();
        }

        // 일시정지 화면 렌더링 (3D 효과)
        if (this.paused) {
            this.ctx.save();
            
            // 어두운 배경 오버레이
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            const pauseText = t('gamePaused');
            
            // 배경 그림자 (깊이감)
            this.ctx.save();
            this.ctx.filter = 'blur(8px)';
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.font = 'bold 65px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(pauseText, centerX + 5, centerY + 5);
            this.ctx.restore();
            
            // 연한 그림자
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this.ctx.font = 'bold 60px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(pauseText, centerX + 3, centerY + 3);
            this.ctx.restore();
            
            // 메인 텍스트 (입체감)
            this.ctx.font = 'bold 60px Arial';
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 6;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.strokeText(pauseText, centerX, centerY);
            
            // 그라데이션 효과
            const gradient = this.ctx.createLinearGradient(centerX, centerY - 30, centerX, centerY + 30);
            gradient.addColorStop(0, '#FFFFFF');
            gradient.addColorStop(0.5, '#E0E0E0');
            gradient.addColorStop(1, '#CCCCCC');
            this.ctx.fillStyle = gradient;
            this.ctx.fillText(pauseText, centerX, centerY);
            
            // 하이라이트
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.fillText(pauseText, centerX - 1, centerY - 2);
            this.ctx.restore();
            
            this.ctx.restore();
        }
    }

    // 통합 타이머 업데이트 메서드
    updateTimers(currentTime) {
        // 건 모드 타이머
        if (this.isGunMode && currentTime > this.gunModeEndTime) {
            this.endGunMode();
        }
        
        // 보스 타이머
        if (this.bossActive && currentTime - this.bossStartTime > this.bossDuration) {
            this.bossActive = false;
            this.bossClicked = false;
        }
        
        // 블럭깨기 모드가 아닐 때만 스폰
        if (!this.blockBreakerMode) {
            this.updateSpawnTimers(currentTime);
        }
        
        // 폭탄 타이머 (deltaTime 계산)
        const deltaTime = this.lastFrameTime > 0 ? currentTime - this.lastFrameTime : 0;
        this.updateBombTimer(currentTime, deltaTime);
    }

    // 스폰 타이머 통합 관리
    updateSpawnTimers(currentTime) {
        // 동적 난이도 조절
        this.documentInterval = Math.max(600, 1800 - this.score * 2.0);
        this.newbieInterval = Math.max(4000, 7000 - this.score * 2.5);
        this.starInterval = Math.max(18000, 28000 - this.score * 10);
        
        // 문서 스폰
        if (currentTime - this.lastDocumentTime > this.documentInterval) {
            this.spawnDocument();
            this.lastDocumentTime = currentTime;
        }
        
        // 신입사원 스폰
        if (currentTime - this.lastNewbieTime > this.newbieInterval) {
            this.spawnNewbie();
            this.lastNewbieTime = currentTime;
        }
        
        // 별 스폰
        if (currentTime - this.lastStarTime > this.starInterval) {
            this.spawnStar();
            this.lastStarTime = currentTime;
        }
        
        // AI 아이템 스폰
        if (this.aiTokens < this.maxAiTokens && currentTime - this.lastAiItemTime > this.aiItemInterval) {
            if (Math.random() < this.aiItemSpawnChance) {
                this.spawnAIItem();
            }
            this.lastAiItemTime = currentTime;
        }
        
        // 보스 스폰
        const currentBossInterval = this.stackedDocuments.length >= this.bossHighDocumentThreshold ? this.bossHighDocumentInterval : this.bossInterval;
        if (currentTime - this.lastBossTime > currentBossInterval) {
            this.spawnBoss();
            this.lastBossTime = currentTime;
        }
        
        // 폭탄 문서 스폰
        if (this.stackedDocuments.length >= 5 && !this.bombDocument && 
            currentTime - this.lastBombSpawnTime > this.bombSpawnInterval) {
            this.spawnBombDocument();
            this.lastBombSpawnTime = currentTime;
        }
    }

    // 폭탄 타이머 관리
    updateBombTimer(currentTime, deltaTime) {
        if (!this.bombDocument) return;
        
        // 일시정지 중이 아닐 때만 남은 시간 감소
        if (!this.paused) {
            this.bombRemainingTime = Math.max(0, this.bombRemainingTime - deltaTime);
        }
        
        const countdown = Math.ceil(this.bombRemainingTime / 1000);
        
        // 카운트다운 효과음
        if (countdown !== this.lastCountdown && !this.paused) {
            this.lastCountdown = countdown;
            if (countdown > 5 && audioContext && !isMuted) {
                playSound(600, 0.2, 'sine');
            }
        }
        
        // 경보음 (5초 이하)
        if (countdown <= 5 && countdown > 0 && !this.bombSirenPlaying && !this.paused) {
            this.bombSirenPlaying = true;
            this.playAlarmSound();
        }
        
        // 폭발
        if (this.bombRemainingTime <= 0 && !this.paused) {
            this.explodeBomb();
        }
    }

    // 경보음 재생 헬퍼
    playAlarmSound() {
        if (!isMuted && alarmSound) {
            try {
                alarmSound.currentTime = 0;
                alarmSound.volume = 0.7;
                alarmSound.play();
            } catch (error) {
                this.playFallbackAlarmSound();
            }
        } else if (audioContext && !isMuted) {
            this.playFallbackAlarmSound();
        }
    }

    // 기본 경보음
    playFallbackAlarmSound() {
        if (!audioContext) return;
        const playAlarm = () => {
            playSound(800, 0.2, 'sine');
            setTimeout(() => playSound(1000, 0.2, 'sine'), 200);
        };
        playAlarm();
        setTimeout(playAlarm, 500);
        setTimeout(playAlarm, 1000);
    }

    // 건 모드 종료
    endGunMode() {
        this.isGunMode = false;
        document.getElementById('gameCanvas').style.cursor = '';
        
        if (gunModeLoopSound) {
            gunModeLoopSound.pause();
        }
    }

    // 메인 게임 루프 (간소화)
    gameLoop() {
        const currentTime = Date.now();
        
        if (this.gameRunning && !this.gameOver && !this.paused) {
            this.updateTimers(currentTime);
            this.updateDocuments();
            this.updateTimer();
        }
        
        // 마지막 프레임 시간 업데이트
        this.lastFrameTime = currentTime;
        
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }

    start() {
        this.gameRunning = true;
        const currentTime = Date.now();
        this.gameStartTime = currentTime;
        this.lastDocumentTime = currentTime;
        this.lastNewbieTime = currentTime;
        this.lastStarTime = currentTime;
        this.lastAiItemTime = currentTime;
        this.lastBossTime = currentTime; // boss 타이머 초기화
        this.setRandomBackground();
        document.getElementById('startScreen').style.display = 'none';
        
        // 음악 컨트롤러 표시 확인
        const musicController = document.getElementById('musicController');
        if (musicController) {
            musicController.style.display = 'flex';
        }

        // 랜덤 배경음악은 startGame() 함수에서 호출됨
    }

    setRandomBackground() {
        const officeImages = 10;
        let randomImageNumber;

        do {
            randomImageNumber = Math.floor(Math.random() * officeImages);
        } while (randomImageNumber === this.currentBackgroundIndex);

        this.currentBackgroundIndex = randomImageNumber;
        const gameContainer = document.querySelector('.game-container');
        gameContainer.style.backgroundImage = `url('assets/images/office${randomImageNumber}.png')`;
    }
}
