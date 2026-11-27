import { DeliveryItem } from '../types';
import { loadAppSettings, SpeakerSettings } from './appSettings';

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

function getSpanishVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const preferredLangs = ['es-cr', 'es-419', 'es-mx', 'es-us', 'es-es'];
  for (const lang of preferredLangs) {
    const match = voices.find((v) => v.lang.toLowerCase() === lang);
    if (match) return match;
  }

  return voices.find((v) => v.lang.toLowerCase().startsWith('es')) || null;
}

export function stopSpeaking(): void {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore browser speech synthesis cancellation errors
  }
}

let sharedAudioCtx: AudioContext | null = null;
let celebrationSpeechTimer: ReturnType<typeof setTimeout> | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new AudioCtx();
    } catch {
      return null;
    }
  }
  return sharedAudioCtx;
}

export function unlockCelebrationAudio(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {
      // Ignore audio resume restriction errors
    });
  }
}

export function playCelebrationChime(tier: 25 | 50 | 75 | 100): boolean {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime + 0.02;
    const isFinale = tier === 100;

    // Bright celebratory ascending notes (Hz)
    const notes = isFinale
      ? [
          { freq: 523.25, delay: 0, dur: 0.13, vol: 0.16 },     // C5
          { freq: 659.25, delay: 0.09, dur: 0.13, vol: 0.17 },  // E5
          { freq: 783.99, delay: 0.18, dur: 0.13, vol: 0.18 },  // G5
          { freq: 1046.5, delay: 0.27, dur: 0.22, vol: 0.2 },   // C6
          { freq: 1318.51, delay: 0.39, dur: 0.42, vol: 0.2 },  // E6
          { freq: 1046.5, delay: 0.39, dur: 0.42, vol: 0.12 },  // C6 harmony
          { freq: 783.99, delay: 0.39, dur: 0.42, vol: 0.1 },   // G5 harmony
        ]
      : [
          { freq: 523.25, delay: 0, dur: 0.12, vol: 0.15 },     // C5
          { freq: 659.25, delay: 0.09, dur: 0.12, vol: 0.16 },  // E5
          { freq: 783.99, delay: 0.18, dur: 0.14, vol: 0.17 },  // G5
          { freq: 1046.5, delay: 0.27, dur: 0.32, vol: 0.19 },  // C6
        ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.freq, now + n.delay);

      gain.gain.setValueAtTime(0.0001, now + n.delay);
      gain.gain.exponentialRampToValueAtTime(n.vol, now + n.delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.delay + n.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.delay);
      osc.stop(now + n.delay + n.dur + 0.03);
    }
    return true;
  } catch {
    return false;
  }
}

export function speakText(text: string, options?: { rate?: number; pitch?: number; queue?: boolean }): boolean {
  if (!isSpeechSupported() || !text.trim()) return false;
  try {
    const speakerCfg = loadAppSettings().speaker;
    if (!options?.queue) {
      window.speechSynthesis.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getSpanishVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'es-CR';
    }
    utterance.rate = options?.rate ?? speakerCfg.rate ?? 1;
    utterance.pitch = options?.pitch ?? speakerCfg.pitch ?? 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function playMilestoneCelebrationAudio(
  tier: 25 | 50 | 75 | 100,
  spokenText: string,
  options?: { rate?: number; pitch?: number }
): void {
  const chimePlayed = playCelebrationChime(tier);

  if (celebrationSpeechTimer) {
    clearTimeout(celebrationSpeechTimer);
    celebrationSpeechTimer = null;
  }

  const delayMs = chimePlayed ? (tier === 100 ? 620 : 480) : 0;
  celebrationSpeechTimer = setTimeout(() => {
    celebrationSpeechTimer = null;
    speakText(spokenText, {
      rate: options?.rate,
      pitch: options?.pitch ? Math.min(1.25, options.pitch + 0.06) : undefined,
      queue: false,
    });
  }, delayMs);
}

export function buildPackageAnnouncement(
  item: DeliveryItem,
  prefix?: string,
  speakerOverride?: SpeakerSettings
): string {
  const speakerCfg = speakerOverride || loadAppSettings().speaker;
  const fields = speakerCfg.fields;

  const isIncomplete = item.hasLocation === false || item.coverageStatus === 'incomplete';
  const cleanAddress = isIncomplete
    ? 'sin ubicación registrada'
    : /^https?:\/\//i.test(item.address.trim())
    ? 'ubicación en el mapa'
    : item.address;

  const parts: string[] = [];
  const resolvedPrefix = prefix || speakerCfg.customPrefix.trim();
  if (resolvedPrefix) parts.push(resolvedPrefix);

  if (fields.packageNumber) {
    parts.push(`Paquete número ${item.originalNumber}`);
  }
  if (fields.recipientName && item.recipientName) {
    parts.push(`para ${item.recipientName}`);
  }
  if (fields.address) {
    parts.push(`Dirección: ${cleanAddress}`);
  }
  if (fields.province && !isIncomplete && item.province && item.province !== 'Sin ubicación') {
    parts.push(item.province);
  }
  if (fields.distance && !isIncomplete && item.distanceFromPrevKm !== undefined) {
    parts.push(`a ${item.distanceFromPrevKm} kilómetros`);
  }
  if (fields.phone && item.phone) {
    parts.push(`Teléfono ${item.phone}`);
  }
  if (fields.notes && item.notes && !/^https?:\/\//i.test(item.notes.trim())) {
    parts.push(`Nota: ${item.notes}`);
  }

  if (parts.length === 0) {
    parts.push(`Paquete número ${item.originalNumber}`);
  }

  return parts.join('. ') + '.';
}
