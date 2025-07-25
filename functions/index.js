const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

// 글로벌 옵션으로 지역 설정
setGlobalOptions({ region: 'asia-northeast1' });

admin.initializeApp();
const db = admin.firestore();

// 사용자별 속도 제한 추적 (메모리 기반)
const rateLimits = new Map();

// 토큰 기반 검증 시스템
const validationTokens = new Map();

// 주기적으로 오래된 제한 데이터 정리 (10분마다)
setInterval(() => {
  const now = Date.now();
  
  // 속도 제한 데이터 정리
  for (const [key, limit] of rateLimits.entries()) {
    if (now - limit.lastReset > 600000) { // 10분 이상된 데이터 삭제
      rateLimits.delete(key);
    }
  }
  
  // 토큰 데이터 정리 (5분 이상된 토큰 삭제)
  for (const [key, token] of validationTokens.entries()) {
    if (now - token.timestamp > 300000) { // 5분 이상된 토큰 삭제
      validationTokens.delete(key);
    }
  }
}, 600000);

/**
 * 검증 토큰 생성 함수
 */
function generateValidationToken(userKey, actionType) {
  const tokenId = `${userKey}_${actionType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const token = {
    id: tokenId,
    userKey: userKey,
    actionType: actionType,
    timestamp: Date.now(),
    used: false
  };
  
  validationTokens.set(tokenId, token);
  return tokenId;
}

/**
 * 토큰 검증 및 사용 처리
 */
function validateAndUseToken(tokenId, userKey, actionType) {
  const token = validationTokens.get(tokenId);
  
  if (!token) {
    throw new HttpsError('unauthenticated', '유효하지 않은 토큰입니다.');
  }
  
  if (token.used) {
    throw new HttpsError('permission-denied', '이미 사용된 토큰입니다.');
  }
  
  if (token.userKey !== userKey) {
    throw new HttpsError('permission-denied', '토큰 소유자가 일치하지 않습니다.');
  }
  
  if (token.actionType !== actionType) {
    throw new HttpsError('permission-denied', '토큰 액션 타입이 일치하지 않습니다.');
  }
  
  const now = Date.now();
  if (now - token.timestamp > 300000) { // 5분 초과
    validationTokens.delete(tokenId);
    throw new HttpsError('deadline-exceeded', '토큰이 만료되었습니다.');
  }
  
  // 토큰 사용 처리
  token.used = true;
  
  return true;
}

/**
 * 실제 클라이언트 IP 추출 함수
 */
function getClientIP(request) {
  // Firebase Functions v2에서 IP 추출 시도
  let clientIP = 
    request.rawRequest?.headers['x-forwarded-for'] ||
    request.rawRequest?.headers['x-real-ip'] ||
    request.rawRequest?.connection?.remoteAddress ||
    request.rawRequest?.socket?.remoteAddress ||
    request.rawRequest?.ip ||
    'unknown';
    
  // X-Forwarded-For는 쉼표로 구분된 IP 목록일 수 있음 (첫 번째가 실제 클라이언트)
  if (typeof clientIP === 'string' && clientIP.includes(',')) {
    clientIP = clientIP.split(',')[0].trim();
  }
  
  // 로컬 개발 환경에서 IP를 얻을 수 없는 경우 임시 IP 생성
  if (clientIP === 'unknown' || clientIP === '::1' || clientIP === '127.0.0.1') {
    // 개발 환경용 임시 IP (실제로는 다양한 IP 시뮬레이션)
    const tempIPs = [
      '192.168.1.100',
      '192.168.1.101', 
      '10.0.0.50',
      '172.16.0.10',
      '203.104.15.25'
    ];
    clientIP = tempIPs[Math.floor(Math.random() * tempIPs.length)];
  }
  
  return clientIP;
}

/**
 * IP 마스킹 함수 - 사용자 정보 보호
 */
function maskIP(ip) {
  if (!ip || ip === 'anonymous' || ip === 'unknown') {
    return '익명';
  }
  
  // IPv4 처리 (예: 192.168.1.100 -> 192.168.*.**)
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.**`;
    }
  }
  
  // IPv6 처리 (예: 2001:db8::1 -> 2001:db8::**)
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 3) {
      return `${parts[0]}:${parts[1]}::***`;
    }
  }
  
  // 기타 경우 처리
  if (ip.length > 6) {
    return ip.substring(0, 6) + '***';
  }
  
  return '익명';
}

/**
 * 토큰 발급 함수
 */
exports.getValidationToken = onCall(async (request) => {
  const data = request.data;
  const context = request;
  
  try {
    if (!data || !data.actionType) {
      throw new HttpsError('invalid-argument', '액션 타입이 필요합니다.');
    }
    
    const { actionType } = data;
    const userKey = getClientIP(context);
    
    // 지원되는 액션 타입 검증
    const supportedActions = ['chat_send', 'board_refresh', 'score_submit'];
    if (!supportedActions.includes(actionType)) {
      throw new HttpsError('invalid-argument', '지원되지 않는 액션 타입입니다.');
    }
    
    // 기본 속도 제한 확인 (토큰 발급도 제한)
    const now = Date.now();
    let userLimit = rateLimits.get(`${userKey}_token`) || {
      lastRequest: 0,
      count: 0,
      lastReset: now
    };
    
    // 1분마다 토큰 발급 카운트 리셋
    if (now - userLimit.lastReset > 60000) {
      userLimit = {
        lastRequest: 0,
        count: 0,
        lastReset: now
      };
    }
    
    // 1분간 토큰 발급 제한 (최대 10개)
    if (userLimit.count >= 10) {
      throw new HttpsError('resource-exhausted', '토큰 발급 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
    }
    
    const tokenId = generateValidationToken(userKey, actionType);
    
    // 토큰 발급 기록 업데이트
    userLimit.lastRequest = now;
    userLimit.count += 1;
    rateLimits.set(`${userKey}_token`, userLimit);
    
    return {
      success: true,
      token: tokenId,
      expiresIn: 300000, // 5분
      actionType: actionType
    };
    
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    
    console.error('Token generation error:', error);
    throw new HttpsError('internal', '토큰 생성에 실패했습니다.');
  }
});

/**
 * 점수 저장 함수 - 토큰 검증 및 속도 제한 포함 (asia-northeast1 지역)
 */
exports.submitScore = onCall(async (request) => {
  const data = request.data;
  const context = request;
  try {
    // 데이터가 없는 경우 처리
    if (!data || typeof data !== 'object') {
      throw new HttpsError('invalid-argument', 'No data received');
    }
    
    // 토큰 검증 (필수)
    const { validationToken } = data;
    if (!validationToken) {
      throw new HttpsError('unauthenticated', '유효한 토큰이 필요합니다.');
    }
    
    const userKey = getClientIP(context);
    validateAndUseToken(validationToken, userKey, 'score_submit');
    
    // 점수 제출 속도 제한 확인 (1분에 최대 3회)
    const now = Date.now();
    let userLimit = rateLimits.get(`${userKey}_score`) || {
      lastSubmit: 0,
      count: 0,
      lastReset: now
    };
    
    // 1분마다 카운트 리셋
    if (now - userLimit.lastReset > 60000) {
      userLimit = {
        lastSubmit: 0,
        count: 0,
        lastReset: now
      };
    }
    
    // 20초 이내 점수 제출 차단
    if (now - userLimit.lastSubmit < 20000) {
      throw new HttpsError('resource-exhausted', '점수 제출을 너무 빨리 시도하고 있습니다. 20초 후 다시 시도해주세요.');
    }
    
    // 1분간 3회 제출 제한
    if (userLimit.count >= 3) {
      throw new HttpsError('resource-exhausted', '1분간 점수 제출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
    }
    
    // 1. 기본 데이터 추출
    const playerName = data.playerName;
    const score = data.score;
    const country = data.country || "Unknown";
    const countryCode = data.countryCode || "XX";
    const flag = data.flag || "🌍";

    // 2. 플레이어 이름 검증
    if (!playerName || typeof playerName !== 'string') {
      throw new HttpsError('invalid-argument', 'Player name is required');
    }

    const cleanPlayerName = playerName.trim();
    if (cleanPlayerName.length === 0) {
      throw new HttpsError('invalid-argument', 'Player name cannot be empty');
    }

    if (cleanPlayerName.length > 10) {
      throw new HttpsError('invalid-argument', 'Player name is too long');
    }

    // 3. 점수 검증
    if (typeof score !== 'number' || score < 0 || score > 9999999) {
      throw new HttpsError('invalid-argument', 'Invalid score');
    }

    // 4. 상위 50개 점수 체크 및 저장
    const scoresRef = db.collection('scores');
    
    // 현재 저장된 점수 개수 확인
    const countSnapshot = await scoresRef.count().get();
    const currentCount = countSnapshot.data().count;
    
    // 50개 미만이면 바로 저장
    if (currentCount < 50) {
      const scoreData = {
        playerName: cleanPlayerName,
        score: score,
        country: country,
        countryCode: countryCode,
        flag: flag,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ip: getClientIP(context)
      };

      await scoresRef.add(scoreData);
      
      // 점수 제출 기록 업데이트
      userLimit.lastSubmit = now;
      userLimit.count += 1;
      rateLimits.set(`${userKey}_score`, userLimit);
      
      return { success: true, message: 'Score saved successfully' };
    }
    
    // 50개 이상이면 최하위 점수와 비교
    const lowestScoreSnapshot = await scoresRef
      .orderBy('score', 'asc')
      .limit(1)
      .get();
    
    if (lowestScoreSnapshot.empty) {
      throw new HttpsError('internal', 'Could not find lowest score');
    }
    
    const lowestScore = lowestScoreSnapshot.docs[0];
    const lowestScoreData = lowestScore.data();
    
    // 새 점수가 최하위 점수보다 높으면 교체
    if (score > lowestScoreData.score) {
      // 트랜잭션으로 안전하게 처리
      await db.runTransaction(async (transaction) => {
        // 최하위 점수 삭제
        transaction.delete(lowestScore.ref);
        
        // 새 점수 추가
        const newScoreRef = scoresRef.doc();
        const scoreData = {
          playerName: cleanPlayerName,
          score: score,
          country: country,
          countryCode: countryCode,
          flag: flag,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          ip: getClientIP(context)
        };
        
        transaction.set(newScoreRef, scoreData);
      });
      
      // 점수 제출 기록 업데이트
      userLimit.lastSubmit = now;
      userLimit.count += 1;
      rateLimits.set(`${userKey}_score`, userLimit);
      
      return { success: true, message: 'Score saved successfully (replaced lowest score)' };
    } else {
      // 점수가 낮아도 제출 시도는 기록
      userLimit.lastSubmit = now;
      userLimit.count += 1;
      rateLimits.set(`${userKey}_score`, userLimit);
      
      return { success: false, message: 'Score too low to be saved in top 50' };
    }
    
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError('internal', 'Failed to save score');
  }
});

/**
 * 채팅 메시지 전송 함수 - 토큰 검증 및 속도 제한 포함
 */
exports.sendChatMessage = onCall(async (request) => {
  const data = request.data;
  const context = request;
  
  try {
    // 데이터 검증
    if (!data || typeof data !== 'object') {
      throw new HttpsError('invalid-argument', '잘못된 데이터입니다.');
    }
    
    const { username, message, validationToken } = data;
    
    // 토큰 검증 (필수)
    if (!validationToken) {
      throw new HttpsError('unauthenticated', '유효한 토큰이 필요합니다.');
    }
    
    const userKey = getClientIP(context);
    validateAndUseToken(validationToken, userKey, 'chat_send');
    
    // 메시지 검증
    if (!message || typeof message !== 'string') {
      throw new HttpsError('invalid-argument', '메시지는 필수입니다.');
    }
    
    const cleanMessage = message.trim();
    if (cleanMessage.length === 0) {
      throw new HttpsError('invalid-argument', '빈 메시지는 보낼 수 없습니다.');
    }
    
    if (cleanMessage.length > 200) {
      throw new HttpsError('invalid-argument', '메시지는 200자를 초과할 수 없습니다.');
    }
    
    // 사용자명 검증
    const cleanUsername = (username || '익명').trim();
    if (cleanUsername.length > 5) {
      throw new HttpsError('invalid-argument', '사용자명은 5자를 초과할 수 없습니다.');
    }
    
    // 악성 콘텐츠 검사
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /onclick/i,
      /onerror/i,
      /<iframe/i,
      /document\./i,
      /window\./i
    ];
    
    for (const pattern of maliciousPatterns) {
      if (pattern.test(cleanMessage)) {
        throw new HttpsError('invalid-argument', '부적절한 내용이 포함되어 있습니다.');
      }
    }
    
    // 사용자 식별은 이미 위에서 완료됨 (402행)
    const now = Date.now();
    
    // 현재 사용자의 제한 정보 가져오기
    let userLimit = rateLimits.get(userKey) || {
      lastSent: 0,
      count: 0,
      lastReset: now
    };
    
    // 1분마다 카운트 리셋
    if (now - userLimit.lastReset > 60000) {
      userLimit = {
        lastSent: 0,
        count: 0,
        lastReset: now
      };
    }
    
    // 속도 제한 검사
    // 1. 30초 이내 메시지 차단
    if (now - userLimit.lastSent < 30000) { // 30 seconds
      throw new HttpsError('resource-exhausted', '메시지를 너무 빨리 보내고 있습니다. 잠시 후 다시 시도해주세요.');
    }
    
    // 2. 1분간 2개 메시지 제한 (30초당 1개이므로)
    if (userLimit.count >= 2) { // 2 messages per minute
      throw new HttpsError('resource-exhausted', '1분간 메시지 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
    }
    
    // 기본적인 스팸 검사 (같은 메시지 연속 전송 방지)
    const recentMessages = await db.collection('chat')
      .where('timestamp', '>', admin.firestore.Timestamp.fromMillis(now - 10000)) // 최근 10초
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();
    
    let duplicateCount = 0;
    recentMessages.forEach(doc => {
      const msgData = doc.data();
      if (msgData.message === cleanMessage) {
        duplicateCount++;
      }
    });
    
    if (duplicateCount >= 2) {
      throw new HttpsError('resource-exhausted', '같은 메시지를 너무 자주 보내고 있습니다.');
    }
    
    // Firestore에 메시지 저장 (중간 공백은 보존, 앞뒤만 trim)
    const chatData = {
      username: cleanUsername,
      message: cleanMessage, // 이미 trim()된 상태이지만 중간 공백은 보존됨
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ip: userKey, // 관리자용 - 전체 IP 저장
      maskedIP: maskIP(userKey), // 클라이언트 표시용 - 마스킹된 IP
      deleteVotes: 0, // 삭제 투표 수 초기화
      votedIps: [] // 투표한 IP 목록 초기화
    };
    
    await db.collection('chat').add(chatData);

    // 메시지 개수 제한 (최근 100개만 유지)
    const chatCollectionRef = db.collection('chat');
    const snapshot = await chatCollectionRef.orderBy('timestamp', 'asc').get();

    if (snapshot.size > 100) {
      const oldestMessages = snapshot.docs.slice(0, snapshot.size - 100);
      const batch = db.batch();
      oldestMessages.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`Deleted ${oldestMessages.length} oldest messages.`);
    }
    
    // 사용자 제한 정보 업데이트
    userLimit.lastSent = now;
    userLimit.count = userLimit.count + 1;
    rateLimits.set(userKey, userLimit);
    
    return { success: true, message: '메시지가 전송되었습니다.' };
    
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    
    console.error('Chat message error:', error);
    throw new HttpsError('internal', '메시지 전송에 실패했습니다.');
  }
});

/**
 * 채팅 메시지 삭제 함수 - IP 기반 권한 확인
 */
exports.deleteChatMessage = onCall(async (request) => {
  const data = request.data;
  const context = request;

  try {
    // 데이터 검증
    if (!data || typeof data !== 'object' || !data.messageId) {
      throw new HttpsError('invalid-argument', '잘못된 요청입니다. messageId가 필요합니다.');
    }

    const { messageId } = data;
    const userKey = getClientIP(context);

    const messageRef = db.collection('chat').doc(messageId);

    // 트랜잭션을 사용하여 읽기-수정-쓰기 작업을 원자적으로 처리
    const result = await db.runTransaction(async (transaction) => {
      const messageDoc = await transaction.get(messageRef);

      if (!messageDoc.exists) {
        throw new HttpsError('not-found', '해당 메시지를 찾을 수 없습니다.');
      }

      const messageData = messageDoc.data();

      // 메시지 소유자가 삭제를 요청한 경우 즉시 삭제
      if (messageData.ip === userKey) {
        transaction.delete(messageRef);
        return { success: true, message: '메시지가 성공적으로 삭제되었습니다.', currentVotes: 0, deleted: true };
      } else {
        // 다른 사용자가 삭제를 요청한 경우 투표 처리
        let currentDeleteVotes = messageData.deleteVotes || 0;
        let currentVotedIps = messageData.votedIps || [];

        // 이미 투표한 사용자인지 확인
        if (currentVotedIps.includes(userKey)) {
          throw new HttpsError('permission-denied', '이미 이 메시지에 삭제 투표를 하셨습니다.');
        }

        // 투표 수 증가 및 IP 추가
        const newDeleteVotes = currentDeleteVotes + 1;
        const newVotedIps = [...currentVotedIps, userKey];

        // 3표 이상이면 삭제
        if (newDeleteVotes >= 3) {
          transaction.delete(messageRef);
          return { success: true, message: '메시지가 성공적으로 삭제되었습니다.', currentVotes: newDeleteVotes, deleted: true };
        } else {
          // 3표 미만이면 투표 정보 업데이트
          transaction.update(messageRef, {
            deleteVotes: newDeleteVotes,
            votedIps: newVotedIps
          });
          return { success: true, message: `삭제 투표: ${newDeleteVotes}/3`, currentVotes: newDeleteVotes, deleted: false };
        }
      }
    });
    return result;

  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error('Delete chat message error:', error);
    throw new HttpsError('internal', '메시지 삭제에 실패했습니다.');
  }
});

/**
 * 게시판 새로고침 검증 함수 - 서버 사이드 속도 제한
 */
exports.validateBoardRefresh = onCall(async (request) => {
  const data = request.data;
  const context = request;
  
  try {
    // 데이터 검증
    if (!data || typeof data !== 'object') {
      throw new HttpsError('invalid-argument', '잘못된 데이터입니다.');
    }
    
    const { validationToken } = data;
    
    // 토큰 검증 (필수)
    if (!validationToken) {
      throw new HttpsError('unauthenticated', '유효한 토큰이 필요합니다.');
    }
    
    const userKey = getClientIP(context);
    validateAndUseToken(validationToken, userKey, 'board_refresh');
    
    // 추가 속도 제한 확인 (30초 간격)
    const now = Date.now();
    let userLimit = rateLimits.get(`${userKey}_refresh`) || {
      lastRefresh: 0,
      count: 0,
      lastReset: now
    };
    
    // 1분마다 카운트 리셋
    if (now - userLimit.lastReset > 60000) {
      userLimit = {
        lastRefresh: 0,
        count: 0,
        lastReset: now
      };
    }
    
    // 30초 이내 새로고침 차단
    if (now - userLimit.lastRefresh < 30000) {
      throw new HttpsError('resource-exhausted', '새로고침을 너무 빨리 시도하고 있습니다. 30초 후 다시 시도해주세요.');
    }
    
    // 1분간 2회 새로고침 제한
    if (userLimit.count >= 2) {
      throw new HttpsError('resource-exhausted', '1분간 새로고침 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
    }
    
    // 새로고침 기록 업데이트
    userLimit.lastRefresh = now;
    userLimit.count += 1;
    rateLimits.set(`${userKey}_refresh`, userLimit);
    
    return {
      success: true,
      message: '새로고침이 허용되었습니다.',
      nextAllowedTime: now + 30000 // 다음 허용 시간
    };
    
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    
    console.error('Board refresh validation error:', error);
    throw new HttpsError('internal', '새로고침 검증에 실패했습니다.');
  }
});

/**
 * 채팅 메시지 조회 함수 - 타임스탬프 기반 증분 업데이트
 */
exports.getChatMessages = onCall(async (request) => {
  const data = request.data;
  
  try {
    // 데이터 검증
    if (!data || typeof data !== 'object') {
      throw new HttpsError('invalid-argument', '잘못된 데이터입니다.');
    }
    
    const { startAfterTimestamp, limit = 10 } = data; // 기본 10개
    
    let query = db.collection('chat').orderBy('timestamp', 'desc');
    
    // startAfterTimestamp가 있으면 해당 시간 이후의 메시지부터 조회
    if (startAfterTimestamp) {
      const startAfterDate = new Date(startAfterTimestamp);
      if (isNaN(startAfterDate.getTime())) {
        throw new HttpsError('invalid-argument', '잘못된 시간 형식입니다.');
      }
      query = query.startAfter(admin.firestore.Timestamp.fromDate(startAfterDate));
    }
    
    // 제한된 개수만 조회 (기본 10개, 최대 100개)
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    query = query.limit(safeLimit);
    
    const snapshot = await query.get();
    
    const messages = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.timestamp) {
        // maskedIP가 없는 기존 메시지는 ip 필드로부터 실시간 마스킹
        const maskedIP = data.maskedIP || maskIP(data.ip) || '익명';
        
        messages.push({
          id: doc.id,
          username: data.username,
          message: data.message,
          timestamp: data.timestamp.toDate().toISOString(), // ISO 문자열로 변환
          serverTime: data.timestamp.toDate().getTime(), // 밀리초도 포함
          deleteVotes: data.deleteVotes || 0,
          votedIps: data.votedIps || [],
          maskedIP: maskedIP // 마스킹된 IP 추가
        });
      }
    });
    
    return {
      success: true,
      messages: messages,
      count: messages.length,
      serverTime: new Date().toISOString(), // 서버 현재 시간
      hasMore: snapshot.size === safeLimit // 더 가져올 메시지가 있는지
    };
    
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    
    console.error('Get chat messages error:', error);
    throw new HttpsError('internal', '메시지 조회에 실패했습니다.');
  }
});