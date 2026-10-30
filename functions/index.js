const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

// 글로벌 옵션으로 지역 설정
setGlobalOptions({ region: 'asia-northeast1' });

admin.initializeApp();
const db = admin.firestore();

// 사용자별 속도 제한 추적 (메모리 기반)
const rateLimits = new Map();

// 토큰 기반 검증 시스템 - Firestore 기반으로 변경
// const validationTokens = new Map(); // 인메모리 방식 제거

// 주기적으로 오래된 제한 데이터 정리 (10분마다)
const rateLimitCleanup = setInterval(() => {
  const now = Date.now();
  
  // 속도 제한 데이터 정리
  for (const [key, limit] of rateLimits.entries()) {
    if (now - limit.lastReset > 600000) { // 10분 이상된 데이터 삭제
      rateLimits.delete(key);
    }
  }
  
  // 토큰 데이터 정리는 Firestore TTL로 대체됨
}, 600000);
rateLimitCleanup.unref();

/**
 * 검증 토큰 생성 함수 - Firestore 기반
 */
async function generateValidationToken(userKey, actionType) {
  const tokenId = `${userKey}_${actionType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const token = {
    id: tokenId,
    userKey: userKey,
    actionType: actionType,
    timestamp: Date.now(),
    used: false,
    expiresAt: new Date(Date.now() + 300000) // 5분 후 만료
  };
  
  // Firestore에 토큰 저장
  await db.collection('validation_tokens').doc(tokenId).set(token);
  return tokenId;
}

/**
 * 토큰 검증 및 사용 처리
 */
async function validateAndUseToken(tokenId, userKey, actionType) {
  if (typeof tokenId !== 'string' || !tokenId || tokenId.length > 512 || tokenId.includes('/')) {
    throw new HttpsError('unauthenticated', '유효하지 않은 토큰입니다.');
  }
  const tokenRef = db.collection('validation_tokens').doc(tokenId);
  return db.runTransaction(async (transaction) => {
    const tokenDoc = await transaction.get(tokenRef);

    if (!tokenDoc.exists) {
      throw new HttpsError('unauthenticated', '유효하지 않은 토큰입니다.');
    }

    const token = tokenDoc.data();

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
    if (!Number.isFinite(token.timestamp) || now - token.timestamp > 300000) {
      throw new HttpsError('deadline-exceeded', '토큰이 만료되었습니다.');
    }

    // 토큰을 사용됨으로 마킹
    transaction.update(tokenRef, { used: true });

    return true;
  });
}

/**
 * 실제 클라이언트 IP 추출 함수
 */
function getClientIP(request) {
  // Firebase Functions v2에서 IP 추출 시도
  let clientIP = 
    request.rawRequest?.headers?.['x-forwarded-for'] ||
    request.rawRequest?.headers?.['x-real-ip'] ||
    request.rawRequest?.connection?.remoteAddress ||
    request.rawRequest?.socket?.remoteAddress ||
    request.rawRequest?.ip ||
    'unknown';
    
  // X-Forwarded-For는 쉼표로 구분된 IP 목록일 수 있음 (첫 번째가 실제 클라이언트)
  if (typeof clientIP === 'string' && clientIP.includes(',')) {
    clientIP = clientIP.split(',')[0].trim();
  }
  
  // Keep a stable identity across token issuance and use, including locally.
  return typeof clientIP === 'string' ? clientIP : 'unknown';
}

/**
 * IP 마스킹 함수 - 사용자 정보 보호
 */
function maskIP(ip) {
  if (typeof ip !== 'string' || !require('node:net').isIP(ip)) {
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
  
  return '익명';
}

function normalizeCountryCode(value) {
  return typeof value === 'string' && /^[A-Za-z]{2}$/.test(value) ? value.toUpperCase() : 'XX';
}

function countryFlag(countryCode) {
  if (countryCode === 'XX') return '🌍';
  return String.fromCodePoint(...[...countryCode].map(char => char.charCodeAt(0) + 127397));
}

function publicTimestamp(value) {
  if (!value || typeof value.toDate !== 'function') return null;
  const date = value.toDate();
  if (!Number.isFinite(date.getTime())) return null;
  return {
    seconds: Number.isInteger(value.seconds) ? value.seconds : Math.floor(date.getTime() / 1000),
    nanoseconds: Number.isInteger(value.nanoseconds) ? value.nanoseconds : (date.getTime() % 1000) * 1000000
  };
}

// Raw score documents contain private IPs. Return only explicit display fields.
exports.getLeaderboard = onCall(async () => {
  try {
    const snapshot = await db.collection('scores').orderBy('score', 'desc').limit(50).get();
    const scores = snapshot.docs.map(doc => {
      const data = doc.data();
      const countryCode = normalizeCountryCode(data.countryCode);
      return {
        id: doc.id,
        playerName: typeof data.playerName === 'string' ? data.playerName : 'Unknown',
        score: Number.isFinite(data.score) ? data.score : 0,
        countryCode,
        flag: countryFlag(countryCode),
        timestamp: publicTimestamp(data.timestamp)
      };
    });
    return { success: true, scores };
  } catch (error) {
    console.error('Leaderboard error:', error);
    throw new HttpsError('internal', '랭킹을 불러오지 못했습니다.');
  }
});

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
    
    const tokenId = await generateValidationToken(userKey, actionType);
    
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
    await validateAndUseToken(validationToken, userKey, 'score_submit');
    
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
    const country = typeof data.country === 'string' ? data.country.slice(0, 100) : 'Unknown';
    const countryCode = normalizeCountryCode(data.countryCode);
    const flag = countryFlag(countryCode);

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
    if (!Number.isSafeInteger(score) || score < 0 || score > 9999999) {
      throw new HttpsError('invalid-argument', 'Invalid score');
    }

    // A shared private document serializes even submissions into an empty leaderboard.
    const scoresRef = db.collection('scores');
    const lockRef = db.collection('_internal').doc('leaderboard');
    const accepted = await db.runTransaction(async (transaction) => {
      await transaction.get(lockRef);
      const snapshot = await transaction.get(scoresRef.orderBy('score', 'desc'));
      const shouldSave = snapshot.size < 50 || score > snapshot.docs[49].data().score;
      const keepCount = shouldSave ? 49 : 50;
      for (const oldScore of snapshot.docs.slice(keepCount)) {
        transaction.delete(oldScore.ref);
      }
      if (shouldSave) {
        transaction.set(scoresRef.doc(), {
          playerName: cleanPlayerName,
          score,
          country,
          countryCode,
          flag,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          ip: userKey
        });
      }
      transaction.set(lockRef, { updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return shouldSave;
    });
    userLimit.lastSubmit = now;
    userLimit.count += 1;
    rateLimits.set(userKey + '_score', userLimit);
    return {
      success: accepted,
      message: accepted ? 'Score saved successfully' : 'Score too low to be saved in top 50'
    };
    
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
    await validateAndUseToken(validationToken, userKey, 'chat_send');
    
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
    if (username != null && typeof username !== 'string') {
      throw new HttpsError('invalid-argument', '사용자명은 문자열이어야 합니다.');
    }
    const cleanUsername = (username || '').trim() || '익명';
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
    if (!data || typeof data !== 'object' || typeof data.messageId !== 'string' ||
        !data.messageId || data.messageId.length > 512 || data.messageId.includes('/')) {
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
        const currentVotedIps = Array.isArray(messageData.votedIps)
          ? [...new Set(messageData.votedIps.filter(ip => typeof ip === 'string'))] : [];
        const currentDeleteVotes = currentVotedIps.length;

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
    await validateAndUseToken(validationToken, userKey, 'board_refresh');
    
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
    
    const { startAfterTimestamp, limit = 10 } = data;
    if (!Number.isInteger(limit) || limit < 1) {
      throw new HttpsError('invalid-argument', '조회 개수는 양의 정수여야 합니다.');
    }
    
    let query = db.collection('chat').orderBy('timestamp', 'desc');
    
    // startAfterTimestamp가 있으면 해당 시간 이후의 메시지부터 조회
    if (startAfterTimestamp) {
      if (typeof startAfterTimestamp !== 'string') {
        throw new HttpsError('invalid-argument', '잘못된 시간 형식입니다.');
      }
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
      if (publicTimestamp(data.timestamp)) {
        messages.push({
          id: doc.id,
          username: typeof data.username === 'string' ? data.username : '익명',
          message: typeof data.message === 'string' ? data.message : '',
          timestamp: data.timestamp.toDate().toISOString(), // ISO 문자열로 변환
          serverTime: data.timestamp.toDate().getTime(), // 밀리초도 포함
          deleteVotes: Number.isInteger(data.deleteVotes) ? Math.max(0, Math.min(data.deleteVotes, 3)) : 0,
          // Derive this from the private IP; legacy maskedIP may be client-written.
          maskedIP: maskIP(data.ip)
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
