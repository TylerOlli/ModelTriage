/**
 * Image Gist Schema for Vision Models
 * 
 * When a vision model processes an image, it outputs a structured gist
 * that describes what it saw at a high level.
 */

export interface ImageGist {
  kind: "code_screenshot" | "terminal_output" | "ui_screenshot" | "diagram" | "unknown";
  language: string; // e.g., "JavaScript", "TypeScript", "Python", "unknown"
  purpose: string;  // 3-8 word high-level description or "unknown"
  certainty: "high" | "low";
}

/**
 * Build the IMAGE_GIST instruction for vision models
 * This prepends to the user's prompt when images are attached
 */
export function buildImageGistInstruction(userPrompt: string): string {
  return `CRITICAL INSTRUCTION - You MUST output IMAGE_GIST as your FIRST LINE before answering.

Format (NO markdown, NO code fences, exactly one line):
IMAGE_GIST: {"kind":"code_screenshot","language":"JavaScript","purpose":"authentication logic","certainty":"high"}

Schema requirements:
- kind: "code_screenshot" | "terminal_output" | "ui_screenshot" | "diagram" | "unknown"
- language: Programming language name (e.g., "JavaScript", "TypeScript", "Python") or "unknown"
- purpose: 3-8 word description of what the code/image does (e.g., "REST API handler", "utility function for parsing", "npm build error") or "unknown"
- certainty: "high" (confident about language AND purpose) | "low" (unsure, set language/purpose to "unknown")

RULES:
1. OUTPUT IMAGE_GIST AS THE VERY FIRST LINE (before any other text)
2. Use EXACTLY this format: IMAGE_GIST: {json}
3. DO NOT use markdown, code fences, or any formatting around the JSON
4. If you cannot confidently determine language or purpose, set them to "unknown" and certainty to "low"
5. DO NOT guess - accuracy is more important than specificity
6. After IMAGE_GIST, add a blank line, then provide your normal answer

Example correct output:
IMAGE_GIST: {"kind":"code_screenshot","language":"TypeScript","purpose":"user authentication handler","certainty":"high"}

The TypeScript code implements a secure authentication system...

---

User's question: ${userPrompt}`;
}

/**
 * Parse IMAGE_GIST from vision model response
 * Returns the gist and the remaining text (without the gist line)
 */
export function parseImageGist(response: string): {
  gist: ImageGist | null;
  cleanedResponse: string;
  parseError?: string;
} {
  const isDev = process.env.NODE_ENV !== "production";
  const lines = response.split('\n');
  let gist: ImageGist | null = null;
  let gistLineIndex = -1;
  let parseError: string | undefined;

  // Look for IMAGE_GIST in the first few lines
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim();
    if (line.startsWith('IMAGE_GIST:')) {
      try {
        const jsonStr = line.substring('IMAGE_GIST:'.length).trim();
        
        if (isDev) {
          console.log('[IMAGE_GIST] Found IMAGE_GIST line:', line);
          console.log('[IMAGE_GIST] Extracted JSON string:', jsonStr);
        }
        
        const parsed = JSON.parse(jsonStr);
        
        // Validate schema
        if (
          !parsed.kind ||
          !parsed.language ||
          !parsed.purpose ||
          !parsed.certainty ||
          !['high', 'low'].includes(parsed.certainty)
        ) {
          parseError = `Invalid IMAGE_GIST schema: missing or invalid fields. Got: ${JSON.stringify(parsed)}`;
          if (isDev) {
            console.warn('[IMAGE_GIST] Schema validation failed:', parseError);
          }
        } else {
          gist = parsed as ImageGist;
          gistLineIndex = i;
          if (isDev) {
            console.log('[IMAGE_GIST] Successfully parsed:', gist);
          }
        }
      } catch (err) {
        parseError = `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`;
        if (isDev) {
          console.warn('[IMAGE_GIST] Parse error:', parseError);
          console.warn('[IMAGE_GIST] Attempted to parse line:', lines[i]);
        }
      }
      break;
    }
  }

  // If parsing failed, create fallback gist
  if (!gist && parseError) {
    if (isDev) {
      console.warn('[IMAGE_GIST] Using fallback gist due to parse failure');
    }
    gist = {
      kind: "unknown",
      language: "unknown",
      purpose: "unknown",
      certainty: "low"
    };
  }

  // Remove IMAGE_GIST line and following blank line from response
  let cleanedResponse = response;
  if (gistLineIndex >= 0) {
    const remainingLines = lines.slice(gistLineIndex + 1);
    // Skip blank lines after IMAGE_GIST
    let startIndex = 0;
    while (startIndex < remainingLines.length && remainingLines[startIndex].trim() === '') {
      startIndex++;
    }
    cleanedResponse = remainingLines.slice(startIndex).join('\n').trim();
  }

  return { gist, cleanedResponse, parseError };
}

/**
 * Generate routing reason from IMAGE_GIST
 * Uses gist as single source of truth for routing explanation
 */
export function generateRoutingReasonFromGist(
  gist: ImageGist,
  modelDisplayName: string
): string {
  const isDev = process.env.NODE_ENV !== "production";
  
  if (isDev) {
    console.log('[IMAGE_GIST] Generating routing reason from gist:', gist);
  }
  
  // High certainty with known language AND purpose
  if (
    gist.certainty === "high" &&
    gist.language !== "unknown" &&
    gist.purpose !== "unknown"
  ) {
    const reason = `This screenshot shows ${gist.language} code for ${gist.purpose}, and ${modelDisplayName} is well-suited for extracting and interpreting code from images.`;
    if (isDev) {
      console.log('[IMAGE_GIST] Generated high-certainty reason with language and purpose');
    }
    return reason;
  }
  
  // Known language but not purpose (or lower certainty)
  if (gist.language !== "unknown") {
    const reason = `This screenshot shows ${gist.language} code, and ${modelDisplayName} is well-suited for extracting and interpreting code from images.`;
    if (isDev) {
      console.log('[IMAGE_GIST] Generated reason with language only');
    }
    return reason;
  }
  
  // Fallback: unknown language
  const reason = `This request includes a screenshot of code, and ${modelDisplayName} is well-suited for extracting and interpreting code from images.`;
  if (isDev) {
    console.log('[IMAGE_GIST] Generated generic fallback reason (unknown language)');
  }
  return reason;
}
