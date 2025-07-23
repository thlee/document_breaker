# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"문서 파괴자 (Document Breaker)" is a Korean office survival HTML5 Canvas game where players click to destroy documents before they stack up and the boss appears. It's a real-time web game with Firebase backend integration for leaderboards and chat functionality.

## Development Commands

### Firebase Functions (Backend)
```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Start local Firebase emulator for development
npm run serve

# Deploy Firebase functions to production
npm run deploy

# View function logs
npm run logs
```

### Frontend Development
The frontend is a static web application served directly. For development:
- Open `index.html` in a web browser, or
- Use a local web server like `python -m http.server 8000` or `npx serve .`

### Firebase Hosting
```bash
# Deploy to Firebase Hosting
firebase deploy --only hosting

# Deploy everything (functions + hosting)
firebase deploy
```

## Architecture Overview

### Frontend Structure
- **`index.html`** - Main game HTML with embedded Firebase configuration
- **`assets/js/main.js`** - Entry point, Firebase initialization, global event handlers
- **`assets/js/Game.js`** - Main game engine with game loop, state management, and rendering
- **`assets/js/GameObjects.js`** - Game entity classes (Document, Newbie, Star, AIItem, etc.)
- **`assets/js/AudioManager.js`** - Audio system for background music and sound effects
- **`assets/js/UI.js`** - User interface management and DOM interactions
- **`assets/js/Chat.js`** - Real-time chat system integration
- **`assets/js/LeaderBoard.js`** - Leaderboard display and score submission

### Backend (Firebase Functions)
Located in `functions/index.js`:
- **`submitScore`** - Handles score submission with top-50 ranking system
- **`sendChatMessage`** - Chat message handling with rate limiting and spam protection
- **`deleteChatMessage`** - Community-based message deletion system
- **`getChatMessages`** - Chat message retrieval with pagination

### Game Architecture Patterns

**Entity-Component System**: Game objects inherit from base classes with specialized behavior:
- `Document` - Base clickable document class with physics and rendering
- `AIItem` - Special power-up items for AI assistance mode
- `Star` - Job change items that clear stacked documents
- `Newbie` - Penalty objects that add more documents when clicked
- `BombDocument` - Timed explosive documents with countdown mechanics

**State Management**: Game state managed in `Game` class with clear separation:
- Game running state (`gameRunning`, `gameOver`, `paused`)
- Special modes (`isGunMode`, `blockBreakerMode`, `bombDocument`)
- Spawn timers and difficulty scaling based on score
- AI token system for power-ups

**Audio System**: Centralized audio management with:
- Background music rotation system
- Context-aware sound effects for different game events
- Mute/unmute functionality with persistent state

### Firebase Integration

**Configuration**: Firebase config embedded in `main.js` with Asia Northeast region:
```javascript
const functions = firebase.app().functions('asia-northeast1');
```

**Firestore Collections**:
- `scores` - Top 50 player scores with country flags and timestamps
- `chat` - Chat messages with vote-based deletion system

**Security Features**:
- Rate limiting for score submissions and chat messages
- Input validation and sanitization
- Country detection via IP geolocation
- Duplicate score prevention

### Internationalization

**Language System**: Located in `lang/` directory:
- `ko.json` - Korean translations (primary)
- `en.json` - English translations
- Auto-detection based on user location
- Fallback to Korean for unsupported regions

### Asset Organization

**Static Assets**:
- `assets/audio/` - Sound effects and background music files
- `assets/images/` - Game sprites, backgrounds, and character images
- `assets/css/` - Game styling and responsive design
- `assets/icons/` - Favicon and PWA icons

## Key Game Mechanics

### Difficulty Scaling
Dynamic difficulty adjustment based on score:
- Document spawn rate increases with score
- Document lifespan decreases as score increases
- Special event frequency scales with performance

### Special Game Modes
- **AI Gun Mode** - 5-second rapid-fire mode activated with AI tokens
- **Block Breaker Mode** - Boss special mode with physics-based ball mechanics
- **Bomb Defusal** - Timed challenge events with countdown mechanics

### Real-time Features
- Live leaderboard updates every 30 seconds
- Real-time chat with community moderation
- Automatic country flag detection for international players

## Firebase Functions Development

**Environment**: Node.js 22 with Firebase Functions v2 API
**Region**: asia-northeast1 for optimal performance in Asia
**Rate Limiting**: In-memory rate limiting with cleanup intervals
**Error Handling**: Comprehensive error handling with user-friendly messages

When modifying Firebase functions:
1. Test locally with `npm run serve` in the functions directory
2. Functions use Korean language for user-facing messages
3. All functions implement rate limiting and input validation
4. Use `HttpsError` for user-facing errors

## Development Notes

- Game uses HTML5 Canvas for rendering with 60fps game loop
- All text is in Korean - consider this when making UI changes
- Firebase security rules are in `functions/firestore.rules`
- Game supports responsive design for mobile devices
- Audio requires user interaction to start (browser autoplay policies)