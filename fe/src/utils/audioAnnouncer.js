
class AudioAnnouncer {
    constructor() {
        this.enabled = true
        this.audioCtx = null
        this.vietnameseVoice = null

        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            this.initVoices()
            window.speechSynthesis.onvoiceschanged = () => {
                this.initVoices()
            }
        }
    }

    initVoices() {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
        const voices = window.speechSynthesis.getVoices() || []
        if (voices.length === 0) return

        const viVoice = voices.find(
            (v) =>
                v.lang === 'vi-VN' ||
                v.lang === 'vi_VN' ||
                v.lang.toLowerCase().startsWith('vi') ||
                /vietnam|tiếng việt|hoaimy|namminh|an/i.test(v.name)
        )

        if (viVoice) {
            this.vietnameseVoice = viVoice
        }
    }

    setEnabled(val) {
        this.enabled = Boolean(val)
    }

    isEnabled() {
        return this.enabled
    }

    getAudioContext() {
        if (!this.audioCtx && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext
            this.audioCtx = new AudioContextClass()
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume()
        }
        return this.audioCtx
    }

    playChime() {
        try {
            const ctx = this.getAudioContext()
            if (!ctx) return Promise.resolve()

            const now = ctx.currentTime
            const osc1 = ctx.createOscillator()
            const gain1 = ctx.createGain()
            osc1.type = 'sine'
            osc1.frequency.setValueAtTime(698.46, now)
            gain1.gain.setValueAtTime(0.25, now)
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
            osc1.connect(gain1)
            gain1.connect(ctx.destination)
            osc1.start(now)
            osc1.stop(now + 0.5)

            const osc2 = ctx.createOscillator()
            const gain2 = ctx.createGain()
            osc2.type = 'sine'
            osc2.frequency.setValueAtTime(880, now + 0.25)
            gain2.gain.setValueAtTime(0.3, now + 0.25)
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9)
            osc2.connect(gain2)
            gain2.connect(ctx.destination)
            osc2.start(now + 0.25)
            osc2.stop(now + 0.9)

            return new Promise((resolve) => setTimeout(resolve, 650))
        } catch {
            return Promise.resolve()
        }
    }

    async announcePatient(patientName, ticketNumber, roomName = 'buồng khám số 1') {
        if (!this.enabled || typeof window === 'undefined') return

        await this.playChime()

        if ('speechSynthesis' in window) {
            try {
                window.speechSynthesis.cancel()

                if (!this.vietnameseVoice) {
                    this.initVoices()
                }

                const cleanName = (patientName || 'Bệnh nhân')
                    .replace(/\s*\(.*?\)\s*/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()

                const cleanTicket = (ticketNumber || '')
                    .replace(/-/g, ' ')
                    .trim()

                const cleanRoom = (roomName || 'buồng khám')
                    .replace(/\s*\(P\d+\)\s*/i, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()

                const announcementText = `Mời bệnh nhân ${cleanName}, số thứ tự ${cleanTicket}, vào ${cleanRoom}.`

                const utterance = new SpeechSynthesisUtterance(announcementText)
                utterance.lang = 'vi-VN'
                utterance.rate = 0.92
                utterance.pitch = 1.02

                if (this.vietnameseVoice) {
                    utterance.voice = this.vietnameseVoice
                } else {
                    const currentVoices = window.speechSynthesis.getVoices() || []
                    const foundVi = currentVoices.find(
                        (v) =>
                            v.lang === 'vi-VN' ||
                            v.lang === 'vi_VN' ||
                            v.lang.toLowerCase().startsWith('vi') ||
                            /vietnam|tiếng việt|hoaimy|namminh|an/i.test(v.name)
                    )
                    if (foundVi) {
                        this.vietnameseVoice = foundVi
                        utterance.voice = foundVi
                    }
                }

                window.speechSynthesis.speak(utterance)
            } catch (err) {
                console.warn('Lỗi phát âm thanh gọi số:', err)
            }
        }
    }
}

export const audioAnnouncer = new AudioAnnouncer()
