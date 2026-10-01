import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsFocus, NewsKind } from '@prisma/client';
import { AppConfiguration } from '../../config/configuration';

export interface DigestCandidate {
  id: string;
  title: string;
  summary?: string | null;
  vendor?: string | null;
  kind: NewsKind;
  publishedAt?: Date | null;
}

export interface AiDigestHighlight {
  id: string;
  note: string;
  focus?: NewsFocus;
  score?: number;
}

export interface AiDigestResult {
  title: string;
  summary: string;
  highlights: AiDigestHighlight[];
  model: string;
}

const FOCUS_VALUES: NewsFocus[] = [
  'FEATURE',
  'CERTIFICATION',
  'SECURITY',
  'RELEASE',
  'OTHER',
];

const SYSTEM_PROMPT = [
  'Você é analista técnico sênior da Suporte Informática Soluções.',
  'Sua tarefa é ler novidades de fabricantes de infraestrutura (Red Hat,',
  'Nutanix, Veeam, SUSE, ExaGrid e outros) e destacar, para consultores',
  'técnicos, APENAS o que agrega conhecimento acionável:',
  '1) NOVAS FUNCIONALIDADES ou capacidades dos produtos;',
  '2) CERTIFICAÇÕES e TREINAMENTOS técnicos.',
  'Descarte marketing genérico, eventos promocionais e conteúdo irrelevante.',
  'Seja objetivo, técnico e escreva SEMPRE em português do Brasil.',
].join(' ');

function buildUserPrompt(candidates: DigestCandidate[]): string {
  const items = candidates.map((item) => ({
    id: item.id,
    titulo: item.title,
    fabricante: item.vendor ?? null,
    tipo: item.kind,
    publicado_em: item.publishedAt ? item.publishedAt.toISOString() : null,
    resumo: (item.summary ?? '').slice(0, 1200) || null,
  }));

  return [
    'Analise as novidades abaixo e produza um resumo dos destaques.',
    'Responda EXCLUSIVAMENTE com um objeto JSON válido, sem texto fora do JSON,',
    'no formato:',
    '{',
    '  "title": "titulo curto com ate 60 caracteres",',
    '  "summary": "resumo em 2 a 4 frases, em portugues, focado em funcionalidades de produto e certificacoes tecnicas",',
    '  "highlights": [',
    '    { "id": "<id exato de um item abaixo>", "note": "por que importa, em 1 frase", "focus": "FEATURE|CERTIFICATION|SECURITY|RELEASE|OTHER", "score": 0 }',
    '  ]',
    '}',
    'Ordene "highlights" do mais para o menos importante e inclua no maximo 8 itens.',
    'Use somente ids presentes na lista. "score" e um inteiro de 0 a 100.',
    '',
    `Novidades (${items.length}):`,
    JSON.stringify(items),
  ].join('\n');
}

function extractJson(content: string): unknown {
  const cleaned = content
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Resposta da IA sem JSON');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Cliente minimo de um endpoint compativel com OpenAI (chat/completions).
 * Sem dependencia nova: usa o fetch nativo. Quando a IA esta desligada ou
 * falha, o modulo Tec News continua funcionando com a relevancia heuristica.
 */
@Injectable()
export class NewsAiService {
  private readonly logger = new Logger(NewsAiService.name);

  constructor(private readonly config: ConfigService) {}

  settings(): AppConfiguration['ai'] {
    return (
      this.config.get<AppConfiguration['ai']>('ai') ?? {
        enabled: false,
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4o-mini',
        timeoutMs: 20000,
      }
    );
  }

  isEnabled(): boolean {
    const settings = this.settings();
    return settings.enabled && settings.apiKey.trim() !== '';
  }

  /**
   * Gera o resumo/destaques a partir dos candidatos. Lanca
   * ServiceUnavailableException quando a IA esta desligada, o provedor falha
   * ou a resposta e' invalida — o chamador traduz para a experiencia adequada.
   */
  async summarize(candidates: DigestCandidate[]): Promise<AiDigestResult> {
    const settings = this.settings();
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        'Resumo inteligente desativado (configure AI_ENABLED e AI_API_KEY)',
      );
    }
    if (candidates.length === 0) {
      throw new ServiceUnavailableException(
        'Sem novidades no periodo para resumir',
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), settings.timeoutMs);
    let content: string;
    try {
      const response = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model,
          temperature: 0.2,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(candidates) },
          ],
        }),
      });

      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 300);
        throw new Error(`HTTP ${response.status} ${detail}`.trim());
      }

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      content = payload.choices?.[0]?.message?.content ?? '';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Falha ao gerar resumo com IA: ${message}`);
      throw new ServiceUnavailableException(
        'Nao foi possivel gerar o resumo inteligente agora. Tente novamente.',
      );
    } finally {
      clearTimeout(timer);
    }

    return this.parse(content, settings.model, candidates);
  }

  private parse(
    content: string,
    model: string,
    candidates: DigestCandidate[],
  ): AiDigestResult {
    let raw: unknown;
    try {
      raw = extractJson(content);
    } catch (error) {
      this.logger.warn(`Resposta invalida da IA: ${String(error)}`);
      throw new ServiceUnavailableException(
        'A IA retornou uma resposta invalida. Tente novamente.',
      );
    }

    const data = (raw ?? {}) as Record<string, unknown>;
    const summary = asString(data.summary);
    if (!summary) {
      throw new ServiceUnavailableException(
        'A IA nao retornou um resumo valido.',
      );
    }

    const knownIds = new Set(candidates.map((candidate) => candidate.id));
    const rawHighlights = Array.isArray(data.highlights)
      ? data.highlights
      : [];
    const highlights: AiDigestHighlight[] = [];
    const seen = new Set<string>();

    for (const entry of rawHighlights) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      const id = asString(record.id);
      if (!id || !knownIds.has(id) || seen.has(id)) continue;
      seen.add(id);

      const focusRaw = asString(record.focus)?.toUpperCase();
      const focus = FOCUS_VALUES.includes(focusRaw as NewsFocus)
        ? (focusRaw as NewsFocus)
        : undefined;
      const scoreNumber = Number(record.score);
      const score = Number.isFinite(scoreNumber)
        ? Math.min(100, Math.max(0, Math.round(scoreNumber)))
        : undefined;

      highlights.push({
        id,
        note: asString(record.note) ?? 'Destaque do periodo',
        focus,
        score,
      });
      if (highlights.length >= 8) break;
    }

    if (highlights.length === 0) {
      throw new ServiceUnavailableException(
        'A IA nao selecionou destaques relevantes.',
      );
    }

    return {
      title: asString(data.title) ?? 'Destaques para o consultor',
      summary,
      highlights,
      model,
    };
  }
}
