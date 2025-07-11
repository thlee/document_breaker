const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

// 글로벌 옵션으로 지역 설정
setGlobalOptions({ region: 'asia-northeast1' });

admin.initializeApp();
const db = admin.firestore();

// 사용자별 속도 제한 추적 (메모리 기반)
const rateLimits = new Map();

// 주기적으로 오래된 제한 데이터 정리 (10분마다)
setInterval(() => {
  const now = Date.now();
  for (const [key, limit] of rateLimits.entries()) {
    if (now - limit.lastReset > 600000) { // 10분 이상된 데이터 삭제
      rateLimits.delete(key);
    }
  }
}, 600000);

/**
 * 점수 저장 함수 - 간단하고 안전한 버전 (asia-northeast1 지역)
 */
exports.submitScore = onCall(async (request) => {
  const data = request.data;
  const context = request;
  try {
    // 데이터가 없는 경우 처리
    if (!data || typeof data !== 'object') {
      throw new HttpsError('invalid-argument', 'No data received');
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
        ip: context.rawRequest?.ip || 'unknown'
      };

      await scoresRef.add(scoreData);
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
          ip: context.rawRequest?.ip || 'unknown'
        };
        
        transaction.set(newScoreRef, scoreData);
      });
      
      return { success: true, message: 'Score saved successfully (replaced lowest score)' };
    } else {
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
 * 채팅 메시지 전송 함수 - 속도 제한 및 검증 포함
 */
exports.sendChatMessage = onCall(async (request) => {
  const data = request.data;
  const context = request;
  
  try {
    // 데이터 검증
    if (!data || typeof data !== 'object') {
      throw new HttpsError('invalid-argument', '잘못된 데이터입니다.');
    }
    
    const { username, message } = data;
    
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
    
    // 사용자 식별 (IP 기반)
    const userKey = context.rawRequest?.ip || 'anonymous';
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
    // 1. 0.5초 이내 메시지 차단
    if (now - userLimit.lastSent < 500) {
      throw new HttpsError('resource-exhausted', '메시지를 너무 빨리 보내고 있습니다. 잠시 후 다시 시도해주세요.');
    }
    
    // 2. 1분간 20개 메시지 제한
    if (userLimit.count >= 20) {
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
      ip: userKey // 필요시 관리자가 확인 가능
    };
    
    await db.collection('chat').add(chatData);
    
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
 * 채팅 메시지 조회 함수 - 타임스탬프 기반 증분 업데이트
 */
exports.getChatMessages = onCall(async (request) => {
  const data = request.data;
  
  try {
    // 데이터 검증
    if (!data || typeof data !== 'object') {
      throw new HttpsError('invalid-argument', '잘못된 데이터입니다.');
    }
    
    const { lastSyncTime, limit = 50 } = data;
    
    let query = db.collection('chat').orderBy('timestamp', 'asc');
    
    // 마지막 동기화 시간 이후의 메시지만 조회
    if (lastSyncTime) {
      // 클라이언트에서 전송된 timestamp 문자열을 Date로 변환
      const syncDate = new Date(lastSyncTime);
      if (isNaN(syncDate.getTime())) {
        throw new HttpsError('invalid-argument', '잘못된 시간 형식입니다.');
      }
      
      query = query.where('timestamp', '>', admin.firestore.Timestamp.fromDate(syncDate));
    }
    
    // 제한된 개수만 조회 (기본 50개, 최대 100개)
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    query = query.limit(safeLimit);
    
    const snapshot = await query.get();
    
    const messages = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.timestamp) {
        messages.push({
          id: doc.id,
          username: data.username,
          message: data.message,
          timestamp: data.timestamp.toDate().toISOString(), // ISO 문자열로 변환
          serverTime: data.timestamp.toDate().getTime() // 밀리초도 포함
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