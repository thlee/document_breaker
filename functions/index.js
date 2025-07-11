const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

// 글로벌 옵션으로 지역 설정
setGlobalOptions({ region: 'asia-northeast1' });

admin.initializeApp();
const db = admin.firestore();

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