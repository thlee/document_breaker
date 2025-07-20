// 리더보드 전용 모듈

// 리더보드 로드
async function loadLeaderboard(containerId = 'leaderboardList') {
    try {
        const snapshot = await db.collection('scores')
            .orderBy('score', 'desc')
            .limit(50)
            .get();
        
        const leaderboardList = document.getElementById(containerId);
        leaderboardList.innerHTML = '';
        
        if (snapshot.empty) {
            leaderboardList.innerHTML = `<div class="leaderboard-item"><span>아직 점수가 없습니다</span><span></span></div>`;
            return;
        }
        
        snapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            
            const rank = index + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
            const flag = data.flag || getCountryFlag(data.countryCode) || '🌍';
            const playerName = data.playerName || 'Unknown';
            const score = Number(data.score) || 0;
            
            // 시간 경과 계산
            const timeElapsed = getTimeElapsed(data.timestamp);
            const timeDisplay = timeElapsed ? ` (${timeElapsed})` : '';
            
            item.innerHTML = `
                <div class="player-info">
                    <span>${medal}</span>
                    <span class="country-flag">${flag}</span>
                    <span>${playerName}</span>
                </div>
                <span class="leaderboard-score">${score.toLocaleString()}점${timeDisplay}</span>
            `;
            leaderboardList.appendChild(item);
        });
    } catch (error) {
        console.error('Leaderboard load error:', error);
        document.getElementById(containerId).innerHTML = 
            `<div class="leaderboard-item"><span>랭킹 불러오기 실패</span><span></span></div>`;
    }
}

// 리더보드 제목 업데이트
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

// 시간 경과 계산
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

// 리더보드 자동 업데이트 시작
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
            console.warn('Leaderboard auto-update failed:', error);
        }
    }, 300000); // 300초 = 300000ms
    
    // 즉시 한 번 로드
    loadLeaderboard('leaderboardList').then(() => {
        lastUpdateTime = Date.now();
        updateLeaderboardTitle();
    }).catch(() => {});
}

// 리더보드 자동 업데이트 중지
function stopLeaderboardAutoUpdate() {
    if (leaderboardUpdateInterval) {
        clearInterval(leaderboardUpdateInterval);
        leaderboardUpdateInterval = null;
    }
}


// 페이지 이벤트 리스너 설정
window.addEventListener('beforeunload', () => {
    stopLeaderboardAutoUpdate();
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // 페이지가 백그라운드로 가면 자동 갱신 중지
        stopLeaderboardAutoUpdate();
    } else {
        // 페이지가 다시 보이면 자동 갱신 시작
        startLeaderboardAutoUpdate();
    }
});

// 리더보드 초기화
document.addEventListener('DOMContentLoaded', () => {
    // 초기 로딩 메시지 표시
    const leaderboardList = document.getElementById('leaderboardList');
    if (leaderboardList) {
        leaderboardList.innerHTML = '<div class="leaderboard-item"><span>랭킹 가져오는 중...</span><span></span></div>';
    }
    
    // Firebase 연결 대기 후 시작
    setTimeout(() => {
        startLeaderboardAutoUpdate();
    }, 1000);
});