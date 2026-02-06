"use client";

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { normalizeCodeLang } from "../../lib/code-lang-utils";

interface CodeBlockProps {
  code: string;
  language?: string;
}

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
    <div className="my-4 rounded-lg overflow-hidden border border-gray-800 bg-gray-900">
      {/* Header row - always present to maintain consistent layout */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        {/* Language label (left) */}
        <div className="text-xs font-medium text-gray-400">
          {displayLabel || <span className="opacity-0">-</span>}
        </div>

        {/* Copy button (right) */}
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-xs font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 transition-colors"
          aria-label="Copy code"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      {/* Code content - no absolute positioning */}
      {highlightKey ? (
        <SyntaxHighlighter
          language={highlightKey}
          style={oneDark}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: "0.875rem",
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
        // Fallback for no language - plain monospace
        <pre className="p-4 overflow-x-auto">
          <code className="text-sm font-mono text-gray-300 block whitespace-pre">
            {code}
          </code>
        </pre>
      )}
    </div>
  );
}
