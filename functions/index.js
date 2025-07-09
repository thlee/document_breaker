const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * 점수 저장 함수 - 간단하고 안전한 버전
 */
exports.submitScore = functions.https.onCall(async (data, context) => {
  try {
    // 디버깅 로그
    console.log('=== submitScore called ===');
    console.log('Raw data:', data);
    console.log('Data type:', typeof data);
    console.log('Data keys:', data ? Object.keys(data) : 'no data');
    
    // 1. 기본 데이터 추출
    const playerName = data ? data.playerName : undefined;
    const score = data ? data.score : undefined;
    const country = data ? data.country : "Unknown";
    const countryCode = data ? data.countryCode : "XX";
    const flag = data ? data.flag : "🌍";

    console.log('Extracted playerName:', playerName);
    console.log('PlayerName type:', typeof playerName);

    // 2. 플레이어 이름 검증
    if (!playerName || typeof playerName !== 'string') {
      console.log('Player name validation failed:', { playerName, type: typeof playerName });
      throw new functions.https.HttpsError('invalid-argument', 'Player name is required');
    }

    const cleanPlayerName = playerName.trim();
    if (cleanPlayerName.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Player name cannot be empty');
    }

    if (cleanPlayerName.length > 20) {
      throw new functions.https.HttpsError('invalid-argument', 'Player name is too long');
    }

    // 3. 점수 검증
    if (typeof score !== 'number' || score < 0 || score > 100000) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid score');
    }

    // 4. 데이터베이스에 저장
    const scoreData = {
      playerName: cleanPlayerName,
      score: score,
      country: country,
      countryCode: countryCode,
      flag: flag,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ip: context.rawRequest.ip || 'unknown'
    };

    await db.collection('scores').add(scoreData);

    return { success: true, message: 'Score saved successfully' };

  } catch (error) {
    console.error('Error in submitScore:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to save score');
  }
});