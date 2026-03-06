import { addMessage, renderMarkdown, getPageContent } from './ai-panel';
import type { BrowserState } from './types';

let captureCtx: AudioContext | null = null;
let playbackCtx: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let processorNode: ScriptProcessorNode | null = null;
let isLiveActive = false;
let cleanupFns: Array<() => void> = [];
let nextPlayTime = 0;
let selectedDeviceId: string | null = null;
let liveTranscriptRaw = '';
let browserState: BrowserState | null = null;

function floatTo16BitPCM(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

function int16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  return float32;
}

async function startMicrophone() {
  captureCtx = new AudioContext({ sampleRate: 16000 });

  const constraints: MediaStreamConstraints = {
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {}),
    },
  };

  mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
  const source = captureCtx.createMediaStreamSource(mediaStream);
  processorNode = captureCtx.createScriptProcessor(4096, 1, 1);

  processorNode.onaudioprocess = (event) => {
    if (!isLiveActive) return;
    const input = event.inputBuffer.getChannelData(0);
    const pcm16 = floatTo16BitPCM(input);
    window.electronAPI.live.sendAudio(int16ToBase64(pcm16));
  };

  source.connect(processorNode);
  processorNode.connect(captureCtx.destination);
}

function ensurePlaybackContext() {
  if (!playbackCtx || playbackCtx.state === 'closed') {
    playbackCtx = new AudioContext({ sampleRate: 24000 });
    nextPlayTime = 0;
  }
  return playbackCtx;
}

function playAudioChunk(base64Audio: string) {
  const ctx = ensurePlaybackContext();
  const samples = base64ToFloat32(base64Audio);

  const buffer = ctx.createBuffer(1, samples.length, 24000);
  buffer.getChannelData(0).set(samples);

  const gainNode = ctx.createGain();
  gainNode.gain.value = 0.8;
  gainNode.connect(ctx.destination);

  const sourceNode = ctx.createBufferSource();
  sourceNode.buffer = buffer;
  sourceNode.connect(gainNode);

  const now = ctx.currentTime;
  if (nextPlayTime < now) nextPlayTime = now;
  sourceNode.start(nextPlayTime);
  nextPlayTime += buffer.duration;
}

function clearPlayback() {
  nextPlayTime = 0;
  if (playbackCtx && playbackCtx.state !== 'closed') {
    playbackCtx.close().catch(() => { });
    playbackCtx = null;
  }
}

async function stopMicrophone() {
  if (processorNode) {
    processorNode.disconnect();
    processorNode = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  if (captureCtx) {
    await captureCtx.close();
    captureCtx = null;
  }
}

function updateLiveUI(active: boolean) {
  const btn = document.getElementById('btn-live-mode');
  const indicator = document.getElementById('live-indicator');
  const inputContainer = document.getElementById('ai-input-container');

  if (btn) btn.classList.toggle('active', active);
  if (indicator) indicator.classList.toggle('hidden', !active);
  if (inputContainer) inputContainer.classList.toggle('live-active', active);
}

export async function toggleLiveMode() {
  if (isLiveActive) {
    await stopLive();
  } else {
    await startLive();
  }
}

async function startLive() {
  updateLiveUI(true);
  liveTranscriptRaw = '';

  let pageContext = '';
  try {
    if (browserState) {
      const { html, url } = await getPageContent(browserState);
      if (html) pageContext = `URL: ${url}\n\n${html.slice(0, 8000)}`;
    }
  } catch {
    console.warn('Could not get page content for Live mode');
  }

  try {
    const result = await window.electronAPI.live.start(pageContext || undefined);
    if (result.error) {
      addMessage('ai', `Live mode error: ${result.error}`);
      updateLiveUI(false);
      return;
    }
  } catch (err: any) {
    addMessage('ai', `Failed to start live session: ${err.message || err}`);
    updateLiveUI(false);
    return;
  }

  try {
    await startMicrophone();
  } catch (err: any) {
    addMessage('ai', `Microphone error: ${err.message}`);
    await window.electronAPI.live.stop();
    updateLiveUI(false);
    return;
  }

  isLiveActive = true;

  cleanupFns.push(
    window.electronAPI.live.onAudioChunk((data) => playAudioChunk(data)),
  );
  cleanupFns.push(
    window.electronAPI.live.onTextChunk((text) => {
      const container = document.getElementById('ai-messages')!;
      let liveMsg = document.getElementById('live-transcript');
      if (!liveMsg) {
        const el = addMessage('ai', '');
        el.id = 'live-transcript';
        liveMsg = el;
      }
      liveTranscriptRaw += text;
      liveMsg.innerHTML = renderMarkdown(liveTranscriptRaw);
      container.scrollTop = container.scrollHeight;
    }),
  );
  cleanupFns.push(
    window.electronAPI.live.onInterrupted(() => clearPlayback()),
  );
  cleanupFns.push(
    window.electronAPI.live.onError((error) => {
      addMessage('ai', `Live error: ${error}`);
      stopLive();
    }),
  );
  cleanupFns.push(
    window.electronAPI.live.onClosed(() => {
      if (isLiveActive) stopLive();
    }),
  );
}

async function stopLive() {
  isLiveActive = false;
  cleanupFns.forEach((fn) => fn());
  cleanupFns = [];
  clearPlayback();
  await stopMicrophone();
  await window.electronAPI.live.stop();
  updateLiveUI(false);
  liveTranscriptRaw = '';

  const liveMsg = document.getElementById('live-transcript');
  if (liveMsg) liveMsg.removeAttribute('id');
}

async function populateMicSelector() {
  const select = document.getElementById('live-mic-select') as HTMLSelectElement;
  if (!select) return;

  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch { return; }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const audioInputs = devices.filter((d) => d.kind === 'audioinput');

  select.innerHTML = '';
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Default Microphone';
  select.appendChild(defaultOpt);

  audioInputs.forEach((device) => {
    const opt = document.createElement('option');
    opt.value = device.deviceId;
    opt.textContent = device.label || `Microphone ${device.deviceId.slice(0, 6)}`;
    select.appendChild(opt);
  });

  select.value = selectedDeviceId || '';
}

export function setupLiveMode(state: BrowserState) {
  browserState = state;
  const btn = document.getElementById('btn-live-mode');
  if (btn) {
    btn.addEventListener('click', () => toggleLiveMode());
  }

  const micSelect = document.getElementById('live-mic-select') as HTMLSelectElement;
  if (micSelect) {
    micSelect.addEventListener('change', () => {
      selectedDeviceId = micSelect.value || null;
    });
    micSelect.addEventListener('focus', () => populateMicSelector());
  }
}
