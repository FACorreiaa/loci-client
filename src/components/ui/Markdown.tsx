import { Component } from "solid-js";

/**
 * Tiny dependency-free markdown renderer for assistant chat text.
 *
 * Safe by construction: the raw input is HTML-escaped FIRST, then a known,
 * fixed set of tags is generated from that escaped text. Link hrefs are
 * scheme-checked. No user-derived HTML ever reaches the DOM, so there is no
 * injection surface (hence no need for a sanitizer dependency).
 *
 * Supported: headings (#..######), bold (**), italic (* / _), inline code (`),
 * fenced code blocks (```), links [t](url), unordered (-/*) and ordered (1.)
 * lists, paragraphs and line breaks.
 */

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const safeUrl = (raw: string) => {
  const url = raw.trim();
  return /^(https?:|mailto:)/i.test(url) ? url : "#";
};

// Inline formatting — input is already HTML-escaped.
const inline = (text: string) =>
  text
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-[0.85em]">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
      return `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer" class="text-primary underline underline-offset-2">${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");

export const renderMarkdown = (md: string): string => {
  const escaped = escapeHtml(md ?? "");
  const lines = escaped.split("\n");
  const out: string[] = [];

  let listType: "ul" | "ol" | null = null;
  let inCode = false;
  let codeBuf: string[] = [];
  let paragraph: string[] = [];

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };
  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };

  for (const line of lines) {
    const fence = line.trim().startsWith("```");
    if (fence) {
      if (inCode) {
        out.push(
          `<pre class="my-2 p-3 rounded-lg bg-muted overflow-x-auto text-xs"><code>${codeBuf.join("\n")}</code></pre>`,
        );
        codeBuf = [];
        inCode = false;
      } else {
        flushParagraph();
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      const size = level <= 2 ? "text-lg" : level === 3 ? "text-base" : "text-sm";
      out.push(
        `<h${level} class="font-semibold ${size} mt-2 mb-1">${inline(heading[2])}</h${level}>`,
      );
      continue;
    }

    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushParagraph();
      const wanted = ul ? "ul" : "ol";
      if (listType !== wanted) {
        closeList();
        const cls = wanted === "ul" ? "list-disc" : "list-decimal";
        out.push(`<${wanted} class="${cls} pl-5 space-y-0.5 my-1">`);
        listType = wanted;
      }
      out.push(`<li>${inline((ul || ol)![1])}</li>`);
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      closeList();
      continue;
    }

    paragraph.push(line.trim());
  }

  if (inCode && codeBuf.length) {
    out.push(
      `<pre class="my-2 p-3 rounded-lg bg-muted overflow-x-auto text-xs"><code>${codeBuf.join("\n")}</code></pre>`,
    );
  }
  flushParagraph();
  closeList();

  return out.join("\n");
};

export interface MarkdownProps {
  text: string;
  class?: string;
}

const Markdown: Component<MarkdownProps> = (props) => {
  return (
    <div
      class={`prose-chat space-y-1 ${props.class ?? ""}`}
      // Content is escaped-then-rebuilt above; only our own tags are emitted.
      // eslint-disable-next-line solid/no-innerhtml
      innerHTML={renderMarkdown(props.text)}
    />
  );
};

export default Markdown;
