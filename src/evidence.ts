export type EvidenceJournalEntry = {
  id: string;
  description: string;
  timestamp: string;
  imageBase64?: string;
  audioBase64?: string;
  audioDurationSec?: number;
  /** Marks entries produced by a special flow (e.g. 'Voice Emergency' from the
   *  voice trigger) so the journal feed can render them differently. Absent
   *  for ordinary manually-created entries. */
  entryType?: string;
  entryHash?: string;
  previousEntryHash?: string;
};

export async function sha256Hex(input: string): Promise<string> {
  if (typeof globalThis === 'undefined' || !globalThis.crypto?.subtle) {
    return '';
  }
  const buffer = new TextEncoder().encode(input);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function serializeForHash(
  entry: Pick<
    EvidenceJournalEntry,
    'id' | 'timestamp' | 'description' | 'imageBase64' | 'audioBase64'
  >,
  previousHash: string,
): string {
  return JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    description: entry.description ?? '',
    image: entry.imageBase64 ?? '',
    audio: entry.audioBase64 ?? '',
    prev: previousHash,
  });
}

export async function computeEntryHash(
  entry: EvidenceJournalEntry,
  previousHash: string,
): Promise<string> {
  return sha256Hex(serializeForHash(entry, previousHash));
}

/**
 * Recompute the chain over a list of newest-first entries. Returns the same
 * list, newest-first, with `entryHash` and `previousEntryHash` filled in so
 * the chain is internally consistent. Skips work for entries already correctly
 * hashed.
 */
export async function chainHashes(
  entries: EvidenceJournalEntry[],
): Promise<EvidenceJournalEntry[]> {
  const chronological = [...entries].reverse();
  const updated: EvidenceJournalEntry[] = [];
  let prevHash = '';
  for (const entry of chronological) {
    const expectedHash = await computeEntryHash(entry, prevHash);
    if (entry.entryHash === expectedHash && entry.previousEntryHash === (prevHash || undefined)) {
      updated.push(entry);
    } else {
      updated.push({
        ...entry,
        previousEntryHash: prevHash || undefined,
        entryHash: expectedHash,
      });
    }
    prevHash = expectedHash;
  }
  return updated.reverse();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildEvidenceHtml(
  entries: EvidenceJournalEntry[],
  exportIsoTime: string,
): string {
  const chronological = [...entries].reverse();
  const headHash = chronological[chronological.length - 1]?.entryHash ?? '';
  const audioCount = chronological.filter((e) => e.audioBase64).length;
  const photoCount = chronological.filter((e) => e.imageBase64).length;

  const entriesHtml = chronological
    .map((entry, i) => {
      const safeDesc = entry.description ? escapeHtml(entry.description).replace(/\n/g, '<br/>') : '';
      const imgHtml = entry.imageBase64
        ? `<img src="${escapeHtml(entry.imageBase64)}" alt="Photo evidence ${i + 1}" />`
        : '';
      const audioNote = entry.audioBase64
        ? `<div class="audio-note">[Audio recording attached — ${entry.audioDurationSec ?? 0}s — original digital file required to play]</div>`
        : '';
      const desc = safeDesc ? `<p class="desc">${safeDesc}</p>` : '';
      return `
      <section class="entry">
        <div class="entry-meta">Entry ${i + 1} &nbsp;·&nbsp; ${escapeHtml(entry.timestamp)}</div>
        ${desc}
        ${imgHtml}
        ${audioNote}
        <div class="entry-hash">
          <div><strong>hash</strong> ${escapeHtml(entry.entryHash ?? '—')}</div>
          <div><strong>prev</strong> ${escapeHtml(entry.previousEntryHash ?? 'genesis')}</div>
        </div>
      </section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Guardian Angel — Evidence Export</title>
  <style>
    body {
      font-family: Georgia, "Times New Roman", serif;
      color: #3d2f2c;
      max-width: 760px;
      margin: 40px auto;
      padding: 0 28px 64px;
      line-height: 1.5;
    }
    h1 {
      font-size: 28px;
      margin: 0 0 4px;
      letter-spacing: -0.4px;
    }
    .subtitle {
      color: #7a6b68;
      font-size: 12px;
      letter-spacing: 0.6px;
      text-transform: uppercase;
    }
    .meta {
      margin-top: 22px;
      padding: 14px 16px;
      background: #fdf1ed;
      border-left: 3px solid #c97a8e;
      border-radius: 4px;
      font-size: 12px;
      color: #5a4845;
      line-height: 1.7;
    }
    .meta strong { color: #3d2f2c; }
    .meta code {
      font-family: "SFMono-Regular", Menlo, Consolas, monospace;
      font-size: 10px;
      word-break: break-all;
    }
    hr {
      border: 0;
      border-top: 1px solid #e5d1c2;
      margin: 28px 0;
    }
    .entry {
      page-break-inside: avoid;
      margin-bottom: 22px;
      border: 1px solid #e5d1c2;
      border-radius: 12px;
      padding: 18px 20px;
      background: #fffcf9;
    }
    .entry-meta {
      font-size: 11px;
      color: #7a6b68;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .entry .desc {
      margin: 10px 0;
      color: #3d2f2c;
      font-size: 15px;
    }
    .entry img {
      display: block;
      max-width: 100%;
      max-height: 480px;
      border-radius: 8px;
      margin-top: 10px;
    }
    .entry .audio-note {
      margin-top: 10px;
      font-size: 12px;
      color: #7a6b68;
      font-style: italic;
    }
    .entry-hash {
      margin-top: 14px;
      font-family: "SFMono-Regular", Menlo, Consolas, monospace;
      font-size: 9px;
      color: #a8978f;
      line-height: 1.6;
      word-break: break-all;
    }
    .entry-hash strong {
      display: inline-block;
      width: 36px;
      color: #5a4845;
    }
    @media print {
      body { margin: 0; padding: 24px; }
      .entry { box-shadow: none; }
    }
  </style>
</head>
<body>
  <h1>Evidence Journal</h1>
  <div class="subtitle">Generated by Guardian Angel</div>
  <div class="meta">
    <strong>Export time</strong> ${escapeHtml(exportIsoTime)}<br/>
    <strong>Entries</strong> ${chronological.length}
    &nbsp;·&nbsp; <strong>Photos</strong> ${photoCount}
    &nbsp;·&nbsp; <strong>Audio</strong> ${audioCount}<br/>
    <strong>Tamper-evidence</strong> Each entry below carries a SHA-256 hash linked to the previous entry.
    Any modification of an earlier entry will invalidate every subsequent hash, breaking the chain.<br/>
    <strong>Chain head</strong> <code>${escapeHtml(headHash)}</code>
  </div>
  <hr/>
  ${entriesHtml}
</body>
</html>`;
}
