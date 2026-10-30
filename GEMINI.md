# 문서 파괴자 - 프로젝트 개요 및 구조 분석

## 1. 프로젝트 개요
"문서 파괴자"는 사용자가 나타나는 문서를 클릭하여 파괴하고 점수를 획득하는 사무실 서바이벌 게임입니다. 게임 플레이 외에 실시간 랭킹 시스템과 채팅 기능(향후 게시판으로 전환 예정)을 포함하고 있습니다.

## 2. 기술 스택
*   **프론트엔드:** HTML, CSS, JavaScript
*   **백엔드:** Firebase (Firestore, Cloud Functions)
*   **오디오:** Web Audio API (AudioManager.js)

## 3. 클라이언트 구조 (`assets/js`)

### `main.js`
*   Firebase SDK를 초기화하고 `firebaseConfig`를 설정합니다.
*   `Game` 객체와 `AudioManager` 객체를 생성하고 초기화합니다.
*   게임 시작/재시작, 음소거 토글 등의 전역 함수를 정의합니다.
*   키보드 이벤트 (예: 'A' 키를 통한 AI 토큰 사용) 및 마우스 이동 이벤트 (총 모드)를 처리합니다.
*   `initializeChat()` 함수를 호출하여 채팅 시스템을 초기화합니다.

### `Chat.js`
*   `ChatSystem` 클래스를 정의하여 채팅 기능의 핵심 로직을 관리합니다.
*   **메시지 송수신:** `sendChatMessage` (Functions)를 통해 메시지를 전송하고, `getChatMessages` (Functions)를 통해 메시지를 조회합니다.
*   **속도 제한:** 클라이언트 측에서 메시지 전송 속도를 제한합니다 (`SEND_COOLDOWN`).
*   **UI 관리:** 채팅 입력창, 사용자명 입력창, 전송 버튼, 메시지 표시 영역 등의 DOM 요소를 제어합니다.
*   **메시지 필터링:** 기본적인 욕설/스팸 필터링 기능을 포함합니다.
*   **이모티콘 지원:** 이모티콘 선택 패널 및 버튼을 추가합니다.
*   **실시간 업데이트:** 폴링(`fetchNewMessages`를 2초마다 호출)을 통해 새 메시지를 주기적으로 가져옵니다.
*   **메시지 캐싱:** `messageCache`를 사용하여 중복 메시지 표시를 방지합니다.
*   **메시지 개수 제한:** 클라이언트 UI에 표시되는 메시지 수를 50개로 제한합니다.
*   **알림:** 새 메시지 도착 시 알림음을 재생합니다.
*   **연결 상태 체크:** 주기적으로 서버와의 동기화 상태를 확인하고 필요시 강제 동기화를 수행합니다.

### 기타 게임 관련 스크립트
*   `GameObjects.js`: 게임 내 객체 (문서, 신입사원, 메일 등) 정의.
*   `AudioManager.js`: 게임 내 배경 음악 및 효과음 관리.
*   `Game.js`: 게임 로직, 점수, 시간, 체력 관리, 객체 생성 및 상호작용 처리.
*   `UI.js`: 게임 UI 요소 (점수, 시간, 체력바 등) 업데이트.
*   `LeaderBoard.js`: 랭킹 보드 UI 및 데이터 관리.

## 4. 서버 구조 (`functions`)

### `index.js`
Firebase Cloud Functions를 정의합니다.
*   **`submitScore` (HTTPS Callable Function):**
    *   클라이언트로부터 플레이어 이름과 점수를 받아 랭킹을 저장합니다.
    *   플레이어 이름과 점수에 대한 유효성 검사를 수행합니다.
    *   Firestore의 `scores` 컬렉션에 상위 50개의 점수만 유지하도록 관리합니다 (새 점수가 기존 최하위 점수보다 높으면 교체).
*   **`sendChatMessage` (HTTPS Callable Function):**
    *   클라이언트로부터 사용자명과 메시지를 받아 Firestore의 `chat` 컬렉션에 저장합니다.
    *   메시지 내용, 사용자명에 대한 유효성 검사를 수행합니다.
    *   IP 기반의 사용자별 메시지 전송 속도 제한 (0.5초 이내 메시지 차단, 1분간 20개 메시지 제한) 및 기본적인 스팸 검사를 포함합니다.
    *   악성 콘텐츠 (스크립트 태그, `javascript:`, `onclick` 등)를 검사하여 차단합니다.
*   **`getChatMessages` (HTTPS Callable Function):**
    *   클라이언트의 `lastSyncTime`을 기준으로 새로운 채팅 메시지를 조회하여 반환합니다.
    *   최대 100개의 메시지를 조회할 수 있도록 제한합니다.

### `firestore.rules`
Firestore 데이터베이스의 보안 규칙을 정의합니다.
*   **`/scores/{scoreId}`:** 모든 사용자의 읽기(`read`)는 허용하지만, 클라이언트에서 직접 쓰기(`write`), 수정(`update`), 삭제(`delete`)는 금지합니다. (Functions를 통해서만 가능)
*   **`/chat/{messageId}`:**
    *   모든 사용자의 읽기(`read`)는 허용합니다.
    *   메시지 생성(`create`)은 `isValidChatMessage()` 함수를 통해 유효성 검사를 통과한 경우에만 허용합니다.
    *   메시지 수정(`update`) 및 삭제(`delete`)는 허용하지 않습니다 (메시지의 불변성 보장).
    *   `isValidChatMessage()` 함수는 필수 필드 존재 여부, 데이터 타입, 길이 제한, 악성 콘텐츠 포함 여부 등을 검사합니다.

## 5. 채팅 기능 분석 (게시판 전환을 위한 핵심)

### 현재 상태
*   Firebase Firestore의 `chat` 컬렉션에 메시지가 저장됩니다.
*   Firebase Cloud Functions (`sendChatMessage`, `getChatMessages`)를 통해 메시지 전송 및 조회가 이루어집니다.
*   클라이언트 (`Chat.js`)는 폴링 방식으로 새 메시지를 가져와 UI에 추가합니다.
*   클라이언트와 서버 양측에서 메시지 전송 속도 제한 및 유효성 검사가 적용됩니다.
*   메시지 수정/삭제는 현재 허용되지 않습니다 (Firestore Rules에서 `update`, `delete`가 `false`로 설정됨).

### 게시판 전환 시 고려사항
*   **데이터 유지:** 가장 최근 게시물 100개만 유지하도록 Firestore Functions 수정 필요.
*   **초기 로드:** 접속 시 최근 게시물 10개 표시.
*   **스크롤 로드:** 스크롤을 위로 올리면 순차적으로 나머지 90개 게시물 로드.
*   **메시지 전송 제한:** 클라이언트당 30초당 1개 게시물로 제한 (현재 0.5초당 1개).
*   **삭제 기능:** 게시물 삭제 기능 추가 (현재 Firestore Rules에서 `delete`가 `false`이므로 Functions를 통해 구현 필요).
*   **수정 기능:** 게시물 수정은 불가 (현재와 동일).
