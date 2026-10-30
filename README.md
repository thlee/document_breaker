# 📄 문서 파괴자 (Document Breaker)

<p align="center">
  <img src="assets/images/office_newbie_0.png" alt="Document Breaker" width="200"/>
</p>

<p align="center">
  <strong>사무실 서바이벌 게임 - 문서를 터트리고 살아남으세요!</strong>
</p>

<p align="center">
  <a href="https://thlee.github.io/document_breaker/" target="_blank">
    <img src="https://img.shields.io/badge/🎮_지금_플레이하기-FF6B6B?style=for-the-badge&logoColor=white" alt="Play Now"/>
  </a>
</p>

---

## 🎮 게임 소개

문서 파괴자는 HTML5 Canvas 기반의 실시간 웹 게임입니다. 플레이어는 끊임없이 생성되는 문서들을 클릭하여 파괴하고, 문서가 너무 많이 쌓이기 전에 처리해야 합니다. 상사가 나타나기 전에 살아남으세요!

### 🎯 게임 목표
- 나타나는 문서를 클릭해서 터트리세요
- 작고 빠른 문서일수록 높은 점수를 얻습니다
- 문서가 너무 쌓이면 상사가 나타납니다... 😰

### 🎮 게임 요소
- **📄 문서**: 클릭하면 터져서 점수 획득
- **👨‍💼 신입사원**: 클릭하면 문서 5개 추가 (피하세요!)
- **📧 메일**: 클릭하면 이직! 쌓인 문서 제거
- **😡 상사**: 클릭하면 블럭 깨기 모드 시작

### 💡 게임 팁
- 경력직으로 이직할수록 업무가 늘어나니 타이밍을 잘 맞춰보세요
- 문서가 많이 쌓였을 때 메일을 클릭하면 효과적입니다
- 상사가 나타나면 빠르게 클릭하여 특수 모드를 활성화하세요

## 🚀 기술 스택

### Frontend
- **HTML5 Canvas**: 게임 렌더링
- **Vanilla JavaScript**: 게임 로직 및 상호작용
- **CSS3**: 반응형 UI 디자인
- **Web Audio API**: 사운드 효과

### Backend
- **Firebase Functions**: 서버리스 백엔드 (Node.js)
- **Firebase Firestore**: 실시간 랭킹 데이터베이스
- **Firebase Hosting**: 웹 호스팅

### 기타 기능
- **다국어 지원**: 한국어/영어 (IP 기반 자동 감지)
- **실시간 랭킹**: 상위 50명 랭킹 시스템
- **국가별 플래그**: 플레이어 국가 표시

## 🎮 게임 조작법

### 기본 조작
- **마우스 클릭**: 문서/객체 파괴
- **스페이스바** 또는 **P키**: 게임 일시정지
- **음소거 버튼**: 배경음악 및 효과음 끄기/켜기
- **스마트폰·태블릿**: 문서를 터치해서 처리하고, 🤖 버튼으로 AI를 켠 뒤 손가락으로 문서 위를 쓸어 지울 수 있습니다.
- **⏸ / ▶ 버튼**: 키보드 없이 일시정지·재개. 앱 전환 후 자동으로 멈췄을 때도 사용할 수 있습니다.

좁은 화면에서는 게임을 위쪽에, 게시판과 랭킹을 아래쪽에 표시합니다. 화면 회전·창 크기 변경 시 문서와 폭탄도 화면 안으로 이동합니다.
게임 진행은 고정 60Hz로 계산하여 화면 주사율에 따른 차이를 줄입니다.

### 특수 모드
- **블럭 깨기 모드**: 상사를 클릭하면 활성화되는 특수 모드 (10초간)
- **이직 시스템**: 별을 클릭하여 쌓인 문서 제거 및 배경 변경

## 🎯 게임 특징

### 다이나믹 난이도 조절
- 점수가 높아질수록 문서 생성 속도 증가
- 문서 생존 시간 단축
- 신입사원 출현 빈도 증가

### 실시간 랭킹 시스템
- 상위 50명 랭킹 실시간 업데이트
- 국가별 플래그 표시
- 점수 중복 방지 시스템

## 🌐 다국어 지원

게임은 사용자의 IP 위치를 기반으로 자동으로 언어를 설정합니다:

- **한국 (KR)**: 한국어 인터페이스
- **기타 국가**: 영어 인터페이스

## 개발 및 검증

Node.js 22에서 다음 명령으로 게임·화면·서버 회귀 테스트를 실행합니다.

```bash
cd functions
npm ci
npm test
```

Firestore 보안 규칙과 실제 서버 동작은 Java 21 이상을 설치한 뒤 저장소 루트에서 별도로 검증합니다.
이 명령은 운영 데이터가 아닌 로컬 `demo-document-breaker` 프로젝트만 사용합니다.

```bash
npx firebase-tools@15.34.2 emulators:exec --only firestore --project demo-document-breaker "node --test --test-concurrency=1 tests/backend-emulator.test.js tests/firestore-rules.test.js"
```

`scores`와 `chat` 원본에는 비공개 IP 정보가 있으므로 클라이언트의 직접 읽기·쓰기를 모두 금지합니다.
랭킹은 `getLeaderboard`, 게시판은 `getChatMessages`를 통해 공개 필드만 조회합니다.
기존 문서도 동일 규칙으로 보호하므로 데이터 이전은 필요하지 않습니다.
이 변경을 배포할 때는 Functions, Firestore 규칙, 프런트엔드를 함께 반영해야 합니다.
CI는 PR에서 테스트만 실행하며, 운영 배포는 `main`에 대한 push에서만 실행합니다.

## 🐛 알려진 이슈

- [ ] 일부 모바일 브라우저에서 음성 자동 재생 제한
- [ ] 네트워크 불안정 시 랭킹 로딩 지연
- [ ] 고해상도 디스플레이에서 이미지 품질 저하

## 📝 라이선스

이 프로젝트는 [LICENSE](LICENSE) 파일의 조건에 따라 라이선스가 부여됩니다.

---

<p align="center">
  <strong>즐거운 게임 되세요! 🎮</strong>
</p>
