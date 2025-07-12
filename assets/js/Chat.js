// Chat.js - 채팅 시스템 관리
class ChatSystem {
    constructor() {
        this.unsubscribeListener = null;
        this.lastSyncTimestamp = new Date().toISOString(); // 현재 시간으로 시작
        this.messageCache = new Map(); // 메시지 ID로 중복 방지
        this.isPolling = false; // 폴링 상태
        this.pollInterval = null;
        
        // 메시지 전송 속도 제한 (0.5초당 1개)
        this.lastSendTime = 0;
        this.SEND_COOLDOWN = 500; // 500ms
        this.cooldownTimer = null;
        
        // DOM 요소들
        this.chatInput = null;
        this.usernameInput = null;
        this.sendButton = null;
        this.chatMessages = null;
        
        this.init();
    }
    
    // 채팅 시스템 초기화
    init() {
        this.chatInput = document.getElementById('chatInput');
        this.usernameInput = document.getElementById('chatUsername');
        this.sendButton = document.getElementById('sendChatButton');
        this.chatMessages = document.getElementById('chatMessages');
        
        this.setupEventListeners();
        this.initializeChatSystem();
    }
    
    // 전송 가능 여부 확인
    canSendMessage() {
        const now = Date.now();
        return now - this.lastSendTime >= this.SEND_COOLDOWN;
    }
    
    // 쿨다운 타이머 업데이트
    updateCooldownUI() {
        const now = Date.now();
        const timeLeft = this.SEND_COOLDOWN - (now - this.lastSendTime);
        
        if (timeLeft > 0) {
            this.sendButton.disabled = true;
            this.sendButton.classList.add('cooldown');
            this.sendButton.textContent = `전송 (${Math.ceil(timeLeft / 100) / 10}s)`;
            
            if (this.cooldownTimer) {
                clearTimeout(this.cooldownTimer);
            }
            
            this.cooldownTimer = setTimeout(() => {
                this.sendButton.classList.remove('cooldown');
                this.sendButton.disabled = false;
                this.sendButton.textContent = '전송';
                this.updateSendButtonState(); // 다른 조건들도 확인
            }, timeLeft);
        } else {
            this.sendButton.classList.remove('cooldown');
            this.sendButton.disabled = false;
            this.sendButton.textContent = '전송';
        }
    }
    
    // 전송 버튼 상태 업데이트 (모든 조건 확인)
    updateSendButtonState() {
        const message = this.chatInput.value; // trim() 제거
        const trimmedMessage = message.trim(); // 별도로 체크용
        const canSend = this.canSendMessage();
        const hasContent = trimmedMessage.length > 0 && message.length <= 200;
        
        this.sendButton.disabled = !canSend || !hasContent;
        
        if (!canSend) {
            this.updateCooldownUI();
        } else if (!hasContent) {
            this.sendButton.textContent = '전송';
        } else {
            this.sendButton.textContent = '전송';
        }
    }
    
    // 채팅 메시지 전송
    async sendMessage() {
        const message = this.chatInput.value.trim();
        const username = this.usernameInput.value.trim() || '익명';
        
        if (!message) return;
        
        // 속도 제한 확인
        if (!this.canSendMessage()) {
            this.showToast('너무 빨리 메시지를 보내고 있습니다. 잠시 후 다시 시도해주세요.');
            return;
        }
        
        try {
            // 전송 시간 기록
            this.lastSendTime = Date.now();
            
            // UI 즉시 업데이트
            this.updateCooldownUI();
            
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
            
            this.chatInput.value = '';
            
            // 문자 카운터 초기화
            const charCounter = document.getElementById('charCounter');
            charCounter.textContent = '200/200';
            charCounter.className = 'char-counter';
            
        } catch (error) {
            console.error('채팅 전송 실패:', error);
            
            // 서버에서 속도 제한된 경우
            if (error.code === 'functions/resource-exhausted') {
                this.showToast(error.message);
            } else {
                this.showToast('메시지 전송에 실패했습니다. 다시 시도해주세요.');
            }
            
            // 전송 실패 시 쿨다운 해제
            this.lastSendTime = 0;
            this.updateSendButtonState();
        }
    }
    
    // Functions 기반 증분 메시지 조회
    async fetchNewMessages() {
        try {
            if (this.isPolling) return; // 이미 조회 중이면 무시
            this.isPolling = true;

            // Firebase Functions 호출
            const getChatMessages = functions.httpsCallable('getChatMessages');
            const result = await getChatMessages({
                lastSyncTime: this.lastSyncTimestamp,
                limit: 50
            });

            const { messages, serverTime, count } = result.data;
            
            if (count > 0) {
                const newMessages = [];
                
                messages.forEach(msgData => {
                    if (!this.messageCache.has(msgData.id)) {
                        const message = {
                            id: msgData.id,
                            username: msgData.username,
                            message: this.filterMessage(msgData.message),
                            timestamp: new Date(msgData.timestamp)
                        };
                        newMessages.push(message);
                        this.messageCache.set(msgData.id, message);
                    }
                });
                
                if (newMessages.length > 0) {
                    // 새 메시지 추가
                    this.addNewMessages(newMessages);
                    
                    // 새 메시지 알림 (본인이 보낸 메시지가 아닌 경우)
                    const recentMessage = newMessages[newMessages.length - 1];
                    const isOwnMessage = Date.now() - recentMessage.timestamp.getTime() < 3000;
                    if (!isOwnMessage) {
                        this.playNotificationSound();
                    }
                    
                    console.log('새 메시지:', newMessages.length, '개 추가됨');
                }
                
                // 마지막 메시지의 타임스탬프로 동기화 시간 업데이트
                if (messages.length > 0) {
                    this.lastSyncTimestamp = messages[messages.length - 1].timestamp;
                }
            } else {
                // 새 메시지가 없어도 서버 시간으로 동기화 시간 업데이트
                this.lastSyncTimestamp = serverTime;
            }
            
        } catch (error) {
            console.error('메시지 조회 실패:', error);
            
            // Functions가 없는 경우 폴백 (직접 Firestore 조회)
            if (error.code === 'functions/not-found') {
                console.log('Functions 없음, 직접 조회로 폴백');
                await this.fallbackDirectQuery();
            }
        } finally {
            this.isPolling = false;
        }
    }
    
    // Functions가 없는 경우 폴백 함수
    async fallbackDirectQuery() {
        try {
            const syncDate = new Date(this.lastSyncTimestamp);
            const snapshot = await db.collection('chat')
                .where('timestamp', '>', firebase.firestore.Timestamp.fromDate(syncDate))
                .orderBy('timestamp', 'asc')
                .limit(50)
                .get();
            
            const newMessages = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.timestamp && !this.messageCache.has(doc.id)) {
                    const message = {
                        id: doc.id,
                        username: data.username,
                        message: this.filterMessage(data.message),
                        timestamp: data.timestamp.toDate()
                    };
                    newMessages.push(message);
                    this.messageCache.set(doc.id, message);
                }
            });
            
            if (newMessages.length > 0) {
                this.addNewMessages(newMessages);
                this.lastSyncTimestamp = newMessages[newMessages.length - 1].timestamp.toISOString();
                console.log('폴백 조회:', newMessages.length, '개 메시지');
            } else {
                this.lastSyncTimestamp = new Date().toISOString();
            }
            
        } catch (error) {
            console.error('폴백 조회 실패:', error);
        }
    }
    
    // 폴링 기반 실시간 업데이트 시작
    startPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        
        // 즉시 한 번 실행
        this.fetchNewMessages();
        
        // 2초마다 새 메시지 확인
        this.pollInterval = setInterval(() => {
            this.fetchNewMessages();
        }, 2000);
        
        console.log('폴링 기반 실시간 업데이트 시작 (2초 간격)');
    }
    
    // 폴링 중지
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        console.log('폴링 중지됨');
    }
    
    // 새 메시지 추가 (기존 메시지에 append)
    addNewMessages(newMessages) {
        // 시간순으로 정렬
        newMessages.sort((a, b) => a.timestamp - b.timestamp);
        
        newMessages.forEach(msg => {
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
            
            this.chatMessages.appendChild(messageDiv);
        });
        
        // 메시지 개수 제한 (클라이언트 측에서만)
        const messageElements = this.chatMessages.children;
        while (messageElements.length > 50) {
            const oldestMessage = messageElements[0];
            const messageId = [...this.messageCache.entries()]
                .find(([id, msg]) => {
                    const time = msg.timestamp.toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    return oldestMessage.innerHTML.includes(time) && 
                           oldestMessage.innerHTML.includes(msg.username) &&
                           oldestMessage.innerHTML.includes(msg.message);
                })?.[0];
            
            if (messageId) {
                this.messageCache.delete(messageId);
            }
            oldestMessage.remove();
        }
        
        // 스크롤을 맨 아래로
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    // 메시지 표시
    displayMessages(messages) {
        this.chatMessages.innerHTML = '';
        
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
            
            this.chatMessages.appendChild(messageDiv);
        });
        
        // 스크롤을 맨 아래로
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    // 메시지 개수 확인 및 알림
    async checkMessageCount() {
        try {
            const snapshot = await db.collection('chat').get();
            if (snapshot.size > 50) {
                console.log(`현재 ${snapshot.size}개의 메시지가 있습니다. 자동 정리가 필요합니다.`);
            }
        } catch (error) {
            console.error('메시지 개수 확인 실패:', error);
        }
    }
    
    // 메시지 필터링 (욕설, 스팸 방지)
    filterMessage(message) {
        // 기본적인 필터링 - 필요에 따라 확장 가능
        const bannedWords = ['욕설1', '욕설2']; // 실제 운영시 적절한 필터링 단어 추가
        let filtered = message;
        
        bannedWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            filtered = filtered.replace(regex, '*'.repeat(word.length));
        });
        
        return filtered;
    }
    
    // 이모티콘 지원
    addEmojiSupport() {
        try {
            const emojiPanel = document.createElement('div');
            emojiPanel.className = 'emoji-panel';
            emojiPanel.style.display = 'none';
            emojiPanel.innerHTML = `
                <div style="display: flex; flex-wrap: wrap; gap: 5px; padding: 10px; background: rgba(0,0,0,0.8); border: 1px solid #555; border-radius: 5px; max-width: 300px;">
                    <span class="emoji-btn">😊</span><span class="emoji-btn">😂</span><span class="emoji-btn">😭</span><span class="emoji-btn">😡</span>
                    <span class="emoji-btn">👍</span><span class="emoji-btn">👎</span><span class="emoji-btn">❤️</span><span class="emoji-btn">💔</span>
                    <span class="emoji-btn">🔥</span><span class="emoji-btn">💯</span><span class="emoji-btn">✨</span><span class="emoji-btn">💪</span>
                    <span class="emoji-btn">🎉</span><span class="emoji-btn">🎮</span><span class="emoji-btn">📄</span><span class="emoji-btn">💼</span>
                </div>
            `;
            
            const chatInputSection = document.querySelector('.chat-input-section');
            if (!chatInputSection) {
                console.error('채팅 입력 섹션을 찾을 수 없습니다.');
                return;
            }
            chatInputSection.appendChild(emojiPanel);
            
            // 이모티콘 버튼 추가
            const emojiButton = document.createElement('button');
            emojiButton.innerHTML = '😊';
            emojiButton.id = 'emojiButton';
            emojiButton.style.cssText = `
                background: rgba(255,255,255,0.1);
                border: 1px solid #555;
                border-radius: 5px;
                color: white;
                padding: 8px;
                cursor: pointer;
                font-size: 16px;
                margin-right: 8px;
            `;
            
            const chatControls = document.querySelector('.chat-controls');
            const sendBtn = document.getElementById('sendChatButton');
            if (!chatControls || !sendBtn) {
                console.error('채팅 컨트롤을 찾을 수 없습니다.');
                return;
            }
            chatControls.insertBefore(emojiButton, sendBtn);
            
            // 이벤트 리스너
            emojiButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                emojiPanel.style.display = emojiPanel.style.display === 'none' ? 'block' : 'none';
                console.log('이모티콘 버튼 클릭됨');
            });
            
            emojiPanel.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.target.classList.contains('emoji-btn')) {
                    const inputElement = document.getElementById('chatInput');
                    if (inputElement) {
                        inputElement.value += e.target.textContent;
                        emojiPanel.style.display = 'none';
                        inputElement.focus();
                        // 글자 수 카운터 업데이트
                        this.updateSendButtonState();
                        console.log('이모티콘 추가됨:', e.target.textContent);
                    }
                }
            });
            
            // 외부 클릭시 패널 닫기
            document.addEventListener('click', (e) => {
                if (!emojiButton.contains(e.target) && !emojiPanel.contains(e.target)) {
                    emojiPanel.style.display = 'none';
                }
            });
            
            console.log('이모티콘 지원 초기화 완료');
        } catch (error) {
            console.error('이모티콘 지원 초기화 실패:', error);
        }
    }
    
    // 새 메시지 알림음
    playNotificationSound() {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+XsymUdBjiS2/LNeSsFJHfH8N2QQAoUXrTp66hVFA==');
            audio.volume = 0.1;
            audio.play().catch(() => {}); // 오류 무시
        } catch (error) {
            // 알림음 재생 실패시 무시
        }
    }
    
    // 토스트 알림 표시
    showToast(message) {
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
    
    // 연결 상태 체크 (폴링 기반)
    checkConnection() {
        // 5분 이상 동기화가 안 됐으면 강제 조회
        const syncDate = new Date(this.lastSyncTimestamp);
        if (Date.now() - syncDate.getTime() > 5 * 60 * 1000) {
            console.log('장시간 동기화 안됨, 강제 조회 수행');
            this.fetchNewMessages();
        }
    }
    
    // 수동 동기화 함수
    async forceSync() {
        try {
            console.log('강제 동기화 시작...');
            await this.fetchNewMessages();
            console.log('강제 동기화 완료');
        } catch (error) {
            console.error('강제 동기화 실패:', error);
        }
    }
    
    // 이벤트 리스너 설정
    setupEventListeners() {
        // 전송 버튼 클릭
        this.sendButton.addEventListener('click', async () => {
            if (!this.sendButton.disabled) {
                await this.sendMessage();
                await this.checkMessageCount();
            }
        });
        
        // 엔터 키 전송
        this.chatInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!this.sendButton.disabled) {
                    await this.sendMessage();
                    await this.checkMessageCount();
                }
            }
        });
        
        // 문자 수 제한 표시
        const charCounter = document.getElementById('charCounter');
        this.chatInput.addEventListener('input', () => {
            const remaining = 200 - this.chatInput.value.length;
            charCounter.textContent = `${remaining}/200`;
            
            // 색상 변경
            charCounter.className = 'char-counter';
            if (remaining < 20) {
                this.chatInput.style.borderColor = remaining < 0 ? '#f44336' : '#ff9800';
                charCounter.classList.add(remaining < 0 ? 'danger' : 'warning');
            } else {
                this.chatInput.style.borderColor = '#555';
            }
            
            // 전송 버튼 상태 업데이트 (쿨다운 포함)
            this.updateSendButtonState();
        });
        
        // 페이지 언로드 시 폴링 정리
        window.addEventListener('beforeunload', () => {
            this.stopPolling();
            if (this.unsubscribeListener) {
                this.unsubscribeListener();
            }
        });
    }
    
    // 채팅 시스템 초기화 (완전 증분 방식)
    async initializeChatSystem() {
        try {
            // 1. 현재 시간 기준으로 시작 (과거 메시지 없음)
            console.log('채팅 시작 시간:', this.lastSyncTimestamp);
            
            // 2. 이모티콘 패널 초기화
            this.addEmojiSupport();
            
            // 3. 폴링 기반 실시간 업데이트 시작
            this.startPolling();
            
            // 4. 주기적 연결 상태 체크 (1분마다)
            setInterval(() => this.checkConnection(), 60000);
            
            // 5. 디버깅을 위한 단축키
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'r') {
                    e.preventDefault();
                    this.forceSync();
                } else if (e.ctrlKey && e.key === 'p') {
                    e.preventDefault();
                    if (this.pollInterval) {
                        this.stopPolling();
                    } else {
                        this.startPolling();
                    }
                }
            });
            
            // 6. 페이지 가시성 변경시 폴링 제어 (배터리 절약)
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.stopPolling();
                    console.log('페이지 숨김 - 폴링 중지');
                } else {
                    this.startPolling();
                    console.log('페이지 표시 - 폴링 재시작');
                }
            });
            
            console.log('🚀 순수 증분 채팅 시스템 초기화 완료!');
            console.log('📊 데이터 절약 모드:');
            console.log('  - 과거 메시지 로드 없음');
            console.log('  - 현재 시점 이후 메시지만 받기');
            console.log('  - 2초마다 새 메시지 확인');
            console.log('🔧 단축키:');
            console.log('  - Ctrl+R: 수동 동기화');
            console.log('  - Ctrl+P: 폴링 시작/중지');
            
        } catch (error) {
            console.error('채팅 시스템 초기화 실패:', error);
        }
    }
}

// 전역 함수로 채팅 초기화 제공 (기존 코드와 호환성)
function initializeChat() {
    window.chatSystem = new ChatSystem();
}