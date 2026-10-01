import { NewsFocus, NewsKind } from '@prisma/client';

/**
 * Relevancia heuristica de uma novidade para o consultor da Suporte.
 *
 * O foco do Tec News e' o que ajuda o consultor no dia a dia: funcionalidades
 * dos produtos e certificacoes/treinamentos tecnicos. A funcao roda sem IA
 * (sempre disponivel) e serve de base para a ordenacao; quando a IA esta
 * ligada, o resumo pode refinar o foco/motivo, mas o numero continua no
 * intervalo 0..100.
 *
 * Regra: palavra-chave (PT/EN) define o foco; o tipo editorial (kind) e a
 * data dao o peso. Deterministico e barato.
 */

export interface NewsRelevanceInput {
  title: string;
  summary?: string | null;
  kind: NewsKind;
  publishedAt?: Date | null;
}

export interface NewsRelevance {
  score: number;
  focus: NewsFocus;
  note: string;
}

interface FocusRule {
  focus: NewsFocus;
  weight: number;
  note: string;
  patterns: RegExp[];
}

const FOCUS_RULES: FocusRule[] = [
  {
    focus: 'CERTIFICATION',
    weight: 34,
    note: 'Certificacao ou treinamento tecnico',
    patterns: [
      /certificat/i,
      /certifica[çc]/i,
      /\bcertified\b/i,
      /\bexam\b|\bexame\b/i,
      /\bbadge\b/i,
      /credential|credencial/i,
      /\btraining\b|treinamento|\bcurso\b|\btrilha\b/i,
    ],
  },
  {
    focus: 'FEATURE',
    weight: 30,
    note: 'Funcionalidade ou capacidade nova do produto',
    patterns: [
      /\bfeature/i,
      /now supports|passa a suportar|passa a oferecer/i,
      /\bsupports?\b|suporta/i,
      /introduc|introduz|lan[çc]a|lan[çc]amento/i,
      /enhancement|melhoria|aprimoramento/i,
      /capabilit|funcionalidade|recurso|novidade/i,
      /\bnew\b|\bnovo\b|\bnova\b/i,
      /integration|integra[çc][ãa]o/i,
      /automation|automa[çc][ãa]o/i,
      /dashboard|observability|monitoramento/i,
      /\bapi\b|openshift|kubernetes|container/i,
    ],
  },
  {
    focus: 'SECURITY',
    weight: 26,
    note: 'Aviso ou correcao de seguranca',
    patterns: [
      /security|seguran[çc]a/i,
      /vulnerab/i,
      /\bcve-\d/i,
      /advisory|advisories/i,
      /rhsa-|suse-su/i,
      /\bpatch\b|corre[çc][ãa]o/i,
      /exploit|breach|vazamento/i,
    ],
  },
  {
    focus: 'RELEASE',
    weight: 22,
    note: 'Release ou atualizacao de produto',
    patterns: [
      /\brelease/i,
      /\bversion\b|\bvers[ãa]o\b/i,
      /\bv?\d+\.\d+/,
      /\bupgrade\b|atualiza[çc][ãa]o/i,
      /general availability/i,
      /\bnow available\b|j[áa] dispon[íi]vel/i,
    ],
  },
];

const KIND_BASE: Record<NewsKind, number> = {
  CERTIFICATION: 54,
  FEATURE: 48,
  SECURITY: 44,
  RELEASE: 40,
  EVENT: 20,
  GENERAL: 12,
};

const KIND_FOCUS: Record<NewsKind, NewsFocus> = {
  CERTIFICATION: 'CERTIFICATION',
  FEATURE: 'FEATURE',
  SECURITY: 'SECURITY',
  RELEASE: 'RELEASE',
  EVENT: 'OTHER',
  GENERAL: 'OTHER',
};

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function recencyBoost(publishedAt?: Date | null): number {
  if (!publishedAt) return 0;
  const ageDays = (Date.now() - publishedAt.getTime()) / DAY_MS;
  if (ageDays <= 7) return 15;
  if (ageDays <= 30) return 8;
  if (ageDays <= 90) return 3;
  return 0;
}

/**
 * Calcula score (0..100), foco e motivo de uma novidade. Uma mesma novidade
 * pode casar com mais de um foco; vence a regra de maior peso (empate resolvido
 * pela ordem de FOCUS_RULES: certificacao > funcionalidade > seguranca > release).
 */
export function scoreNewsRelevance(input: NewsRelevanceInput): NewsRelevance {
  const haystack = `${input.title ?? ''} \n ${input.summary ?? ''}`;

  let focus: NewsFocus = KIND_FOCUS[input.kind];
  let note = 'Conteudo geral';
  let keywordBonus = 0;

  for (const rule of FOCUS_RULES) {
    const matched = rule.patterns.some((pattern) => pattern.test(haystack));
    if (!matched) continue;
    focus = rule.focus;
    note = rule.note;
    keywordBonus = rule.weight;
    break;
  }

  const score = clamp(
    KIND_BASE[input.kind] + keywordBonus + recencyBoost(input.publishedAt),
    0,
    100,
  );

  return { score, focus, note };
}
