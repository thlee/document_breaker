// UI 관련 함수들

// 트래픽 제한 관리
class RateLimiter {
    constructor() {
        this.requests = [];
        this.maxRequests = 5;
        this.timeWindow = 60000;
    }
    
    canMakeRequest() {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.timeWindow);
        
        if (this.requests.length < this.maxRequests) {
            this.requests.push(now);
            return true;
        }
        
        return false;
    }
    
    getNextAllowedTime() {
        if (this.requests.length === 0) return 0;
        return this.requests[0] + this.timeWindow;
    }
}

const rateLimiter = new RateLimiter();

// 국가 정보 가져오기
async function getCountryInfo() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        const result = {
            country: data.country_name || 'Unknown',
            countryCode: data.country_code ? data.country_code.toLowerCase() : 'unknown'
        };
        
        return result;
    } catch (error) {
        console.error('Country info fetch failed:', error);
        return { country: 'Unknown', countryCode: 'unknown' };
    }
}

// 국가 깃발 이모지 가져오기
function getCountryFlag(countryCode) {
    const flagMap = {
        'kr': '🇰🇷', 'us': '🇺🇸', 'jp': '🇯🇵', 'cn': '🇨🇳', 'gb': '🇬🇧',
        'de': '🇩🇪', 'fr': '🇫🇷', 'ca': '🇨🇦', 'au': '🇦🇺', 'br': '🇧🇷',
        'in': '🇮🇳', 'it': '🇮🇹', 'es': '🇪🇸', 'mx': '🇲🇽', 'ru': '🇷🇺',
        'se': '🇸🇪', 'no': '🇳🇴', 'dk': '🇩🇰', 'fi': '🇫🇮', 'nl': '🇳🇱',
        'be': '🇧🇪', 'ch': '🇨🇭', 'at': '🇦🇹', 'ie': '🇮🇪', 'pt': '🇵🇹',
        'pl': '🇵🇱', 'cz': '🇨🇿', 'hu': '🇭🇺', 'sk': '🇸🇰', 'ro': '🇷🇴',
        'bg': '🇧🇬', 'hr': '🇭🇷', 'si': '🇸🇮', 'ee': '🇪🇪', 'lv': '🇱🇻',
        'lt': '🇱🇹', 'tr': '🇹🇷', 'gr': '🇬🇷', 'cy': '🇨🇾', 'mt': '🇲🇹',
        'za': '🇿🇦', 'eg': '🇪🇬', 'ma': '🇲🇦', 'ng': '🇳🇬', 'ke': '🇰🇪',
        'th': '🇹🇭', 'vn': '🇻🇳', 'ph': '🇵🇭', 'my': '🇲🇾', 'sg': '🇸🇬',
        'id': '🇮🇩', 'bd': '🇧🇩', 'lk': '🇱🇰', 'mm': '🇲🇲', 'kh': '🇰🇭',
        'la': '🇱🇦', 'mn': '🇲🇳', 'np': '🇳🇵', 'bt': '🇧🇹', 'mv': '🇲🇻',
        'af': '🇦🇫', 'pk': '🇵🇰', 'ir': '🇮🇷', 'iq': '🇮🇶', 'sy': '🇸🇾',
        'jo': '🇯🇴', 'lb': '🇱🇧', 'il': '🇮🇱', 'ps': '🇵🇸', 'sa': '🇸🇦',
        'ae': '🇦🇪', 'kw': '🇰🇼', 'qa': '🇶🇦', 'bh': '🇧🇭', 'om': '🇴🇲',
        'ye': '🇾🇪', 'am': '🇦🇲', 'az': '🇦🇿', 'ge': '🇬🇪', 'kz': '🇰🇿',
        'kg': '🇰🇬', 'tj': '🇹🇯', 'tm': '🇹🇲', 'uz': '🇺🇿', 'by': '🇧🇾',
        'ua': '🇺🇦', 'md': '🇲🇩', 'rs': '🇷🇸', 'me': '🇲🇪', 'ba': '🇧🇦',
        'mk': '🇲🇰', 'al': '🇦🇱', 'xk': '🇽🇰', 'ar': '🇦🇷', 'cl': '🇨🇱',
        'pe': '🇵🇪', 'co': '🇨🇴', 've': '🇻🇪', 'uy': '🇺🇾', 'py': '🇵🇾',
        'bo': '🇧🇴', 'ec': '🇪🇨', 'gf': '🇬🇫', 'sr': '🇸🇷', 'gy': '🇬🇾',
        'fk': '🇫🇰', 'tw': '🇹🇼', 'hk': '🇭🇰', 'mo': '🇲🇴', 'nz': '🇳🇿',
        'fj': '🇫🇯', 'pg': '🇵🇬', 'sb': '🇸🇧', 'vu': '🇻🇺', 'nc': '🇳🇨',
        'pf': '🇵🇫', 'ws': '🇼🇸', 'to': '🇹🇴', 'ki': '🇰🇮', 'nr': '🇳🇷',
        'fm': '🇫🇲', 'mh': '🇲🇭', 'pw': '🇵🇼', 'tv': '🇹🇻', 'ck': '🇨🇰',
        'nu': '🇳🇺', 'pn': '🇵🇳', 'tk': '🇹🇰', 'wf': '🇼🇫', 'as': '🇦🇸',
        'gu': '🇬🇺', 'mp': '🇲🇵', 'pr': '🇵🇷', 'vi': '🇻🇮', 'um': '🇺🇲'
    };
    return flagMap[countryCode] || '🌍';
}

// 점수 저장
async function saveScore(playerName, score) {
    if (!rateLimiter.canMakeRequest()) {
        const nextAllowedTime = rateLimiter.getNextAllowedTime();
        const waitTime = Math.ceil((nextAllowedTime - Date.now()) / 1000);
        throw new Error(`요청 제한: ${waitTime}초 후 다시 시도하세요`);
    }

    try {
        const countryInfo = await getCountryInfo();
        
        const submitScoreFunction = functions.httpsCallable('submitScore');
        
        const scoreData = {
            playerName: playerName,
            score: score,
            country: countryInfo.country,
            countryCode: countryInfo.countryCode,
            flag: getCountryFlag(countryInfo.countryCode),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const result = await submitScoreFunction(scoreData);

        return { success: true, data: result.data };
    } catch (error) {
        console.error('Score save failed:', error);
        throw error;
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
    
    // 팝업 표시
    popup.style.display = 'flex';
    popupPlayerName.focus();
    
    // Enter 키 이벤트 핸들러
    popupPlayerName.onkeypress = function(e) {
        if (e.key === 'Enter') {
            submitScoreFromPopup();
        }
    };
}

// 점수 등록 팝업 닫기
function closeScorePopup() {
    document.getElementById('scorePopup').style.display = 'none';
}

// 익명으로 점수 등록하고 팝업 닫기
async function skipScoreRegistration() {
    const scoreElement = document.getElementById('popupScore');
    const score = scoreElement ? parseInt(scoreElement.getAttribute('data-score')) || 0 : 0;
    
    if (score > 0) {
        try {
            const anonymousName = currentLanguage === 'ko' ? '익명' : 'Anonymous';
            await saveScore(anonymousName, score);
            
            // 익명 등록 후에도 랭킹 갱신
            loadLeaderboard('leaderboardList').then(() => {
                lastUpdateTime = Date.now();
                updateLeaderboardTitle();
            }).catch(() => {});
            
        } catch (error) {
            console.error('Anonymous score save failed:', error);
        }
    }
    
    closeScorePopup();
}

// 팝업에서 점수 제출
async function submitScoreFromPopup() {
    const playerNameElement = document.getElementById('popupPlayerName');
    const submitBtn = document.getElementById('popupSubmitBtn');
    const statusMsg = document.getElementById('popupStatus');
    const scoreElement = document.getElementById('popupScore');
    
    const playerName = playerNameElement ? playerNameElement.value : '';
    const score = scoreElement ? parseInt(scoreElement.getAttribute('data-score')) || 0 : 0;
    
    if (!playerName || playerName.trim() === '') {
        statusMsg.textContent = t('enterPlayerName');
        statusMsg.style.color = '#f44336';
        return;
    }
    
    submitBtn.disabled = true;
    statusMsg.textContent = t('savingScore');
    statusMsg.style.color = '#FFD700';
    
    try {
        const saveResult = await saveScore(playerName, score);
        
        if (saveResult.success) {
            statusMsg.textContent = t('scoreSaved');
            statusMsg.style.color = '#4CAF50';
            
            setTimeout(() => {
                closeScorePopup();
                
                loadLeaderboard('leaderboardList').then(() => {
                    lastUpdateTime = Date.now();
                    updateLeaderboardTitle();
                }).catch(() => {});
                
            }, 1500);
        } else {
            throw new Error(saveResult.error || t('saveFailed'));
        }
    } catch (error) {
        console.error('Score save failed:', error);
        statusMsg.textContent = error.message || t('saveFailed');
        statusMsg.style.color = '#f44336';
        submitBtn.disabled = false;
    }
}

// 언어 로드
async function loadLanguage(langCode) {
    try {
        const response = await fetch(`lang/${langCode}.json`);
        if (!response.ok) {
            console.warn(`Language file load failed: ${langCode}.json`);
            return false;
        }
        translations = await response.json();
        currentLanguage = langCode;
        updateUITexts();
        return true;
    } catch (error) {
        console.error('Language load failed:', error);
        return false;
    }
}

// 번역 함수
function t(key, ...args) {
    let text = translations[key] || key;
    args.forEach((arg, index) => {
        text = text.replace(`{${index}}`, arg);
    });
    return text;
}

// UI 텍스트 업데이트
function updateUITexts() {
    // 게임 제목 및 설명
    const gameTitle = document.getElementById('gameTitle');
    if (gameTitle) gameTitle.textContent = t('gameTitle');
    
    // 팁 설명
    const gameTipsDesc = document.getElementById('gameTipsDesc');
    if (gameTipsDesc) {
        gameTipsDesc.innerHTML = t('gameTipsDesc');
    }
    
    // 리더보드 제목
    const leaderboardTitle = document.getElementById('leaderboardTitle');
    if (leaderboardTitle) leaderboardTitle.textContent = t('leaderboardTitle');
    
    // 기타 UI 요소들 업데이트
    const startButton = document.querySelector('.start-button');
    if (startButton) startButton.textContent = t('startGame');
    
    const restartButton = document.querySelector('.restart-button');
    if (restartButton) restartButton.textContent = t('restartGame');
}