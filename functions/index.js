const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * 클라이언트로부터 점수 등록 요청을 받아 검증 후 저장하는 함수
 */
exports.submitScore = functions.https.onCall(async (data, context) => {
  // 1. 데이터 유효성 검사
  const { playerName, score, country, countryCode, flag } = data;
  
  // 디버깅 로그
  console.log('Received data:', JSON.stringify(data));
  console.log('PlayerName type:', typeof playerName);
  console.log('PlayerName value:', JSON.stringify(playerName));

  // 데이터 타입 확인 및 변환
  let validPlayerName = '';
  if (typeof playerName === 'string') {
    validPlayerName = playerName.trim();
  } else if (playerName !== null && playerName !== undefined) {
    validPlayerName = String(playerName).trim();
  }

  console.log('Valid player name:', JSON.stringify(validPlayerName));

  // 플레이어 이름 유효성 검사
  if (!validPlayerName || validPlayerName.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Player name is required and cannot be empty.');
  }
  
  if (validPlayerName.length > 20) {
    throw new functions.https.HttpsError('invalid-argument', 'Player name cannot be longer than 20 characters.');
  }
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 100000) {
    throw new functions.https.HttpsError('invalid-argument', 'Score is invalid.');
  }

  // 2. (옵션) 더 정교한 치팅 방지 로직을 여기에 추가할 수 있습니다.
  // 예: 게임 플레이 로그를 받아 점수를 서버에서 재계산
  // 예: 클라이언트에서 생성한 암호화된 토큰을 검증

  // 3. 검증된 데이터를 데이터베이스에 저장
  try {
    await db.collection("scores").add({
      playerName: validPlayerName,
      score: score,
      country: country || "Unknown",
      countryCode: countryCode || "XX",
      flag: flag || "🌍",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      // 서버에서 기록했다는 것을 명시하거나, 요청 IP를 저장할 수도 있습니다.
      validatedBy: "server",
      ipAddress: context.rawRequest.ip 
    });
    return { status: "success", message: "Score submitted successfully!" };
  } catch (error) {
    console.error("Error saving score:", error);
    throw new functions.https.HttpsError('internal', 'An internal error occurred while saving the score.');
  }
});