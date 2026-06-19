/**
 * Tiny, dependency-free Markdown renderer for the subset our release notes and CHANGELOG use:
 * headings, bullet lists, paragraphs, horizontal rules, and inline `code` / **bold** / [links].
 * Renders to React elements (no raw HTML injection), so untrusted content can't inject markup.
 */
import { type ReactNode } from 'react';

let keySeq = 0;
const nextKey = () => `md-${keySeq++}`;

/** Inline: **bold**, `code`, and [text](url). */
function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      out.push(<strong key={nextKey()}>{m[2]}</strong>);
    } else if (m[4] !== undefined) {
      out.push(
        <code
          key={nextKey()}
          className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em] text-content"
        >
          {m[4]}
        </code>,
      );
    } else if (m[6] !== undefined && m[7] !== undefined) {
      out.push(
        <a
          key={nextKey()}
          href={m[7]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-accent hover:underline"
        >
          {m[6]}
        </a>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let list: ReactNode[] = [];
  let para: string[] = [];

  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={nextKey()} className="my-3 space-y-1.5 pl-5">
          {list}
        </ul>,
      );
      list = [];
    }
  };
  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <p key={nextKey()} className="my-3 text-sm leading-relaxed text-content-muted">
          {renderInline(para.join(' '))}
        </p>,
      );
      para = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);

    if (line.trim() === '') {
      flushList();
      flushPara();
      continue;
    }
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) {
      flushList();
      flushPara();
      blocks.push(<hr key={nextKey()} className="my-6 border-border" />);
      continue;
    }
    if (heading) {
      flushList();
      flushPara();
      const level = (heading[1] ?? '').length;
      const content = heading[2] ?? '';
      const cls =
        level <= 2
          ? 'mt-7 mb-2 text-lg font-semibold text-content'
          : 'mt-5 mb-1.5 text-sm font-semibold uppercase tracking-wide text-content-muted';
      blocks.push(
        level <= 2 ? (
          <h3 key={nextKey()} className={cls}>
            {renderInline(content)}
          </h3>
        ) : (
          <h4 key={nextKey()} className={cls}>
            {renderInline(content)}
          </h4>
        ),
      );
      continue;
    }
    if (bullet) {
      flushPara();
      list.push(
        <li
          key={nextKey()}
          className="text-sm leading-relaxed text-content-muted marker:text-accent"
        >
          {renderInline(bullet[1] ?? '')}
        </li>,
      );
      continue;
    }
    para.push(line.trim());
  }
  flushList();
  flushPara();

  return <div>{blocks}</div>;
}
