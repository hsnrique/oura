import { GoogleGenAI } from '@google/genai';

export class AIService {
  private client: GoogleGenAI;
  private model = 'gemini-3-flash-preview';

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
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
    history: Array<{ role: string; content: string }>
  ): AsyncGenerator<string> {
    const truncatedContext = pageContext.substring(0, 10000);

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
      config: {
        systemInstruction: 'You are a helpful AI assistant integrated into a web browser. You help users understand web pages, answer questions about their content, and assist with general queries. Be concise and helpful.',
      },
      contents,
    });

    for await (const chunk of response) {
      const text = chunk.text;
      if (text) yield text;
    }
  }
}
