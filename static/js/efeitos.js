const AUDIO_PATHS = {
    background: '/static/sounds/background.mp3',
    countdown: '/static/sounds/countdown.mp3',
    correct: '/static/sounds/correct.mp3',
    wrong: '/static/sounds/wrong.mp3'
};

const AUDIO_STATE_KEY = 'jose-background-audio-state';

function getStoredAudioState() {
    try {
        const raw = sessionStorage.getItem(AUDIO_STATE_KEY);
        if (!raw) {
            return { muted: false, currentTime: 0, volume: 0.35 };
        }
        return JSON.parse(raw);
    } catch (error) {
        console.warn('Não foi possível ler o estado do áudio.', error);
        return { muted: false, currentTime: 0, volume: 0.35 };
    }
}

function saveAudioState() {
    try {
        const audio = audioManager.sounds.background;
        const state = {
            muted: !audioManager.soundEnabled,
            currentTime: audio ? audio.currentTime : 0,
            volume: audio ? audio.volume : 0.35
        };
        sessionStorage.setItem(AUDIO_STATE_KEY, JSON.stringify(state));
    } catch (error) {
        console.warn('Não foi possível salvar o estado do áudio.', error);
    }
}

const audioManager = {
    sounds: {},
    soundEnabled: !getStoredAudioState().muted,

    createAudio(key, { volume = 0.25, loop = false, reset = false } = {}) {
        if (!AUDIO_PATHS[key]) {
            return null;
        }
        let audio = this.sounds[key];
        if (!audio || reset) {
            audio = new Audio(AUDIO_PATHS[key]);
            audio.preload = 'auto';
            audio.loop = loop;
            audio.volume = volume;
            audio.muted = !this.soundEnabled;
            audio.addEventListener('error', () => {
                console.warn(`Áudio '${key}' não pôde ser carregado.`);
            });
            audio.addEventListener('timeupdate', saveAudioState);
            audio.addEventListener('pause', saveAudioState);
            audio.addEventListener('ended', saveAudioState);
            this.sounds[key] = audio;
        }
        audio.loop = loop;
        audio.volume = volume;
        audio.muted = !this.soundEnabled;
        return audio;
    },

    async play(key, { volume = 0.25, loop = false, reset = false } = {}) {
        if (!this.soundEnabled || !AUDIO_PATHS[key]) {
            return null;
        }
        try {
            const audio = this.createAudio(key, { volume, loop, reset });
            if (!audio) {
                return null;
            }
            if (reset) {
                audio.currentTime = 0;
            }
            await audio.play();
            return audio;
        } catch (error) {
            console.warn(`Falha ao reproduzir áudio '${key}':`, error);
            return null;
        }
    },

    async playBackground(volume = 0.25) {
        if (!AUDIO_PATHS.background) {
            return null;
        }
        const audio = this.createAudio('background', { volume, loop: true, reset: false });
        if (!audio) {
            return null;
        }
        const state = getStoredAudioState();
        const targetVolume = Math.max(0, Math.min(1, state.volume || volume));
        audio.loop = true;
        audio.volume = targetVolume;
        audio.muted = !this.soundEnabled;
        if (audio.readyState >= 2) {
            audio.currentTime = state.currentTime || 0;
        } else {
            audio.addEventListener('canplay', () => {
                if (!Number.isNaN(state.currentTime)) {
                    audio.currentTime = state.currentTime || 0;
                }
            }, { once: true });
        }
        if (audio.paused) {
            try {
                await audio.play();
            } catch (error) {
                console.warn('Falha ao iniciar reprodução do background:', error);
            }
        } else {
            fadeAudio(audio, volume, 400);
        }
        return audio;
    },

    stopBackground() {
        const audio = this.sounds.background;
        if (!audio) {
            return;
        }
        fadeAudio(audio, 0, 600);
        setTimeout(() => {
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch (error) {
                console.warn('Erro ao pausar áudio de fundo:', error);
            }
        }, 650);
    },

    async setBackgroundVolume(volume = 0.25, duration = 600) {
        const audio = this.sounds.background;
        if (!audio) {
            return;
        }
        if (!this.soundEnabled) {
            audio.muted = true;
            return;
        }
        audio.muted = false;
        const targetVolume = Math.max(0, Math.min(1, volume));
        fadeAudio(audio, targetVolume, duration);
        if (audio.paused) {
            try {
                await audio.play();
            } catch (error) {
                console.warn('Falha ao reiniciar áudio de fundo:', error);
            }
        }
    },

    setVolume(key, volume) {
        const audio = this.sounds[key];
        if (audio) {
            audio.volume = Math.max(0, Math.min(1, volume));
        }
    },

    async playEffect(key, volume = 0.25) {
        return this.play(key, { volume, loop: false, reset: true });
    },

    setMuted(value) {
        this.soundEnabled = !value;
        Object.values(this.sounds).forEach(audio => {
            audio.muted = value;
        });
        saveAudioState();
    },

    setSoundEnabled(value) {
        this.soundEnabled = value;
        this.setMuted(!value);
    }
};

function fadeAudio(element, targetVolume, duration = 600) {
    if (!element) {
        return;
    }
    const startVolume = element.volume;
    const volumeDelta = targetVolume - startVolume;
    const steps = 20;
    const stepTime = duration / steps;
    let currentStep = 0;

    const intervalId = setInterval(() => {
        currentStep += 1;
        const progress = currentStep / steps;
        element.volume = Math.max(0, Math.min(1, startVolume + volumeDelta * progress));
        if (currentStep >= steps) {
            clearInterval(intervalId);
        }
    }, stepTime);
}

async function playCountdownSound() {
    try {
        await audioManager.playEffect('countdown', 0.35);
    } catch (error) {
        console.warn('Falha ao reproduzir countdown.mp3:', error);
    }
}

async function playCorrectSound() {
    try {
        await audioManager.playEffect('correct', 0.7);
    } catch (error) {
        console.warn('Falha ao reproduzir correct.mp3:', error);
    }
}

async function playWrongSound() {
    try {
        await audioManager.playEffect('wrong', 0.45);
    } catch (error) {
        console.warn('Falha ao reproduzir wrong.mp3:', error);
    }
}

async function playAcceptMusic() {
    try {
        await audioManager.playEffect('correct', 0.7);
    } catch (error) {
        console.warn('Falha ao reproduzir correct.mp3 na aceitação:', error);
    }
}

async function playRevealMusic() {
    if (!audioManager.soundEnabled) {
        return;
    }
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
            return;
        }
        const context = new AudioContext();
        if (context.state === 'suspended') {
            await context.resume().catch(() => {});
        }
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.value = 392;
        gain.gain.setValueAtTime(0, context.currentTime);
        gain.gain.linearRampToValueAtTime(0.08, context.currentTime + 0.1);
        gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.7);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.7);
    } catch (error) {
        console.warn('Falha ao tocar som de revelação.', error);
    }
}

function updateHeartbeatIntensity(level) {
    const audio = audioManager.sounds.background;
    if (audio && audioManager.soundEnabled) {
        const target = 0.25 + Math.min(0.15, level * 0.15);
        fadeAudio(audio, target, 300);
    }
}

async function startBackgroundAudio() {
    if (window.__backgroundAudioStarted) {
        return;
    }
    window.__backgroundAudioStarted = true;
    try {
        await audioManager.playBackground(0.35);
    } catch (error) {
        console.warn('Não foi possível iniciar o áudio de fundo.', error);
    }
}

function initGlobalExperience() {
    const menuToggle = document.getElementById('menuToggle');
    const menuPanel = document.getElementById('menuPanel');
    const menuButtons = Array.from(document.querySelectorAll('#musicToggleMenu'));
    const soundToggle = document.getElementById('soundToggle');

    const toggleMenu = () => {
        menuPanel?.classList.toggle('open');
    };

    menuToggle?.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleMenu();
    });

    document.addEventListener('click', (event) => {
        if (!menuPanel?.contains(event.target) && !menuToggle?.contains(event.target)) {
            menuPanel?.classList.remove('open');
        }
    });

    menuButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const nextState = !audioManager.soundEnabled;
            audioManager.setSoundEnabled(nextState);
            const label = nextState ? '🎵 Música ON' : '🎵 Música OFF';
            button.textContent = label;
            if (soundToggle) {
                soundToggle.textContent = nextState ? '🔊 Ativar Som' : '🔇 Som Desligado';
            }
            menuPanel?.classList.remove('open');
        });
    });

    if (soundToggle) {
        soundToggle.addEventListener('click', () => {
            const nextState = !audioManager.soundEnabled;
            audioManager.setSoundEnabled(nextState);
            soundToggle.textContent = nextState ? '🔊 Som Ligado' : '🔇 Som Desligado';
            soundToggle.classList.toggle('muted', !nextState);
            menuButtons.forEach((button) => {
                button.textContent = nextState ? '🎵 Música ON' : '🎵 Música OFF';
            });
        });
    }

    const tryStartOnInteraction = () => {
        if (!window.__backgroundAudioStarted) {
            startBackgroundAudio();
        }
    };

    window.addEventListener('pointerdown', tryStartOnInteraction, { once: true });
    window.addEventListener('keydown', tryStartOnInteraction, { once: true });
    window.addEventListener('beforeunload', saveAudioState);

    startBackgroundAudio();
}

function launchConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    for (let i = 0; i < 80; i++) {
        const confetti = document.createElement('span');
        confetti.className = 'confetti-piece';
        const size = Math.random() * 10 + 8;
        const hue = Math.round(Math.random() * 240);
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size * 0.35}px`;
        confetti.style.background = `hsl(${hue}, 95%, 65%)`;
        confetti.style.left = `${Math.random() * 100}%`;
        confetti.style.opacity = `${Math.random() * 0.9 + 0.6}`;
        container.appendChild(confetti);
        const fallDuration = Math.random() * 1.4 + 1.6;
        confetti.animate([
            { transform: `translateY(0px) rotate(${Math.random() * 360}deg)`, opacity: 1 },
            { transform: `translateY(120vh) rotate(${Math.random() * 720}deg)`, opacity: 0.2 }
        ], {
            duration: fallDuration * 1000,
            easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
            delay: Math.random() * 400
        });
    }
    setTimeout(() => container.remove(), 4500);
}

function launchFireworks() {
    const container = document.createElement('div');
    container.className = 'fireworks-container';
    document.body.appendChild(container);

    for (let i = 0; i < 12; i++) {
        const spark = document.createElement('span');
        spark.className = 'firework-spark';
        spark.style.left = `${50 + Math.cos((i / 12) * Math.PI * 2) * 35}%`;
        spark.style.top = `${45 + Math.sin((i / 12) * Math.PI * 2) * 20}%`;
        container.appendChild(spark);
        spark.animate([
            { transform: 'translate(0,0) scale(0.6)', opacity: 1 },
            { transform: `translate(${Math.cos((i / 12) * Math.PI * 2) * 60}px, ${Math.sin((i / 12) * Math.PI * 2) * 60}px) scale(1)`, opacity: 0 }
        ], {
            duration: 900,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            delay: i * 40
        });
    }
    setTimeout(() => container.remove(), 1400);
}

function typeLines(lines, target, speed = 50) {
    return new Promise(async (resolve) => {
        target.innerHTML = '';
        for (let line of lines) {
            const paragraph = document.createElement('p');
            paragraph.className = 'suspense-line';
            target.appendChild(paragraph);
            for (let char of line) {
                paragraph.textContent += char;
                await new Promise((r) => setTimeout(r, speed));
            }
            paragraph.classList.add('visible');
            await new Promise((r) => setTimeout(r, 450));
        }
        resolve();
    });
}

window.addEventListener('DOMContentLoaded', initGlobalExperience);
