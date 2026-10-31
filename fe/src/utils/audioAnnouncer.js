/**
 * Tiện ích phát âm thanh loa thông báo buồng khám phòng khám (tClinic & Hospital Queue Audio Call)
 * Sử dụng Web Audio API để tạo âm chuông Ding-Dong y tế
 * Kết hợp Web Speech API tiếng Việt (vi-VN) để đọc tên và số thứ tự bệnh nhân
 */

class AudioAnnouncer {
    constructor() {
        this.enabled = true
        this.audioCtx = null
    }

    setEnabled(val) {
        this.enabled = Boolean(val)
    }

    isEnabled() {
        return this.enabled
    }

    // Khởi tạo AudioContext khi có tương tác người dùng
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

    // Phát âm thanh chuông Ding-Dong phòng khám (Chime 2 tone)
    playChime() {
        try {
            const ctx = this.getAudioContext()
            if (!ctx) return Promise.resolve()

            const now = ctx.currentTime
            // Nốt 1 (Ding - F5: 698.46Hz)
            const osc1 = ctx.createOscillator()
            const gain1 = ctx.createGain()
            osc1.type = 'sine'
            osc1.frequency.setValueAtTime(698.46, now)
            gain1.gain.setValueAtTime(0.2, now)
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
            osc1.connect(gain1)
            gain1.connect(ctx.destination)
            osc1.start(now)
            osc1.stop(now + 0.5)

            // Nốt 2 (Dong - A5: 880Hz)
            const osc2 = ctx.createOscillator()
            const gain2 = ctx.createGain()
            osc2.type = 'sine'
            osc2.frequency.setValueAtTime(880, now + 0.25)
            gain2.gain.setValueAtTime(0.25, now + 0.25)
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9)
            osc2.connect(gain2)
            gain2.connect(ctx.destination)
            osc2.start(now + 0.25)
            osc2.stop(now + 0.9)

            return new Promise((resolve) => setTimeout(resolve, 600))
        } catch {
            return Promise.resolve()
        }
    }

    // Phát loa gọi bệnh nhân
    async announcePatient(patientName, ticketNumber, roomName = 'buồng khám số 1') {
        if (!this.enabled || typeof window === 'undefined') return

        // 1. Phát chuông ding-dong
        await this.playChime()

        // 2. Phát giọng đọc tiếng Việt nếu trình duyệt hỗ trợ
        if ('speechSynthesis' in window) {
            try {
                window.speechSynthesis.cancel() // Dừng câu đọc trước nếu có
                const text = `Mời bệnh nhân ${patientName}, số thứ tự ${ticketNumber}, vào ${roomName}.`
                const utterance = new SpeechSynthesisUtterance(text)
                utterance.lang = 'vi-VN'
                utterance.rate = 0.95 // Tốc độ tự nhiên, rõ ràng
                utterance.pitch = 1.05 // Âm sắc chuẩn mực y tế

                // Tìm giọng tiếng Việt nếu có
                const voices = window.speechSynthesis.getVoices()
                const viVoice = voices.find((v) => v.lang.includes('vi') || v.lang.includes('VN'))
                if (viVoice) {
                    utterance.voice = viVoice
                }

                window.speechSynthesis.speak(utterance)
            } catch {
                // Ignore audio errors gracefully
            }
        }
    }
}

export const audioAnnouncer = new AudioAnnouncer()
