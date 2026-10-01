/**
 * Parser tolerante de RSS 2.0 e Atom.
 *
 * Escopo deliberadamente minimo (sem dependencia externa): extrai apenas os
 * campos que o Tec News usa — titulo, link, identificador, resumo, autor e
 * data. Nao e' um parser XML completo; entradas malformadas sao ignoradas em
 * vez de derrubar a ingestao (uma fonte quebrada nao para as demais).
 */

export type FeedFormat = 'rss' | 'atom';

export interface FeedEntry {
  externalId?: string | null;
  url?: string | null;
  title: string;
  summary?: string | null;
  author?: string | null;
  publishedAt?: Date | null;
}

export interface ParsedFeed {
  format: FeedFormat;
  title?: string | null;
  entries: FeedEntry[];
}

const ITEM_RE = /<item\b[\s\S]*?<\/item>/gi;
const ENTRY_RE = /<entry\b[\s\S]*?<\/entry>/gi;

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  const decoded = decodeEntities(value);
  const text = stripHtml(decoded);
  return text.length > 0 ? text : null;
}

/** Texto interno de uma tag, na forma <tag ...>valor</tag> (primeira ocorrencia). */
function innerText(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = block.match(re);
  return match ? match[1] : null;
}

/** Valor de um atributo em uma tag (ex.: href de <link .../>). */
function attr(block: string, tag: string, attribute: string): string | null {
  const re = new RegExp(
    `<${tag}\\b[^>]*\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    'i',
  );
  const match = block.match(re);
  if (!match) return null;
  return match[1] ?? match[2] ?? null;
}

/** Link do Atom: prioriza rel="alternate" (ou rel ausente) e usa o href. */
function atomLink(block: string): string | null {
  const links = block.match(/<link\b[^>]*>/gi) ?? [];
  let fallback: string | null = null;
  for (const link of links) {
    const href = attr(link, 'link', 'href');
    if (!href) continue;
    const rel = attr(link, 'link', 'rel');
    if (!rel || rel.toLowerCase() === 'alternate') return decodeEntities(href).trim();
    fallback = fallback ?? decodeEntities(href).trim();
  }
  return fallback;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const trimmed = clean(value) ?? value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildEntry(block: string, format: FeedFormat): FeedEntry | null {
  const rawTitle = innerText(block, 'title');
  const title = clean(rawTitle);
  if (!title) return null;

  const summaryRaw =
    innerText(block, 'description') ??
    innerText(block, 'summary') ??
    innerText(block, 'content:encoded') ??
    innerText(block, 'content');
  const summary = clean(summaryRaw);
  const limitedSummary = summary ? summary.slice(0, 4000) : null;

  let url: string | null;
  let externalId: string | null;
  let author: string | null;
  let publishedAt: Date | null;

  if (format === 'atom') {
    url = atomLink(block) ?? clean(innerText(block, 'link'));
    externalId = clean(innerText(block, 'id'));
    const authorBlock = innerText(block, 'author');
    author =
      (authorBlock ? clean(innerText(authorBlock, 'name')) : null) ??
      clean(authorBlock) ??
      clean(innerText(block, 'dc:creator'));
    publishedAt =
      parseDate(innerText(block, 'published')) ??
      parseDate(innerText(block, 'updated'));
  } else {
    url = clean(innerText(block, 'link')) ?? attr(block, 'link', 'href');
    externalId =
      clean(innerText(block, 'guid')) ?? clean(innerText(block, 'id'));
    author =
      clean(innerText(block, 'dc:creator')) ?? clean(innerText(block, 'author'));
    publishedAt =
      parseDate(innerText(block, 'pubDate')) ??
      parseDate(innerText(block, 'dc:date')) ??
      parseDate(innerText(block, 'published'));
  }

  return {
    externalId: externalId ?? null,
    url,
    title: title.slice(0, 400),
    summary: limitedSummary,
    author: author ? author.slice(0, 200) : null,
    publishedAt,
  };
}

export function parseFeed(xml: string): ParsedFeed {
  const isAtom = /<feed\b/i.test(xml);
  const format: FeedFormat = isAtom ? 'atom' : 'rss';
  const pattern = isAtom ? ENTRY_RE : ITEM_RE;
  const blocks = xml.match(pattern) ?? [];

  const entries = blocks
    .map((block) => buildEntry(block, format))
    .filter((entry): entry is FeedEntry => entry !== null);

  return {
    format,
    title: clean(innerText(xml, 'title')),
    entries,
  };
}
