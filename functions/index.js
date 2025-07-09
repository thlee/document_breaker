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
      throw new HttpsError('invalid-argument', 'No data received');
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
      throw new HttpsError('invalid-argument', 'Player name is required');
    }

    const cleanPlayerName = playerName.trim();
    if (cleanPlayerName.length === 0) {
      throw new HttpsError('invalid-argument', 'Player name cannot be empty');
    }

    if (cleanPlayerName.length > 20) {
      throw new HttpsError('invalid-argument', 'Player name is too long');
    }

    // 3. 점수 검증
    if (typeof score !== 'number' || score < 0 || score > 100000) {
      throw new HttpsError('invalid-argument', 'Invalid score');
    }

    // 4. 상위 100개 점수 체크 및 저장
    const scoresRef = db.collection('scores');
    
    // 현재 저장된 점수 개수 확인
    const countSnapshot = await scoresRef.count().get();
    const currentCount = countSnapshot.data().count;
    
    console.log('현재 저장된 점수 개수:', currentCount);
    
    // 100개 미만이면 바로 저장
    if (currentCount < 100) {
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
      console.log('점수 저장 완료 (100개 미만)');
      return { success: true, message: 'Score saved successfully' };
    }
    
    // 100개 이상이면 최하위 점수와 비교
    const lowestScoreSnapshot = await scoresRef
      .orderBy('score', 'asc')
      .limit(1)
      .get();
    
    if (lowestScoreSnapshot.empty) {
      throw new HttpsError('internal', 'Could not find lowest score');
    }
    
    const lowestScore = lowestScoreSnapshot.docs[0];
    const lowestScoreData = lowestScore.data();
    
    console.log('최하위 점수:', lowestScoreData.score, '새 점수:', score);
    
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
      
      console.log('점수 교체 완료');
      return { success: true, message: 'Score saved successfully (replaced lowest score)' };
    } else {
      console.log('점수가 최하위보다 낮아 저장하지 않음');
      return { success: false, message: 'Score too low to be saved in top 100' };
    }

    return { success: true, message: 'Score saved successfully' };

  } catch (error) {
    console.error('Error in submitScore:', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError('internal', 'Failed to save score');
  }
});