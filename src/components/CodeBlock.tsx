"use client";

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { normalizeCodeLang } from "../../lib/code-lang-utils";

interface CodeBlockProps {
  code: string;
  language?: string;
}

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
  comment: { color: "#6b7280" },
  prolog: { color: "#6b7280" },
  doctype: { color: "#6b7280" },
  cdata: { color: "#6b7280" },
  punctuation: { color: "#94a3b8" },
  property: { color: "#7dd3fc" },
  tag: { color: "#7dd3fc" },
  constant: { color: "#7dd3fc" },
  symbol: { color: "#7dd3fc" },
  deleted: { color: "#ef4444" },
  boolean: { color: "#a78bfa" },
  number: { color: "#a78bfa" },
  selector: { color: "#86efac" },
  "attr-name": { color: "#86efac" },
  string: { color: "#86efac" },
  char: { color: "#86efac" },
  builtin: { color: "#86efac" },
  inserted: { color: "#86efac" },
  operator: { color: "#cbd5e1" },
  entity: { color: "#cbd5e1" },
  url: { color: "#cbd5e1" },
  variable: { color: "#cbd5e1" },
  atrule: { color: "#fbbf24" },
  "attr-value": { color: "#fbbf24" },
  function: { color: "#fbbf24" },
  "class-name": { color: "#fbbf24" },
  keyword: { color: "#fb923c" },
  regex: { color: "#f472b6" },
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

  const normalized = normalizeCodeLang(language);
  const { display: displayLabel, highlightKey } = normalized;

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-neutral-200 bg-[#1e1e2e]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#181825] border-b border-neutral-700/50">
        <div className="text-sm font-medium text-neutral-500 font-mono">
          {displayLabel || <span className="opacity-0">-</span>}
        </div>

        <button
          onClick={handleCopy}
          className="px-2.5 py-1 text-sm font-medium text-neutral-400 hover:text-neutral-200 rounded-md hover:bg-white/5 transition-colors duration-150"
          aria-label="Copy code"
        >
          {copied ? "\u2713 Copied" : "Copy"}
        </button>
      </div>

      {/* Code content */}
      {highlightKey ? (
        <SyntaxHighlighter
          language={highlightKey}
          style={refinedDarkTheme}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: "0.8125rem",
            lineHeight: "1.6",
            padding: "1rem",
            background: "transparent",
          }}
          codeTagProps={{
            style: {
              fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace",
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
      ) : (
        <pre className="p-4 overflow-x-auto">
          <code className="text-[13px] leading-relaxed font-mono text-neutral-200 block whitespace-pre">
            {code}
          </code>
        </pre>
      )}
    </div>
  );
}
