"use client";

import { CodeBlock } from "./CodeBlock";
import { parseResponse } from "../../lib/response-parser";

interface FormattedResponseProps {
  response: string;
  mode?: "auto" | "compare";
}

export function FormattedResponse({ response, mode = "auto" }: FormattedResponseProps) {
  const segments = parseResponse(response);
  
  // In compare mode, extract first paragraph as lead
  let leadParagraph: string | null = null;
  let remainingSegments = segments;
  
  if (mode === "compare") {
    const firstTextSegmentIndex = segments.findIndex(s => s.type === "text" && s.content.trim());
    if (firstTextSegmentIndex !== -1) {
      const firstSegment = segments[firstTextSegmentIndex];
      const paragraphs = firstSegment.content.split("\n\n").filter((p) => p.trim());
      
      if (paragraphs.length > 0) {
        leadParagraph = paragraphs[0];
        
        remainingSegments = segments.map((seg, idx) => {
          if (idx === firstTextSegmentIndex) {
            const remainingParagraphs = paragraphs.slice(1);
            return {
              ...seg,
              content: remainingParagraphs.join("\n\n")
            };
          }
          return seg;
        }).filter(seg => seg.content.trim() !== "");
      }
    }
  }

  if (mode === "compare") {
    return (
      <div className="space-y-3">
        {leadParagraph && (
          <p className="text-[15px] font-medium text-neutral-900 leading-relaxed line-clamp-2">
            {leadParagraph}
          </p>
        )}
        
        {leadParagraph && remainingSegments.length > 0 && (
          <div className="h-px bg-neutral-200/60" />
        )}
        
        <div className="compare-content space-y-2.5 text-sm leading-relaxed">
          {remainingSegments.map((segment, index) => {
            if (segment.type === "code") {
              return (
                <CodeBlock
                  key={index}
                  code={segment.content}
                  language={segment.language}
                />
              );
            }

            const paragraphs = segment.content.split("\n\n").filter((p) => p.trim());
            return (
              <div key={index} className="space-y-2.5">
                {paragraphs.map((paragraph, pIndex) => (
                  <p key={pIndex} className="text-neutral-700 whitespace-pre-wrap">
                    {paragraph}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Auto mode
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

        const paragraphs = segment.content.split("\n\n").filter((p) => p.trim());
        return (
          <div key={index} className="space-y-3">
            {paragraphs.map((paragraph, pIndex) => (
              <p key={pIndex} className="text-[15px] text-neutral-700 leading-relaxed whitespace-pre-wrap">
                {paragraph}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
