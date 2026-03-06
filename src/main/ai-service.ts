import { GoogleGenAI } from '@google/genai';

const SYSTEM_PROMPT = 'You are a helpful AI assistant integrated into a web browser called Oura. You help users understand web pages, answer questions about their content, and assist with general queries. Be concise and helpful. When memory from past conversations is provided, use it naturally to maintain context and continuity.';

export class AIService {
  private client: GoogleGenAI;
  private model = 'gemini-3-flash-preview';

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  setModel(model: string) {
    this.model = model;
  }

  async *summarizePage(html: string, url: string): AsyncGenerator<string> {
    const truncatedHtml = html.substring(0, 15000);
    const response = await this.client.models.generateContentStream({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are a helpful browser assistant. Summarize the following web page content concisely and clearly. Focus on the main topic, key points, and any important details.\n\nURL: ${url}\n\nPage content:\n${truncatedHtml}`,
            },
          ],
        },
      ],
    });

    for await (const chunk of response) {
      const text = chunk.text;
      if (text) yield text;
    }
  }

  async *chat(
    message: string,
    pageContext: string,
    history: Array<{ role: string; content: string }>,
    memory?: string,
  ): AsyncGenerator<string> {
    const truncatedContext = pageContext.substring(0, 10000);

    let systemInstruction = SYSTEM_PROMPT;
    if (memory) {
      systemInstruction += `\n\nHere are relevant snippets from your past conversations with this user. Use them for context:\n${memory}`;
    }

    const contents = [
      ...history.map((msg) => ({
        role: msg.role as 'user' | 'model',
        parts: [{ text: msg.content }],
      })),
      {
        role: 'user' as const,
        parts: [
          {
            text: pageContext
              ? `Context from the current web page:\n${truncatedContext}\n\nUser question: ${message}`
              : message,
          },
        ],
      },
    ];

    const response = await this.client.models.generateContentStream({
      model: this.model,
      config: { systemInstruction },
      contents,
    });

    for await (const chunk of response) {
      const text = chunk.text;
      if (text) yield text;
    }
  }

  async *chatWithImage(
    message: string,
    imageBase64: string,
    pageContext: string,
    history: Array<{ role: string; content: string }>,
    memory?: string,
  ): AsyncGenerator<string> {
    const truncatedContext = pageContext.substring(0, 10000);

    let systemInstruction = SYSTEM_PROMPT;
    if (memory) {
      systemInstruction += `\n\nHere are relevant snippets from your past conversations with this user. Use them for context:\n${memory}`;
    }

    const imageData = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const parts: any[] = [
      { inlineData: { mimeType: 'image/png', data: imageData } },
    ];

    if (pageContext) {
      parts.push({ text: `Context from the current web page:\n${truncatedContext}\n\nUser question: ${message}` });
    } else {
      parts.push({ text: message });
    }

    const contents = [
      ...history.map((msg) => ({
        role: msg.role as 'user' | 'model',
        parts: [{ text: msg.content }],
      })),
      { role: 'user' as const, parts },
    ];

    const response = await this.client.models.generateContentStream({
      model: this.model,
      config: { systemInstruction },
      contents,
    });

    for await (const chunk of response) {
      const text = chunk.text;
      if (text) yield text;
    }
  }
}

