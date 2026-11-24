import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export function preprocessLaTeX(content) {
  if (!content) return "";
  let out = content;

  // 1. Convert \[ ... \] to display math ($$ ... $$)
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => `\n$$\n${eq.trim()}\n$$\n`);

  // 2. Convert \( ... \) to inline math ($ ... $)
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_, eq) => `$${eq.trim()}$`);

  // 3. Fallback: catch any bracketed math like [\mathbf{...} ...] or [\frac{...} ...] if backslashes were stripped
  out = out.replace(/(?:^|\n)\s*\[\s*(\\+[a-zA-Z]+[\s\S]*?)\s*\](?:\s*|$)/gm, (_, eq) => `\n$$\n${eq.trim()}\n$$\n`);
  out = out.replace(/\(\s*(\\+[a-zA-Z]+[\s\S]*?)\s*\)/g, (_, eq) => `$${eq.trim()}$`);

  return out;
}

export default function MarkdownView({ content, className = "prose-chat" }) {
  const processed = useMemo(() => preprocessLaTeX(content), [content]);

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
