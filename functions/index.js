const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * 점수 저장 함수 - 간단하고 안전한 버전 (asia-northeast1 지역)
 */
exports.submitScore = functions.region('asia-northeast1').https.onCall(async (data, context) => {
  try {
    // 디버깅 로그
    console.log('=== submitScore called ===');
    console.log('Raw data received:', data);
    console.log('Data type:', typeof data);
    console.log('Is data null?', data === null);
    console.log('Is data undefined?', data === undefined);
    
    if (data) {
      console.log('Data keys:', Object.keys(data));
      console.log('Data.playerName exists?', 'playerName' in data);
      console.log('Data.playerName value:', data.playerName);
    }
    
    // 데이터가 없는 경우 처리
    if (!data || typeof data !== 'object') {
      console.log('No valid data received');
      throw new functions.https.HttpsError('invalid-argument', 'No data received');
    }
    
    // 1. 기본 데이터 추출
    const playerName = data.playerName;
    const score = data.score;
    const country = data.country || "Unknown";
    const countryCode = data.countryCode || "XX";
    const flag = data.flag || "🌍";

    console.log('Extracted playerName:', playerName);
    console.log('PlayerName type:', typeof playerName);
    console.log('PlayerName length:', playerName ? playerName.length : 'no length');

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