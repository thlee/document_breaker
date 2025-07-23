// Chat.js - 채팅 시스템 관리
class ChatSystem {
    constructor() {
        this.unsubscribeListener = null;
        this.messageCache = new Map(); // 메시지 ID로 중복 방지
        this.isPolling = false; // 폴링 상태
        this.pollInterval = null;
        
        // 메시지 전송 속도 제한 (0.5초당 1개)
        this.lastSendTime = 0;
        this.SEND_COOLDOWN = 30000; // 30 seconds
        this.cooldownTimer = null;

        // 새로고침 속도 제한
        this.lastRefreshTime = 0;
        this.REFRESH_COOLDOWN = 30000; // 30 seconds
        this.refreshCooldownTimer = null;
        
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
    
    // Functions 기반 메시지 조회
    async fetchMessages(startAfterTimestamp = null, limit = 10) {
        try {
            // Firebase Functions 호출
            const getChatMessages = functions.httpsCallable('getChatMessages');
            const result = await getChatMessages({
                startAfterTimestamp: startAfterTimestamp,
                limit: limit
            });

            const { messages, hasMore } = result.data;
            
            if (messages.length > 0) {
                // 메시지를 시간순으로 정렬 (서버에서 내림차순으로 오므로)
                messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                this.prependMessages(messages); // prependMessages 함수를 새로 만들 예정
            }
            return { messages, hasMore };
        } catch (error) {
            console.error('메시지 조회 실패:', error);
            this.showToast('메시지 조회에 실패했습니다.');
            return { messages: [], hasMore: false };
        }
    }

    // 메시지 삭제 함수
    async deleteMessage(messageId) {
        try {
            const deleteChatMessage = functions.httpsCallable('deleteChatMessage');
            const result = await deleteChatMessage({ messageId: messageId });
            if (result.data.success) {
                if (result.data.deleted) {
                    this.showToast('메시지가 삭제되었습니다.');
                    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
                    if (messageElement) {
                        messageElement.remove();
                    }
                } else {
                    this.showToast(result.data.message);
                    // 투표 수 업데이트
                    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
                    if (messageElement) {
                        const deleteButton = messageElement.querySelector('.delete-button');
                        if (deleteButton) {
                            deleteButton.textContent = `❌ ${3 - result.data.currentVotes}`;
                        }
                    }
                }
            } else {
                this.showToast('메시지 삭제에 실패했습니다: ' + result.data.message);
            }
        } catch (error) {
            console.error('메시지 삭제 실패:', error);
            this.showToast('메시지 삭제에 실패했습니다.');
        }
    }

    // 게시판 새로고침
    async refreshBoard() {
        const now = Date.now();
        if (now - this.lastRefreshTime < this.REFRESH_COOLDOWN) {
            const timeLeft = Math.ceil((this.REFRESH_COOLDOWN - (now - this.lastRefreshTime)) / 1000);
            this.showToast(`새로고침은 ${timeLeft}초 후에 가능합니다.`);
            return;
        }

        this.lastRefreshTime = now;
        this.showToast('게시판 새로고침 중...');
        this.chatMessages.innerHTML = ''; // 기존 메시지 지우기
        this.messageCache.clear(); // 캐시 비우기
        this.allMessagesLoaded = false; // 모든 메시지 로드 상태 초기화
        this.isLoadingMoreMessages = false; // 로딩 상태 초기화

        const initialLoadResult = await this.fetchMessages(null, 10); // 초기 10개 메시지 다시 로드
        this.displayMessages(initialLoadResult.messages);
        this.updateRefreshButtonUI();
    }

    // 새로고침 버튼 UI 업데이트
    updateRefreshButtonUI() {
        const refreshButton = document.getElementById('refreshChatButton');
        if (!refreshButton) return;

        const now = Date.now();
        const timeLeft = this.REFRESH_COOLDOWN - (now - this.lastRefreshTime);

        if (timeLeft > 0) {
            refreshButton.disabled = true;
            refreshButton.textContent = `새로고침 (${Math.ceil(timeLeft / 1000)}s)`;
            if (this.refreshCooldownTimer) {
                clearTimeout(this.refreshCooldownTimer);
            }
            this.refreshCooldownTimer = setTimeout(() => {
                refreshButton.disabled = false;
                refreshButton.textContent = '새로고침';
            }, timeLeft);
        } else {
            refreshButton.disabled = false;
            refreshButton.textContent = '새로고침';
        }
    }
    
    
    
    
    
    // 새 메시지 추가 (기존 메시지에 prepend)
    prependMessages(newMessages) {
        const isScrolledToTop = this.chatMessages.scrollTop === 0;
        const oldScrollHeight = this.chatMessages.scrollHeight;

        newMessages.forEach(msg => {
            if (!this.messageCache.has(msg.id)) {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'chat-message';
                messageDiv.dataset.messageId = msg.id; // 메시지 ID 저장
                
                const deleteButtonHtml = `<button class="delete-button" data-message-id="${msg.id}">❌ ${3 - msg.deleteVotes}</button>`;
                messageDiv.innerHTML = `
                    ${deleteButtonHtml} <span class="username">(${msg.username})</span> ${msg.message}
                    <span class="timestamp">${new Date(msg.timestamp).toLocaleDateString('ko-KR')} ${new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                `;
                
                this.chatMessages.prepend(messageDiv);
                this.messageCache.set(msg.id, msg);
            }
        });

        // 스크롤 위치 유지
        if (!isScrolledToTop) {
            this.chatMessages.scrollTop += (this.chatMessages.scrollHeight - oldScrollHeight);
        }

        // 메시지 개수 제한 (클라이언트 측에서만, 100개 초과 시 가장 오래된 메시지 제거)
        while (this.chatMessages.children.length > 100) {
            const lastChild = this.chatMessages.lastChild;
            if (lastChild) {
                this.messageCache.delete(lastChild.dataset.messageId);
                lastChild.remove();
            }
        }
    }
    
    // 메시지 표시 (초기 로드용)
    displayMessages(messages) {
        this.chatMessages.innerHTML = '';
        this.messageCache.clear();
        messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message';
            messageDiv.dataset.messageId = msg.id; // 메시지 ID 저장
            
            const deleteButtonHtml = `<button class="delete-button" data-message-id="${msg.id}">❌ ${3 - msg.deleteVotes}</button>`;
            messageDiv.innerHTML = `
                ${deleteButtonHtml} <span class="username">(${msg.username})</span> ${msg.message}
                <span class="timestamp">${new Date(msg.timestamp).toLocaleDateString('ko-KR')} ${new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
            `;
            
            this.chatMessages.appendChild(messageDiv);
            this.messageCache.set(msg.id, msg);
        });
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
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
    
    
    
    
    
    // 이벤트 리스너 설정
    setupEventListeners() {
        // 전송 버튼 클릭
        this.sendButton.addEventListener('click', async () => {
            if (!this.sendButton.disabled) {
                await this.sendMessage();
            }
        });
        
        // 엔터 키 전송
        this.chatInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!this.sendButton.disabled) {
                    await this.sendMessage();
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
    
    // 채팅 시스템 초기화
    async initializeChatSystem() {
        try {
            // 1. 이모티콘 패널 초기화
            this.addEmojiSupport();

            // 2. 초기 메시지 로드 (최신 10개)
            const initialLoadResult = await this.fetchMessages(null, 10);
            this.displayMessages(initialLoadResult.messages);

            // 3. 스크롤 이벤트 리스너 추가
            this.chatMessages.addEventListener('scroll', this.handleScroll.bind(this));

            // 4. 메시지 삭제 버튼 이벤트 위임
            this.chatMessages.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-button')) {
                    const messageId = e.target.dataset.messageId;
                    if (confirm('정말로 이 메시지를 삭제하시겠습니까?')) {
                        this.deleteMessage(messageId);
                    }
                }
            });

            // 5. 새로고침 버튼 이벤트 연결
            const refreshButton = document.getElementById('refreshChatButton');
            if (refreshButton) {
                refreshButton.addEventListener('click', () => this.refreshBoard());
                this.updateRefreshButtonUI(); // 초기 UI 업데이트
            }
            
            console.log('🚀 게시판 시스템 초기화 완료!');
            
        } catch (error) {
            console.error('채팅 시스템 초기화 실패:', error);
        }
    }

    // 스크롤 이벤트 핸들러
    async handleScroll() {
        // 스크롤이 맨 위로 올라갔을 때
        if (this.chatMessages.scrollTop === 0) {
            // 이미 모든 메시지를 로드했거나, 로드 중이면 중복 호출 방지
            if (this.allMessagesLoaded || this.isLoadingMoreMessages) {
                return;
            }

            this.isLoadingMoreMessages = true;
            this.showToast('이전 메시지 로드 중...');

            const firstMessage = this.chatMessages.querySelector('.chat-message');
            const startAfterTimestamp = firstMessage ? new Date(this.messageCache.get(firstMessage.dataset.messageId).timestamp).toISOString() : null;

            const result = await this.fetchMessages(startAfterTimestamp, 10); // 10개씩 추가 로드
            if (result.messages.length === 0) {
                this.allMessagesLoaded = true;
                this.showToast('더 이상 이전 메시지가 없습니다.');
            }
            this.isLoadingMoreMessages = false;
        }
    }
}

// 전역 함수로 채팅 초기화 제공 (기존 코드와 호환성)
function initializeChat() {
    window.chatSystem = new ChatSystem();
}