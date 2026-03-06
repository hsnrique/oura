import { GoogleGenAI, Modality } from '@google/genai';

type LiveSession = any;
type LiveCallback = {
  onAudioChunk: (base64Audio: string) => void;
  onTextChunk: (text: string) => void;
  onInterrupted: () => void;
  onError: (error: string) => void;
  onClose: () => void;
};

export class LiveService {
  private client: GoogleGenAI;
  private session: LiveSession | null = null;
  private callbacks: LiveCallback | null = null;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  get isConnected(): boolean {
    return this.session !== null;
  }

  async connect(callbacks: LiveCallback, systemInstruction?: string, voiceName?: string): Promise<void> {
    if (this.session) await this.disconnect();
    this.callbacks = callbacks;

    const config: any = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName || 'Zephyr' } },
      },
    };

    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    this.session = await this.client.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config,
      callbacks: {
        onopen: () => { },
        onmessage: (message: any) => this.handleMessage(message),
        onerror: (e: any) => {
          this.callbacks?.onError(e?.message || 'Live API error');
        },
        onclose: () => {
          this.session = null;
          this.callbacks?.onClose();
        },
      },
    });
  }

  private handleMessage(message: any) {
    if (!message.serverContent) return;

    if (message.serverContent.interrupted) {
      this.callbacks?.onInterrupted();
      return;
    }

    const modelTurn = message.serverContent?.modelTurn;
    if (!modelTurn?.parts) return;

    for (const part of modelTurn.parts) {
      if (part.inlineData?.data) {
        this.callbacks?.onAudioChunk(part.inlineData.data);
      }
      if (part.text) {
        this.callbacks?.onTextChunk(part.text);
      }
    }
  }

  sendAudio(base64Data: string) {
    if (!this.session) return;
    this.session.sendRealtimeInput({
      audio: {
        data: base64Data,
        mimeType: 'audio/pcm;rate=16000',
      },
    });
  }

  sendText(text: string) {
    if (!this.session) return;
    this.session.sendClientContent({
      turns: [{ role: 'user', parts: [{ text }] }],
    });
  }

  async disconnect(): Promise<void> {
    if (this.session) {
      try {
        this.session.close();
      } catch { }
      this.session = null;
    }
    this.callbacks = null;
  }
}
