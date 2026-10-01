import { Injectable } from '@nestjs/common';

export interface AiEndpoint {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Cliente minimo de um endpoint compativel com OpenAI (chat/completions).
 * Compartilhado pelo resumo do Tec News e pelo teste de configuracao, sem
 * dependencia externa (fetch nativo). Erros sobem como Error simples - quem
 * chama traduz para a experiencia adequada (503 no resumo, 400 no teste).
 */
@Injectable()
export class AiClient {
  async complete(
    endpoint: AiEndpoint,
    messages: ChatMessage[],
  ): Promise<string> {
    const baseUrl = endpoint.baseUrl.replace(/\/+$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), endpoint.timeoutMs);
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${endpoint.apiKey}`,
        },
        body: JSON.stringify({
          model: endpoint.model,
          temperature: 0.2,
          messages,
        }),
      });

      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 300);
        throw new Error(`HTTP ${response.status}${detail ? ` - ${detail}` : ''}`);
      }

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content || content.trim() === '') {
        throw new Error('Resposta do provedor sem conteudo');
      }
      return content;
    } finally {
      clearTimeout(timer);
    }
  }
}
