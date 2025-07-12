// Firebase 설정 및 초기화
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

// 트래픽 제한 관리
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

const rateLimiter = new RateLimiter();

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

// 점수 저장 함수 (saveScore)
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
            leaderboardList.innerHTML = '<div class="leaderboard-item"><span>No rankings yet</span><span></span></div>';
            return;
        }
        
        snapshot.forEach((doc, index) => {
            const data = doc.data();
            const rank = index + 1;
            
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            
            // 순위에 따른 메달 표시
            let rankDisplay = rank;
            if (rank === 1) rankDisplay = '🥇';
            else if (rank === 2) rankDisplay = '🥈';
            else if (rank === 3) rankDisplay = '🥉';
            
            // 플레이어명 길이 제한 (표시용)
            let displayName = data.playerName || 'Anonymous';
            if (displayName.length > 10) {
                displayName = displayName.substring(0, 10) + '...';
            }
            
            // 국기와 함께 표시
            const flag = data.flag || '🌍';
            
            item.innerHTML = `
                <span>${rankDisplay} ${flag} ${displayName}</span>
                <span>${data.score || 0}</span>
            `;
            
            leaderboardList.appendChild(item);
        });
        
    } catch (error) {
        console.error('랭킹 로드 실패:', error);
        const leaderboardList = document.getElementById(containerId);
        leaderboardList.innerHTML = '<div class="leaderboard-item"><span>Failed to load rankings</span><span></span></div>';
    }
}

// 채팅 메시지 전송 함수
async function sendChatMessage(username, message) {
    try {
        // Firebase Functions 사용 (더 안전함)
        if (typeof functions !== 'undefined') {
            const sendChatMessage = functions.httpsCallable('sendChatMessage');
            await sendChatMessage({
                username: username,
                message: message
            });
        } else {
            // Functions 없을 때 직접 Firestore 사용 (덜 안전함)
            const chatData = {
                username: username,
                message: message,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            await db.collection('chat').add(chatData);
        }
        return true;
    } catch (error) {
        console.error('채팅 전송 실패:', error);
        throw error;
    }
}

// 채팅 메시지 조회 함수 (Functions 기반)
async function getChatMessages(lastSyncTime, limit = 50) {
    try {
        // Firebase Functions 호출
        const getChatMessages = functions.httpsCallable('getChatMessages');
        const result = await getChatMessages({
            lastSyncTime: lastSyncTime,
            limit: limit
        });
        
        return result.data;
    } catch (error) {
        console.error('메시지 조회 실패:', error);
        throw error;
    }
}

// 채팅 메시지 조회 폴백 함수 (직접 Firestore 조회)
async function getChatMessagesFallback(lastSyncTimestamp) {
    try {
        const syncDate = new Date(lastSyncTimestamp);
        const snapshot = await db.collection('chat')
            .where('timestamp', '>', firebase.firestore.Timestamp.fromDate(syncDate))
            .orderBy('timestamp', 'asc')
            .limit(50)
            .get();
        
        const messages = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.timestamp) {
                messages.push({
                    id: doc.id,
                    username: data.username,
                    message: data.message,
                    timestamp: data.timestamp.toDate()
                });
            }
        });
        
        return messages;
    } catch (error) {
        console.error('폴백 조회 실패:', error);
        throw error;
    }
}

// Firebase 관련 유틸리티 함수들 내보내기 (전역 스코프에서 사용 가능하도록)
window.Firebase = {
    // 데이터베이스 참조
    db,
    functions,
    
    // 핵심 함수들
    getCountryInfo,
    saveScore,
    loadLeaderboard,
    
    // 채팅 관련 함수들
    sendChatMessage,
    getChatMessages,
    getChatMessagesFallback,
    
    // 유틸리티 함수들
    getCountryFlag,
    rateLimiter
};