/**
 * Web Audio API sound manager for trade notifications.
 * Generates short, subtle tones without requiring external audio files.
 */

type SoundType = "trade_fill" | "alert_trigger" | "notification"

const TONE_CONFIG: Record<SoundType, { frequency: number; gain: number; duration: number }> = {
  trade_fill: { frequency: 880, gain: 0.1, duration: 0.25 },
  alert_trigger: { frequency: 660, gain: 0.15, duration: 0.3 },
  notification: { frequency: 440, gain: 0.08, duration: 0.2 },
}

let soundEnabled = true

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled
}

export function isSoundEnabled(): boolean {
  return soundEnabled
}

export function playSound(type: SoundType): void {
  if (!soundEnabled || typeof AudioContext === "undefined") return

  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    const config = TONE_CONFIG[type]
    osc.frequency.value = config.frequency
    gain.gain.value = config.gain

    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + config.duration)
    osc.stop(ctx.currentTime + config.duration)

    // Clean up AudioContext after tone finishes
    osc.onended = () => void ctx.close().catch(() => {})
  } catch {
    // Silent fail — audio is non-critical
  }
}
