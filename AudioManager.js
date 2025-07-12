/**
 * AudioManager.js
 * 게임의 모든 오디오 관련 기능을 관리하는 클래스
 * 
 * 주요 기능:
 * - 배경음악 재생/정지
 * - 효과음 재생 (보스, 신입, 폭탄, 총 소리 등)
 * - 음량 조절
 * - 음소거 기능
 */

class AudioManager {
    constructor() {
        // 배경음악 설정
        this.BACKGROUND_MUSIC_COUNT = 10; // 음악 파일 갯수 (0~9)
        
        // 오디오 컨텍스트 및 상태 변수들
        this.audioContext = null;
        this.isMuted = false;
        this.currentMusicIndex = -1;
        this.previousMusicIndex = -1;
        this.isMusicPlaying = false;
        this.isMusicPaused = false;
        
        // 효과음 오디오 요소들
        this.soundElements = {
            backgroundMusic: null,
            bossAppearSound0: null,
            bossAppearSound1: null,
            newbieAppearSound0: null,
            newbieAppearSound1: null,
            goodByeSound: null,
            explosionSound: null,
            gunSound: null,
            gunModeLoopSound: null,
            goodJobSound: null,
            ohNoSound: null,
            alarmSound: null
        };
        
        this.initializeAudioElements();
    }
    
    /**
     * 오디오 요소들을 초기화합니다
     */
    initializeAudioElements() {
        // HTML에서 오디오 요소들을 가져와서 저장
        this.soundElements.backgroundMusic = document.getElementById('backgroundMusic');
        this.soundElements.bossAppearSound0 = document.getElementById('bossAppearSound0');
        this.soundElements.bossAppearSound1 = document.getElementById('bossAppearSound1');
        this.soundElements.newbieAppearSound0 = document.getElementById('newbieAppearSound0');
        this.soundElements.newbieAppearSound1 = document.getElementById('newbieAppearSound1');
        this.soundElements.goodByeSound = document.getElementById('goodByeSound');
        this.soundElements.explosionSound = document.getElementById('explosionSound');
        this.soundElements.gunSound = document.getElementById('gunSound');
        this.soundElements.gunModeLoopSound = document.getElementById('gunModeLoopSound');
        this.soundElements.goodJobSound = document.getElementById('goodJobSound');
        this.soundElements.ohNoSound = document.getElementById('ohNoSound');
        this.soundElements.alarmSound = document.getElementById('alarmSound');
    }
    
    /**
     * 오디오 컨텍스트를 초기화합니다
     */
    initAudio() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }
    
    /**
     * 랜덤 배경음악 인덱스를 선택합니다 (이전 음악과 다른 것으로)
     * @returns {number} 새로운 음악 인덱스
     */
    getRandomMusicIndex() {
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * this.BACKGROUND_MUSIC_COUNT);
        } while (newIndex === this.previousMusicIndex && this.BACKGROUND_MUSIC_COUNT > 1);
        return newIndex;
    }
    
    /**
     * 랜덤 배경음악을 로드하고 재생합니다
     */
    playRandomBackgroundMusic() {
        const backgroundMusic = this.soundElements.backgroundMusic;
        if (!backgroundMusic) {
            console.error('배경음악 요소를 찾을 수 없습니다');
            return;
        }
        
        // 현재 음악 정지
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
        
        // 새로운 음악 선택
        this.previousMusicIndex = this.currentMusicIndex;
        this.currentMusicIndex = this.getRandomMusicIndex();
        
        // 음악 파일 소스 설정
        const musicPath = `assets/audio/music/background_music_${this.currentMusicIndex}.mp3`;
        backgroundMusic.src = musicPath;
        backgroundMusic.volume = 0.3;
        
        if (!this.isMuted) {
            backgroundMusic.play().catch(error => {
                console.error("배경음악 재생 실패:", error);
            });
            this.isMusicPlaying = true;
        } else {
            this.isMusicPlaying = false;
        }
    }
    
    /**
     * 오디오 컨텍스트를 사용하여 신시사이저 소리를 재생합니다
     * @param {number} frequency - 주파수 (Hz)
     * @param {number} duration - 재생 시간 (초)
     * @param {string} type - 오실레이터 타입 ('sine', 'square', 'triangle', 'sawtooth')
     */
    playSound(frequency, duration, type = 'sine') {
        if (this.isMuted || !this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    /**
     * 보스 등장 효과음을 재생합니다
     */
    playBossAppearSound() {
        if (this.isMuted) return;
        
        // 랜덤하게 두 개의 보스 등장 소리 중 하나 선택
        const soundIndex = Math.floor(Math.random() * 2);
        const soundElement = soundIndex === 0 ? 
            this.soundElements.bossAppearSound0 : 
            this.soundElements.bossAppearSound1;
            
        if (soundElement) {
            soundElement.currentTime = 0;
            soundElement.volume = 0.5;
            soundElement.play().catch(e => console.log('보스 등장 소리 재생 실패:', e));
        }
    }
    
    /**
     * 신입사원 등장 효과음을 재생합니다
     */
    playNewbieAppearSound() {
        if (this.isMuted) return;
        
        // 랜덤하게 두 개의 신입사원 등장 소리 중 하나 선택
        const soundIndex = Math.floor(Math.random() * 2);
        const soundElement = soundIndex === 0 ? 
            this.soundElements.newbieAppearSound0 : 
            this.soundElements.newbieAppearSound1;
            
        if (soundElement) {
            soundElement.currentTime = 0;
            soundElement.volume = 0.5;
            soundElement.play().catch(e => console.log('신입사원 등장 소리 재생 실패:', e));
        }
    }
    
    /**
     * 폭탄 폭발 효과음을 재생합니다
     */
    playExplosionSound() {
        if (this.isMuted) return;
        
        const explosionSound = this.soundElements.explosionSound;
        if (explosionSound) {
            explosionSound.currentTime = 0;
            explosionSound.volume = 0.3;
            explosionSound.play().catch(e => console.log('폭발 소리 재생 실패:', e));
        }
    }
    
    /**
     * 총 발사 효과음을 재생합니다
     */
    playGunSound() {
        if (this.isMuted) return;
        
        const gunSound = this.soundElements.gunSound;
        if (gunSound) {
            gunSound.currentTime = 0;
            gunSound.volume = 0.4;
            gunSound.play().catch(e => console.log('총 소리 재생 실패:', e));
        }
    }
    
    /**
     * 기관총 연속 소리를 시작합니다
     */
    startGunModeLoopSound() {
        if (this.isMuted) return;
        
        const gunModeLoopSound = this.soundElements.gunModeLoopSound;
        if (gunModeLoopSound) {
            gunModeLoopSound.currentTime = 0;
            gunModeLoopSound.volume = 0.2;
            gunModeLoopSound.play().catch(e => console.log('기관총 소리 재생 실패:', e));
        }
    }
    
    /**
     * 기관총 연속 소리를 정지합니다
     */
    stopGunModeLoopSound() {
        const gunModeLoopSound = this.soundElements.gunModeLoopSound;
        if (gunModeLoopSound) {
            gunModeLoopSound.pause();
            gunModeLoopSound.currentTime = 0;
        }
    }
    
    /**
     * 성공 효과음을 재생합니다 (좋았어!)
     */
    playGoodJobSound() {
        if (this.isMuted) return;
        
        const goodJobSound = this.soundElements.goodJobSound;
        if (goodJobSound) {
            goodJobSound.currentTime = 0;
            goodJobSound.volume = 0.5;
            goodJobSound.play().catch(e => console.log('성공 소리 재생 실패:', e));
        }
    }
    
    /**
     * 실패 효과음을 재생합니다 (아안돼!)
     */
    playOhNoSound() {
        if (this.isMuted) return;
        
        const ohNoSound = this.soundElements.ohNoSound;
        if (ohNoSound) {
            ohNoSound.currentTime = 0;
            ohNoSound.volume = 0.5;
            ohNoSound.play().catch(e => console.log('실패 소리 재생 실패:', e));
        }
    }
    
    /**
     * 경보음을 재생합니다
     */
    playAlarmSound() {
        if (this.isMuted) return;
        
        const alarmSound = this.soundElements.alarmSound;
        if (alarmSound) {
            alarmSound.currentTime = 0;
            alarmSound.volume = 0.4;
            alarmSound.play().catch(e => console.log('경보음 재생 실패:', e));
        }
    }
    
    /**
     * 작별 인사 효과음을 재생합니다
     */
    playGoodByeSound() {
        if (this.isMuted) return;
        
        const goodByeSound = this.soundElements.goodByeSound;
        if (goodByeSound) {
            goodByeSound.currentTime = 0;
            goodByeSound.volume = 0.5;
            goodByeSound.play().catch(e => console.log('작별 소리 재생 실패:', e));
        }
    }
    
    /**
     * 음소거 상태를 토글합니다
     */
    toggleMute() {
        this.isMuted = !this.isMuted;
        const muteButton = document.getElementById('muteButton');
        
        // 모든 오디오 요소들을 음소거 처리
        Object.values(this.soundElements).forEach(element => {
            if (element) {
                element.muted = this.isMuted;
            }
        });
        
        if (muteButton) {
            muteButton.textContent = this.isMuted ? '🔇' : '🔊';
        }
        
        // 배경음악 재생 상태 업데이트
        if (this.isMuted) {
            this.isMusicPlaying = false;
        } else if (this.soundElements.backgroundMusic && this.soundElements.backgroundMusic.src) {
            this.soundElements.backgroundMusic.play().catch(error => {
                console.error("배경음악 재생 실패:", error);
            });
            this.isMusicPlaying = true;
        }
    }
    
    /**
     * 배경음악을 일시정지합니다
     */
    pauseBackgroundMusic() {
        const backgroundMusic = this.soundElements.backgroundMusic;
        if (backgroundMusic && !backgroundMusic.paused) {
            backgroundMusic.pause();
            this.isMusicPaused = true;
            this.isMusicPlaying = false;
        }
    }
    
    /**
     * 배경음악을 재개합니다
     */
    resumeBackgroundMusic() {
        const backgroundMusic = this.soundElements.backgroundMusic;
        if (backgroundMusic && this.isMusicPaused && !this.isMuted) {
            backgroundMusic.play().catch(error => {
                console.error("배경음악 재개 실패:", error);
            });
            this.isMusicPaused = false;
            this.isMusicPlaying = true;
        }
    }
    
    /**
     * 모든 오디오를 정지합니다
     */
    stopAllSounds() {
        Object.values(this.soundElements).forEach(element => {
            if (element) {
                element.pause();
                element.currentTime = 0;
            }
        });
        this.isMusicPlaying = false;
        this.isMusicPaused = false;
    }
    
    /**
     * 현재 음소거 상태를 반환합니다
     * @returns {boolean} 음소거 상태
     */
    isMutedState() {
        return this.isMuted;
    }
    
    /**
     * 배경음악 재생 상태를 반환합니다
     * @returns {boolean} 배경음악 재생 상태
     */
    isMusicPlayingState() {
        return this.isMusicPlaying;
    }
    
    /**
     * 특정 볼륨으로 배경음악 볼륨을 설정합니다
     * @param {number} volume - 볼륨 (0.0 ~ 1.0)
     */
    setBackgroundMusicVolume(volume) {
        const backgroundMusic = this.soundElements.backgroundMusic;
        if (backgroundMusic && volume >= 0 && volume <= 1) {
            backgroundMusic.volume = volume;
        }
    }
    
    /**
     * 모든 효과음의 볼륨을 설정합니다
     * @param {number} volume - 볼륨 (0.0 ~ 1.0)
     */
    setSoundEffectsVolume(volume) {
        if (volume < 0 || volume > 1) return;
        
        // backgroundMusic을 제외한 모든 효과음 볼륨 설정
        Object.keys(this.soundElements).forEach(key => {
            if (key !== 'backgroundMusic' && this.soundElements[key]) {
                this.soundElements[key].volume = volume;
            }
        });
    }
}

// 전역 AudioManager 인스턴스 생성
let audioManager = null;

// 페이지 로드 시 AudioManager 초기화
document.addEventListener('DOMContentLoaded', () => {
    audioManager = new AudioManager();
});

// 호환성을 위해 기존 함수들을 AudioManager로 리다이렉트하는 래퍼 함수들
function initAudio() {
    if (audioManager) {
        audioManager.initAudio();
    }
}

function playRandomBackgroundMusic() {
    if (audioManager) {
        audioManager.playRandomBackgroundMusic();
    }
}

function playSound(frequency, duration, type = 'sine') {
    if (audioManager) {
        audioManager.playSound(frequency, duration, type);
    }
}

function toggleMute() {
    if (audioManager) {
        audioManager.toggleMute();
    }
}