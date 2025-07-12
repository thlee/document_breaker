// UI 관련 함수들을 모아놓은 모듈

// 음소거 토글 함수
function toggleMute() {
    isMuted = !isMuted;
    const backgroundMusic = document.getElementById('backgroundMusic');
    const muteButton = document.getElementById('muteButton');
    
    // 모든 오디오 요소들을 음소거 처리
    backgroundMusic.muted = isMuted;
    if (bossAppearSound0) bossAppearSound0.muted = isMuted;
    if (bossAppearSound1) bossAppearSound1.muted = isMuted;
    if (newbieAppearSound0) newbieAppearSound0.muted = isMuted;
    if (newbieAppearSound1) newbieAppearSound1.muted = isMuted;
    if (goodByeSound) goodByeSound.muted = isMuted;
    if (explosionSound) explosionSound.muted = isMuted;
    if (gunSound) gunSound.muted = isMuted;
    if (gunModeLoopSound) gunModeLoopSound.muted = isMuted;
    if (goodJobSound) goodJobSound.muted = isMuted;
    if (ohNoSound) ohNoSound.muted = isMuted;
    if (alarmSound) alarmSound.muted = isMuted;
    
    muteButton.textContent = isMuted ? '🔇' : '🔊';
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

// 채팅 UI 관련 함수들
// 쿨다운 타이머 업데이트
function updateCooldownUI() {
    const now = Date.now();
    const timeLeft = SEND_COOLDOWN - (now - lastSendTime);
    
    if (timeLeft > 0) {
        sendButton.disabled = true;
        sendButton.classList.add('cooldown');
        sendButton.textContent = `전송 (${Math.ceil(timeLeft / 100) / 10}s)`;
        
        if (cooldownTimer) {
            clearTimeout(cooldownTimer);
        }
        
        cooldownTimer = setTimeout(() => {
            sendButton.classList.remove('cooldown');
            sendButton.disabled = false;
            sendButton.textContent = '전송';
            updateSendButtonState(); // 다른 조건들도 확인
        }, timeLeft);
    } else {
        sendButton.classList.remove('cooldown');
        sendButton.disabled = false;
        sendButton.textContent = '전송';
    }
}

// 전송 버튼 상태 업데이트 (모든 조건 확인)
function updateSendButtonState() {
    const message = chatInput.value; // trim() 제거
    const trimmedMessage = message.trim(); // 별도로 체크용
    const canSend = canSendMessage();
    const hasContent = trimmedMessage.length > 0 && message.length <= 200;
    
    sendButton.disabled = !canSend || !hasContent;
    
    if (!canSend) {
        updateCooldownUI();
    } else if (!hasContent) {
        sendButton.textContent = '전송';
    } else {
        sendButton.textContent = '전송';
    }
}

// 메시지 표시
function displayMessages(messages) {
    chatMessages.innerHTML = '';
    
    messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        
        const time = msg.timestamp.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        messageDiv.innerHTML = `
            <span class="username">(${msg.username})</span> ${msg.message}
            <span class="timestamp">${time}</span>
        `;
        
        chatMessages.appendChild(messageDiv);
    });
    
    // 스크롤을 맨 아래로
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 알림음 재생
function playNotificationSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFA==');
        audio.volume = 0.1;
        audio.play().catch(() => {}); // 오류 무시
    } catch (error) {
        // 알림음 재생 실패시 무시
    }
}

// 토스트 알림 표시
function showToast(message) {
    // 기존 토스트 제거
    const existingToast = document.querySelector('.chat-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'chat-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: fadeInOut 2s ease-in-out;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 2000);
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
        'SK': '🇸🇰', 'SI': '🇸🇮', 'HR': '🇭🇷', 'RS': '🇷🇸', 'BA': '🇧🇦',
        'BG': '🇧🇬', 'RO': '🇷🇴', 'GR': '🇬🇷', 'TR': '🇹🇷', 'IL': '🇮🇱',
        'AE': '🇦🇪', 'SA': '🇸🇦', 'EG': '🇪🇬', 'ZA': '🇿🇦', 'NG': '🇳🇬',
        'KE': '🇰🇪', 'AR': '🇦🇷', 'CL': '🇨🇱', 'PE': '🇵🇪', 'CO': '🇨🇴',
        'VE': '🇻🇪', 'UY': '🇺🇾', 'EC': '🇪🇨', 'BO': '🇧🇴', 'PY': '🇵🇾',
        'NZ': '🇳🇿', 'FJ': '🇫🇯', 'NC': '🇳🇨', 'PF': '🇵🇫'
    };
    
    return flagMap[countryCode] || '🌍';
}

// 시간 경과 표시 함수
function getTimeElapsed(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}일 전`;
    if (hours > 0) return `${hours}시간 전`;
    if (minutes > 0) return `${minutes}분 전`;
    return `${seconds}초 전`;
}