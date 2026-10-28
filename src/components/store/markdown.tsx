import { Fragment, type ReactNode } from "react";

// A small Markdown renderer for store pages. It builds React elements (never
// raw HTML), so page content can't inject scripts. Supports headings,
// paragraphs, lists, quotes, rules, **bold**, *italic*, [links](url) and
// ![images](url).

const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i;
const safeUrl = (u: string) => (SAFE_URL.test(u.trim()) ? u.trim() : null);

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`/;
  let rest = text;
  let k = key;
  while (rest) {
    const m = re.exec(rest);
    if (!m) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const [whole, imgAlt, imgUrl, linkText, linkUrl, bold, italic, code] = m;
    if (imgUrl !== undefined) {
      const src = safeUrl(imgUrl);
      // eslint-disable-next-line @next/next/no-img-element
      out.push(src ? <img key={k++} src={src} alt={imgAlt} className="my-2 inline-block max-h-96 rounded" /> : whole);
    } else if (linkUrl !== undefined) {
      const href = safeUrl(linkUrl);
      const external = href?.startsWith("http");
      out.push(
        href ? (
          <a key={k++} href={href} className="text-[var(--accent)] underline" {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
            {inline(linkText, k * 100)}
          </a>
        ) : (
          linkText
        ),
      );
    } else if (bold !== undefined) out.push(<strong key={k++}>{inline(bold, k * 100)}</strong>);
    else if (italic !== undefined) out.push(<em key={k++}>{inline(italic, k * 100)}</em>);
    else if (code !== undefined) out.push(<code key={k++} className="rounded bg-[var(--st-subtle)] px-1">{code}</code>);
    rest = rest.slice(m.index + whole.length);
  }
  return out;
}

const withBreaks = (lines: string[]) => lines.map((l, i) => <Fragment key={i}>{i > 0 && <br />}{inline(l)}</Fragment>);

export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const cls = ["text-3xl font-bold mt-6 mb-3", "text-2xl font-semibold mt-6 mb-2", "text-xl font-semibold mt-4 mb-2"][h[1].length - 1];
      const Tag = (["h1", "h2", "h3"] as const)[h[1].length - 1];
      blocks.push(<Tag key={key++} className={cls}>{inline(h[2])}</Tag>);
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push(<hr key={key++} className="my-6 border-[var(--st-border)]" />);
      i++;
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ""));
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={key++} className={`my-3 space-y-1 pl-6 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((it, n) => <li key={n}>{inline(it)}</li>)}
        </List>,
      );
      continue;
    }
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) quote.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={key++} className="my-3 border-l-4 border-[var(--st-border)] pl-4 text-[var(--st-muted)]">{withBreaks(quote)}</blockquote>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|\s*([-*]|\d+\.)\s+|-{3,}$)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={key++} className="my-3 leading-relaxed">{withBreaks(para)}</p>);
  }
  return <div className="text-[var(--st-text)]">{blocks}</div>;
}
