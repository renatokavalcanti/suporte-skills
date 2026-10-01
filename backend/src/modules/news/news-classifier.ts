import { NewsKind } from '@prisma/client';

/**
 * Classificacao inicial de uma novidade por palavras-chave (PT/EN). Regra
 * simples e deterministica; pode ser substituida por IA no futuro sem afetar
 * o restante do modulo (o campo `kind` continua sendo a interface).
 */
const RULES: { kind: NewsKind; patterns: RegExp[] }[] = [
  {
    kind: 'SECURITY',
    patterns: [
      /security/i,
      /vulnerab/i,
      /\bcve-\d/i,
      /advisory|advisories/i,
      /rhsa-/i,
      /suse-su/i,
      /\bpatch\b/i,
      /\bbreach\b/i,
      /exploit/i,
      /seguran[çc]a/i,
    ],
  },
  {
    kind: 'CERTIFICATION',
    patterns: [
      /certificat/i,
      /certifica[çc]/i,
      /\bexam\b|\bexame\b/i,
      /\bbadge\b/i,
      /credential|credencial/i,
    ],
  },
  {
    kind: 'RELEASE',
    patterns: [
      /\brelease/i,
      /\bversion\b|\bvers[ãa]o\b/i,
      /\bv?\d+\.\d+/,
      /\bupgrade\b|\batualiza[çc][ãa]o\b/i,
      /general availability/i,
      /\bnow available\b/i,
      /lan[çc]amento|lan[çc]ou/i,
      /\bga\b/i,
    ],
  },
  {
    kind: 'EVENT',
    patterns: [
      /webinar/i,
      /\bevent\b|\bevento\b/i,
      /summit/i,
      /conference|confer[êe]ncia/i,
      /workshop/i,
    ],
  },
  {
    kind: 'FEATURE',
    patterns: [
      /\bfeature/i,
      /now supports/i,
      /enhancement/i,
      /capabilit/i,
      /funcionalidade|novidade/i,
    ],
  },
];

export function classifyNewsKind(
  ...texts: (string | null | undefined)[]
): NewsKind {
  const haystack = texts.filter(Boolean).join(' \n ');
  if (!haystack) return 'GENERAL';

  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) {
      return rule.kind;
    }
  }
  return 'GENERAL';
}
