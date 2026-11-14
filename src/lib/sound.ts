export type AppSound = "flip" | "correct" | "incorrect";

const SOURCES: Record<AppSound, string> = {
  flip: "/sounds/card-flip.wav",
  correct: "/sounds/correct.wav",
  incorrect: "/sounds/incorrect.wav",
};

const cache = new Map<AppSound, HTMLAudioElement>();
let current: HTMLAudioElement | null = null;

/** Plays one short local sound after a real user interaction. */
export function playAppSound(kind: AppSound, enabled: boolean): HTMLAudioElement | null {
  if (!enabled || typeof window === "undefined") return null;
  current?.pause();
  let audio = cache.get(kind);
  if (!audio) {
    audio = new Audio(SOURCES[kind]);
    audio.preload = "auto";
    audio.volume = kind === "flip" ? 0.32 : 0.4;
    cache.set(kind, audio);
  }
  audio.currentTime = 0;
  current = audio;
  void audio.play().catch(() => {
    // Browsers may still block audio; the visual interaction must remain usable.
    if (current === audio) current = null;
  });
  return audio;
}
