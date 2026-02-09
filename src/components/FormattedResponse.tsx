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
    // Find first text segment with content
    const firstTextSegmentIndex = segments.findIndex(s => s.type === "text" && s.content.trim());
    if (firstTextSegmentIndex !== -1) {
      const firstSegment = segments[firstTextSegmentIndex];
      const paragraphs = firstSegment.content.split("\n\n").filter((p) => p.trim());
      
      if (paragraphs.length > 0) {
        leadParagraph = paragraphs[0];
        
        // Reconstruct segments without the lead paragraph
        remainingSegments = segments.map((seg, idx) => {
          if (idx === firstTextSegmentIndex) {
            // Remove first paragraph from this segment
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
      <div className="space-y-4">
        {/* Lead Line - emphasized first paragraph */}
        {leadParagraph && (
          <p className="text-base font-medium text-gray-900 leading-relaxed line-clamp-2">
            {leadParagraph}
          </p>
        )}
        
        {/* Hairline divider */}
        {leadParagraph && remainingSegments.length > 0 && (
          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
        )}
        
        {/* Rest of content with compare-specific styling */}
        <div className="compare-content space-y-2.5 text-[14px] leading-relaxed">
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

            // Text segment - render as paragraphs
            const paragraphs = segment.content.split("\n\n").filter((p) => p.trim());
            return (
              <div key={index} className="space-y-2.5">
                {paragraphs.map((paragraph, pIndex) => (
                  <p key={pIndex} className="text-gray-700 whitespace-pre-wrap">
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

  // Auto mode - original rendering
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
