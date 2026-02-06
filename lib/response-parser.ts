/**
 * Parser for model responses with code blocks
 * Handles both fenced (```lang) and unfenced multi-line code
 */

export interface ContentSegment {
  type: "text" | "code";
  content: string;
  language?: string; // For fenced code blocks
}

/**
 * Parse a model response into text and code segments
 */
export function parseResponse(response: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const lines = response.split("\n");
  let i = 0;

  while (i < lines.length) {
    // Check for fenced code block
    const fenceMatch = lines[i].match(/^```(\w+)?/);
    if (fenceMatch) {
      const language = fenceMatch[1] || undefined;
      const codeLines: string[] = [];
      i++; // Skip opening fence

      // Collect lines until closing fence
      while (i < lines.length && !lines[i].match(/^```\s*$/)) {
        codeLines.push(lines[i]);
        i++;
      }

      if (codeLines.length > 0) {
        segments.push({
          type: "code",
          content: codeLines.join("\n"),
          language,
        });
      }

      i++; // Skip closing fence
      continue;
    }

    // Check for unfenced code (heuristic)
    if (isLikelyCodeStart(lines[i])) {
      const codeLines: string[] = [lines[i]];
      i++;

      // Collect consecutive lines that look like code
      while (i < lines.length && (isLikelyCodeLine(lines[i]) || lines[i].trim() === "")) {
        codeLines.push(lines[i]);
        i++;

        // Stop if we hit 2 consecutive empty lines (likely end of code)
        if (
          i >= 2 &&
          lines[i - 1].trim() === "" &&
          lines[i - 2].trim() === "" &&
          i < lines.length &&
          !isLikelyCodeLine(lines[i])
        ) {
          codeLines.pop(); // Remove last empty line
          break;
        }
      }

      // Only treat as code if we have at least 3 lines
      if (codeLines.length >= 3) {
        segments.push({
          type: "code",
          content: codeLines.join("\n").trim(),
        });
        continue;
      } else {
        // Wasn't enough for code block, treat as text
        i -= codeLines.length - 1; // Backtrack
      }
    }

    // Regular text line
    const textLines: string[] = [lines[i]];
    i++;

    // Collect consecutive text lines
    while (
      i < lines.length &&
      !lines[i].match(/^```/) &&
      !isLikelyCodeStart(lines[i])
    ) {
      textLines.push(lines[i]);
      i++;
    }

    const textContent = textLines.join("\n").trim();
    if (textContent.length > 0) {
      segments.push({
        type: "text",
        content: textContent,
      });
    }
  }

  return segments;
}

/**
 * Heuristic: does this line look like the start of a code block?
 */
function isLikelyCodeStart(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;

  // Common code starting patterns
  const codeStartPatterns = [
    /^(import|export|const|let|var|function|class|interface|type|enum)\s+/,
    /^(async\s+)?function\s*\w*\s*\(/,
    /^(public|private|protected)\s+/,
    /^\{[\s]*$/, // Opening brace alone
    /^\[[\s]*$/, // Opening bracket alone (JSON array)
    /^<\w+/, // HTML/JSX tag
  ];

  return codeStartPatterns.some((pattern) => pattern.test(trimmed));
}

/**
 * Heuristic: does this line look like it's part of code?
 */
function isLikelyCodeLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return true; // Empty lines are okay in code

  // Lines that look like code
  const codePatterns = [
    /[{}\[\];()]/, // Contains brackets, braces, parens, semicolons
    /^\s+/, // Starts with indentation
    /^(import|export|const|let|var|function|class|interface|type|enum|if|else|for|while|return|async|await)\s+/,
    /=>/, // Arrow function
    /^\s*\/\//, // Comment line
    /^\s*\/\*/, // Block comment start
    /^\s*\*/, // Block comment middle
    /^\s*\*\//, // Block comment end
    /:/, // Colon (common in JSON, object literals, type annotations)
  ];

  return codePatterns.some((pattern) => pattern.test(line));
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}
