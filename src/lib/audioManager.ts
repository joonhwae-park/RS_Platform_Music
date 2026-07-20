type Listener = () => void;

let currentPlayer: HTMLAudioElement | null = null;
const listeners = new Set<Listener>();

export function requestPlayback(audio: HTMLAudioElement, onStopped: Listener) {
  if (currentPlayer && currentPlayer !== audio) {
    currentPlayer.pause();
    notifyListeners();
  }
  currentPlayer = audio;
  listeners.add(onStopped);
  audio.play();
}

export function releasePlayback(audio: HTMLAudioElement) {
  if (currentPlayer === audio) {
    currentPlayer = null;
  }
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners() {
  listeners.forEach((fn) => fn());
  listeners.clear();
}
