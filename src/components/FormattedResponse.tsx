"use client";

import { CodeBlock } from "./CodeBlock";
import { parseResponse } from "../../lib/response-parser";

interface FormattedResponseProps {
  response: string;
}

export function FormattedResponse({ response }: FormattedResponseProps) {
  const segments = parseResponse(response);

  return (
    <div className="space-y-3">
      {segments.map((segment, index) => {
        if (segment.type === "code") {
          return (
            <CodeBlock
              key={index}
              code={segment.content}
              language={segment.language}
            />
          );
        }

        // Text segment - render as paragraphs
        const paragraphs = segment.content.split("\n\n").filter((p) => p.trim());
        return (
          <div key={index} className="space-y-3">
            {paragraphs.map((paragraph, pIndex) => (
              <p key={pIndex} className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {paragraph}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
