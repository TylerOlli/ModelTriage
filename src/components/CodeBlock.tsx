"use client";

import { useState } from "react";

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

  return (
    <div className="relative group my-4">
      {/* Language label */}
      {language && (
        <div className="absolute top-2 left-3 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {language}
        </div>
      )}

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Copy code"
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>

      {/* Code content */}
      <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
        <code className="text-sm font-mono text-gray-800 block whitespace-pre">
          {code}
        </code>
      </pre>
    </div>
  );
}
