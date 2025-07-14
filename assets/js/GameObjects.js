class Document {
    constructor(x, y, size, color, lifespan) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.color = color;
        this.lifespan = lifespan;
        this.age = 0;
        this.clicked = false;
        this.explosionParticles = [];
        this.sinking = false;
        this.sinkSpeed = 2;
        this.originalY = y;
        
        // 움직임 속성 추가
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.bounceDamping = 0.8;
    }

    update() {
        this.age++;
        
        if (this.clicked) {
            // 파티클 생성은 Game 클래스에서 처리하므로, 여기서는 단순히 소멸되도록 함
            return false;
        }
        
        if (this.age >= this.lifespan && !this.sinking) {
            this.sinking = true;
            this.y = canvas.height - this.size;
        }
        
        if (this.sinking) {
            return false;
        }
        
        // 움직임 업데이트
        this.x += this.vx;
        this.y += this.vy;
        
        // 벽면 충돌 처리
        if (this.x <= 0 || this.x >= canvas.width - this.size) {
            this.vx *= -this.bounceDamping;
            this.x = Math.max(0, Math.min(canvas.width - this.size, this.x));
        }
        
        if (this.y <= 80 || this.y >= canvas.height - this.size) {
            this.vy *= -this.bounceDamping;
            this.y = Math.max(80, Math.min(canvas.height - this.size, this.y));
        }
        
        return true;
    }

    click() {
        if (this.clicked) return false;
        
        this.clicked = true;
        // 통합 파티클 시스템으로 폭발 효과 생성
        game.createParticles(this.x, this.y, this.size, this.color);
        
        if (audioManager && !audioManager.isMutedState()) {
            audioManager.playExplosionSound();
        }
        
        return true;
    }

    getScore() {
        const sizeMultiplier = Math.max(0.5, (70 - this.size) / 40);
        const timeMultiplier = Math.max(0.5, (180 - this.lifespan) / 120);
        return Math.round(20 * sizeMultiplier * timeMultiplier);
    }

    draw(ctx) {
        if (this.clicked) {
            // 파티클 렌더링은 Game 클래스에서 처리
            return;
        }
        
        ctx.save();
        
        const alpha = this.sinking ? 0.3 : Math.max(0.3, 1 - this.age / this.lifespan);
        ctx.globalAlpha = alpha;
        
        // 3D 입체감 효과를 위한 그림자 추가
        const centerX = this.x + this.size / 2;
        const centerY = this.y + this.size / 2;
        
        // 그림자 렌더링
        ctx.save();
        ctx.globalAlpha = alpha * 0.3;
        ctx.filter = 'blur(2px)';
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        ctx.fillText('📄', centerX + 3, centerY + 3);
        ctx.restore();
        
        // 메인 문서 렌더링 (입체감을 위한 그라데이션 효과)
        ctx.filter = `hue-rotate(${this.color.replace('#', '')}) saturate(150%) drop-shadow(2px 2px 4px rgba(0,0,0,0.3))`;
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = this.color;
        ctx.fillText('📄', centerX, centerY);
        
        ctx.restore();
    }

    isClicked(mouseX, mouseY) {
        return mouseX >= this.x && mouseX <= this.x + this.size &&
               mouseY >= this.y && mouseY <= this.y + this.size;
    }
}

class AIDocument extends Document {
    constructor(x, y, size) {
        super(x, y, size, '#00FF00', 300);
        this.pulsePhase = 0;
        this.scoreValue = 30;
    }

    update() {
        this.age++;
        this.pulsePhase += 0.1;
        return this.age < this.lifespan && !this.clicked;
    }

    draw(ctx) {
        if (this.clicked) return;

        const alpha = Math.max(0, 1 - (this.age / this.lifespan) * 0.5);
        const pulse = Math.sin(this.pulsePhase) * 0.3 + 0.7;
        const baseAlpha = alpha * pulse;

        const centerX = this.x + this.size / 2;
        const centerY = this.y + this.size / 2;

        // AI 글로우 효과
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.4;
        ctx.filter = 'blur(4px)';
        ctx.font = `${this.size + 8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#00FF00';
        ctx.fillText('🤖', centerX, centerY);
        ctx.restore();
        
        // 그림자 효과
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.3;
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        ctx.fillText('🤖', centerX + 2, centerY + 2);
        ctx.restore();
        
        // 메인 AI 로봇 (입체감을 위한 그라데이션 효과)
        ctx.save();
        ctx.globalAlpha = baseAlpha;
        ctx.filter = 'drop-shadow(1px 1px 3px rgba(0,0,0,0.5))';
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#00FF00';
        ctx.fillText('🤖', centerX, centerY);
        ctx.restore();
    }

    getScore() {
        return this.scoreValue;
    }
}

class MailDocument extends Document {
    constructor(x, y, size) {
        super(x, y, size, '#4A90E2', 240);
        this.scoreValue = 15;
        this.twinkle = 0;
    }

    update() {
        this.age++;
        this.twinkle += 0.08;
        
        if (this.clicked) {
            return false;
        }
        
        if (this.age >= this.lifespan) {
            return false;
        }
        
        return true;
    }

    draw(ctx) {
        ctx.save();
        
        const baseAlpha = 0.7 + 0.3 * Math.sin(this.twinkle);
        const centerX = this.x + this.size / 2;
        const centerY = this.y + this.size / 2;
        
        // 메일 주변 글로우 효과
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.4;
        ctx.filter = 'blur(4px)';
        ctx.font = `${this.size + 8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#4A90E2';
        ctx.fillText('📧', centerX, centerY);
        ctx.restore();
        
        // 그림자 효과
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.3;
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        ctx.fillText('📧', centerX + 2, centerY + 2);
        ctx.restore();
        
        // 메인 메일 (입체감을 위한 그라데이션 효과)
        ctx.globalAlpha = baseAlpha;
        ctx.filter = 'drop-shadow(1px 1px 3px rgba(0,0,0,0.5))';
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#4A90E2';
        ctx.fillText('📧', centerX, centerY);
        
        ctx.restore();
    }

    getScore() {
        return this.scoreValue;
    }
}

class BombDocument extends Document {
    constructor(x, y, size) {
        super(x, y, size, '#FF0000', 180);
        this.fuseLength = Math.random() * 0.3 + 0.7;
        this.isExploding = false;
        this.explosionRadius = 0;
        this.maxExplosionRadius = 150;
        this.explosionParticles = [];
    }

    update() {
        this.age++;
        
        if (this.isExploding) {
            this.explosionRadius += 8;
            
            // 폭발 파티클 업데이트
            this.explosionParticles.forEach(particle => {
                particle.x += particle.vx;
                particle.y += particle.vy;
                particle.life--;
                particle.size *= 0.98;
            });
            
            this.explosionParticles = this.explosionParticles.filter(p => p.life > 0);
            
            if (this.explosionRadius >= this.maxExplosionRadius) {
                return false;
            }
        } else if (this.clicked) {
            this.explode();
        } else if (this.age >= this.lifespan * this.fuseLength) {
            this.explode();
        }
        
        return true;
    }

    draw(ctx) {
        ctx.save();
        
        const centerX = this.x + this.size / 2;
        const centerY = this.y + this.size / 2;
        const radius = this.size / 2;
        
        // 그림자 효과
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.filter = 'blur(3px)';
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(centerX + 3, centerY + 3, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        // 외곽 테두리 (입체감)
        ctx.save();
        ctx.strokeStyle = '#CCCCCC';
        ctx.lineWidth = 2;
        ctx.filter = 'drop-shadow(1px 1px 2px rgba(0,0,0,0.3))';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        
        // 원형 클리핑 마스크 생성
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.clip();
        
        // 폭탄 배경 (메탈릭 효과)
        const gradient = ctx.createRadialGradient(centerX - radius/3, centerY - radius/3, 0, centerX, centerY, radius);
        gradient.addColorStop(0, '#888888');
        gradient.addColorStop(0.7, '#444444');
        gradient.addColorStop(1, '#222222');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 폭탄 이모지
        ctx.font = `${this.size * 0.6}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        ctx.fillText('💣', centerX, centerY);
        
        // 도화선 깜빡임 효과
        const fuseProgress = this.age / (this.lifespan * this.fuseLength);
        if (fuseProgress > 0.5) {
            const blinkSpeed = Math.min(20, (fuseProgress - 0.5) * 40);
            const alpha = (Math.sin(this.age * blinkSpeed / 10) + 1) / 2;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#FF0000';
            ctx.font = `${this.size * 0.2}px Arial`;
            ctx.fillText('⚡', centerX, centerY - radius * 0.8);
        }
        
        ctx.restore();
        
        // 폭발 효과 렌더링
        if (this.isExploding) {
            this.drawExplosion(ctx);
        }
    }

    drawExplosion(ctx) {
        const centerX = this.x + this.size / 2;
        const centerY = this.y + this.size / 2;
        
        // 폭발 원형 파장
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - this.explosionRadius / this.maxExplosionRadius);
        
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, this.explosionRadius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.3, 'rgba(255, 200, 0, 0.6)');
        gradient.addColorStop(0.6, 'rgba(255, 100, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.explosionRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        // 폭발 파티클 렌더링
        this.explosionParticles.forEach(particle => {
            ctx.save();
            ctx.globalAlpha = particle.life / 30;
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    explode() {
        if (this.isExploding) return;
        
        this.isExploding = true;
        
        // 폭발 파티클 생성
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 / 20) * i;
            const speed = Math.random() * 5 + 3;
            this.explosionParticles.push({
                x: this.x + this.size / 2,
                y: this.y + this.size / 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 4 + 2,
                life: 30,
                color: ['#FF0000', '#FF8800', '#FFFF00', '#FFFFFF'][Math.floor(Math.random() * 4)]
            });
        }
        
        // 폭발음 재생
        if (window.audioManager) {
            audioManager.playExplosionSound();
        }
    }

    getScore() {
        return -50;
    }

    isInExplosionRange(x, y) {
        if (!this.isExploding) return false;
        
        const centerX = this.x + this.size / 2;
        const centerY = this.y + this.size / 2;
        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        
        return distance <= this.explosionRadius;
    }
}

class AIItem {
    constructor(x, y, size, lifespan) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.lifespan = lifespan;
        this.age = 0;
        this.clicked = false;
        this.pulsePhase = 0;
    }

    update() {
        this.age++;
        this.pulsePhase += 0.1;
        return this.age < this.lifespan && !this.clicked;
    }

    draw(ctx) {
        if (this.clicked) return;

        const alpha = Math.max(0, 1 - (this.age / this.lifespan) * 0.5);
        const pulse = Math.sin(this.pulsePhase) * 0.3 + 0.7;
        const baseAlpha = alpha * pulse;

        const centerX = this.x + this.size / 2;
        const centerY = this.y + this.size / 2;

        // AI 글로우 효과
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.4;
        ctx.filter = 'blur(4px)';
        ctx.font = `${this.size + 8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#00FF00';
        ctx.fillText('🤖', centerX, centerY);
        ctx.restore();
        
        // 그림자 효과
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.3;
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        ctx.fillText('🤖', centerX + 2, centerY + 2);
        ctx.restore();
        
        // 메인 AI (입체감을 위한 그라데이션 효과)
        ctx.globalAlpha = baseAlpha;
        ctx.filter = 'drop-shadow(1px 1px 3px rgba(0,0,0,0.5))';
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 하이라이트 효과
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.8;
        ctx.fillStyle = '#90EE90';
        ctx.fillText('🤖', centerX - 0.5, centerY - 0.5);
        ctx.restore();
        
        // 메인 AI
        ctx.fillStyle = '#00FF00';
        ctx.fillText('🤖', centerX, centerY);
        
        ctx.restore();
    }

    isClicked(x, y) {
        return x >= this.x && x <= this.x + this.size &&
               y >= this.y && y <= this.y + this.size && !this.clicked;
    }
}

class Star {
    constructor(x, y, size, lifespan) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.lifespan = lifespan;
        this.age = 0;
        this.clicked = false;
        this.vx = (Math.random() - 0.5) * 1;
        this.vy = (Math.random() - 0.5) * 1;
        this.bounceDamping = 0.9;
        this.twinkle = 0;
    }

    update() {
        this.age++;
        this.twinkle += 0.2;
        
        if (this.clicked || this.age >= this.lifespan) {
            return false;
        }
        
        this.x += this.vx;
        this.y += this.vy;
        
        if (this.x <= 0 || this.x >= canvas.width - this.size) {
            this.vx *= -this.bounceDamping;
            this.x = Math.max(0, Math.min(canvas.width - this.size, this.x));
        }
        
        if (this.y <= 80 || this.y >= canvas.height - this.size) {
            this.vy *= -this.bounceDamping;
            this.y = Math.max(80, Math.min(canvas.height - this.size, this.y));
        }
        
        return true;
    }

    draw(ctx) {
        ctx.save();
        
        const baseAlpha = 1.0;
        const centerX = this.x + this.size / 2;
        const centerY = this.y + this.size / 2;
        
        // 메일 주변 글로우 효과
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.4;
        ctx.filter = 'blur(4px)';
        ctx.font = `${this.size + 8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#4A90E2';
        ctx.fillText('📧', centerX, centerY);
        ctx.restore();
        
        // 그림자 효과
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.3;
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        ctx.fillText('📧', centerX + 2, centerY + 2);
        ctx.restore();
        
        // 메인 메일 (입체감을 위한 그라데이션 효과)
        ctx.globalAlpha = baseAlpha;
        ctx.filter = 'drop-shadow(1px 1px 3px rgba(0,0,0,0.5))';
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 하이라이트 효과
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.8;
        ctx.fillStyle = '#87CEEB';
        ctx.fillText('📧', centerX - 0.5, centerY - 0.5);
        ctx.restore();
        
        // 메인 메일
        ctx.fillStyle = '#4A90E2';
        ctx.fillText('📧', centerX, centerY);
        
        ctx.restore();
    }

    isClicked(mouseX, mouseY) {
        return mouseX >= this.x && mouseX <= this.x + this.size &&
               mouseY >= this.y && mouseY <= this.y + this.size;
    }
}

class Newbie {
    constructor(x, y, size, lifespan) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.lifespan = lifespan;
        this.age = 0;
        this.clicked = false;
        this.pulsePhase = 0;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5;
        this.bounceDamping = 0.8;
        this.newbieType = Math.floor(Math.random() * 2);
        this.newbieImage = null;
    }

    update() {
        this.age++;
        this.pulsePhase += 0.15;
        
        if (this.clicked || this.age >= this.lifespan) {
            return false;
        }
        
        this.x += this.vx;
        this.y += this.vy;
        
        if (this.x <= 0 || this.x >= canvas.width - this.size) {
            this.vx *= -this.bounceDamping;
            this.x = Math.max(0, Math.min(canvas.width - this.size, this.x));
        }
        
        if (this.y <= 80 || this.y >= canvas.height - this.size) {
            this.vy *= -this.bounceDamping;
            this.y = Math.max(80, Math.min(canvas.height - this.size, this.y));
        }
        
        return true;
    }

    draw(ctx) {
        if (this.clicked) return;

        const alpha = 1.0;
        const pulse = 1.0;
        const baseAlpha = alpha * pulse;

        const centerX = this.x + this.size / 2;
        const centerY = this.y + this.size / 2;
        const radius = this.size / 2;

        // 그림자 효과
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.3;
        ctx.filter = 'blur(3px)';
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(centerX + 3, centerY + 3, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = baseAlpha;

        // 원형 클리핑 마스크
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.clip();
        
        // 메인 이미지 렌더링
        if (this.newbieImage && this.newbieImage.complete) {
            ctx.drawImage(this.newbieImage, this.x, this.y, this.size, this.size);
        } else {
            // 이미지가 로드되지 않았을 때 fallback으로 색상 원 표시
            ctx.fillStyle = '#FF6B6B';
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * 0.8, 0, Math.PI * 2);
            ctx.fill();
            
            // 텍스트로 "신입" 표시
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `${this.size * 0.3}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('신입', centerX, centerY);
        }
        
        ctx.restore();
        
        // 하이라이트 효과 (입체감 강화)
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.6;
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = Math.max(1, this.size / 20);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    isClicked(mouseX, mouseY) {
        return mouseX >= this.x && mouseX <= this.x + this.size &&
               mouseY >= this.y && mouseY <= this.y + this.size;
    }
}

