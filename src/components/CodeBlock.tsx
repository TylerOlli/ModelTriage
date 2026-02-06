"use client";

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { normalizeCodeLang } from "../../lib/code-lang-utils";

interface CodeBlockProps {
  code: string;
  language?: string;
}

// Refined version of oneDark with reduced saturation and brightness
const refinedDarkTheme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: "transparent",
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: "transparent",
  },
  // Reduce brightness of syntax colors by ~15%
  comment: { color: "#6b7280" }, // More muted gray
  prolog: { color: "#6b7280" },
  doctype: { color: "#6b7280" },
  cdata: { color: "#6b7280" },
  punctuation: { color: "#94a3b8" }, // Softer punctuation
  property: { color: "#7dd3fc" }, // Less bright cyan
  tag: { color: "#7dd3fc" },
  constant: { color: "#7dd3fc" },
  symbol: { color: "#7dd3fc" },
  deleted: { color: "#ef4444" },
  boolean: { color: "#a78bfa" }, // Softer purple
  number: { color: "#a78bfa" },
  selector: { color: "#86efac" }, // Softer green
  "attr-name": { color: "#86efac" },
  string: { color: "#86efac" },
  char: { color: "#86efac" },
  builtin: { color: "#86efac" },
  inserted: { color: "#86efac" },
  operator: { color: "#cbd5e1" }, // Muted
  entity: { color: "#cbd5e1" },
  url: { color: "#cbd5e1" },
  variable: { color: "#cbd5e1" },
  atrule: { color: "#fbbf24" }, // Softer yellow
  "attr-value": { color: "#fbbf24" },
  function: { color: "#fbbf24" },
  "class-name": { color: "#fbbf24" },
  keyword: { color: "#fb923c" }, // Softer orange
  regex: { color: "#f472b6" }, // Softer pink
  important: { color: "#f472b6" },
};

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  // Normalize language tag
  const normalized = normalizeCodeLang(language);
  const { display: displayLabel, highlightKey } = normalized;

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-slate-300 bg-slate-800 shadow-sm">
      {/* Header row - refined with softer contrast */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-700/80 border-b border-slate-600/50">
        {/* Language label (left) - muted and informational */}
        <div className="text-xs font-medium text-slate-400">
          {displayLabel || <span className="opacity-0">-</span>}
        </div>

        {/* Copy button (right) - subtle styling */}
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-xs font-medium text-slate-300 bg-slate-600/60 border border-slate-500/40 rounded hover:bg-slate-600 hover:border-slate-400/60 transition-colors"
          aria-label="Copy code"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      {/* Code content - comfortable padding and sizing */}
      {highlightKey ? (
        <SyntaxHighlighter
          language={highlightKey}
          style={refinedDarkTheme}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: "0.8125rem", // 13px - slightly smaller than body
            lineHeight: "1.6",
            padding: "1rem",
            background: "transparent",
          }}
          codeTagProps={{
            style: {
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
      ) : (
        // Fallback for no language - plain monospace with consistent styling
        <pre className="p-4 overflow-x-auto">
          <code className="text-[13px] leading-relaxed font-mono text-slate-200 block whitespace-pre">
            {code}
          </code>
        </pre>
      )}
    </div>
  );
}
