"use client";

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeBlockProps {
  code: string;
  language?: string;
}

// Map common language aliases to supported languages
const languageMap: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  jsx: "jsx",
  tsx: "tsx",
  py: "python",
  rb: "ruby",
  sh: "bash",
  yml: "yaml",
  json: "json",
  md: "markdown",
  html: "markup",
  xml: "markup",
  css: "css",
  scss: "scss",
  go: "go",
  rust: "rust",
  java: "java",
  c: "c",
  cpp: "cpp",
  cs: "csharp",
  php: "php",
  sql: "sql",
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

  // Normalize language name
  const normalizedLanguage = language
    ? languageMap[language.toLowerCase()] || language.toLowerCase()
    : undefined;

  return (
    <div className="relative group my-4">
      {/* Language label */}
      {language && (
        <div className="absolute top-2 left-3 text-xs font-medium text-gray-400 bg-gray-800 px-2 py-1 rounded z-10">
          {language}
        </div>
      )}

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-3 py-1 text-xs font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100 z-10"
        aria-label="Copy code"
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>

      {/* Code content with syntax highlighting */}
      {normalizedLanguage ? (
        <SyntaxHighlighter
          language={normalizedLanguage}
          style={oneDark}
          customStyle={{
            margin: 0,
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            padding: "1rem",
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
        <pre className="bg-gray-900 border border-gray-800 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-gray-300 block whitespace-pre">
            {code}
          </code>
        </pre>
      )}
    </div>
  );
}
