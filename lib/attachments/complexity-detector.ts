/**
 * Complexity detection for model escalation
 */

/**
 * Keywords that indicate complex/deep reasoning requirements
 */
const COMPLEXITY_KEYWORDS = [
  "design",
  "architecture",
  "multi-file",
  "refactor across",
  "performance optimization",
  "security audit",
  "migrate",
  "implement end-to-end",
  "system design",
  "scale",
  "best practices",
  "trade-offs",
  "compare approaches",
  "evaluate",
  "architecture decision",
  "full implementation",
  "production-ready",
];

/**
 * Detect if a request requires deep reasoning/complex analysis
 */
export function requiresDeepReasoning(params: {
  prompt: string;
  totalTextChars: number;
  hasTextFiles: boolean;
}): boolean {
  const { prompt, totalTextChars, hasTextFiles } = params;

  // Large attachments suggest complex analysis
  if (totalTextChars > 12000) {
    return true;
  }

  // Check for complexity keywords in prompt
  const promptLower = prompt.toLowerCase();
  const hasComplexityKeyword = COMPLEXITY_KEYWORDS.some((keyword) =>
    promptLower.includes(keyword)
  );

  if (hasComplexityKeyword) {
    return true;
  }

  // Multi-file scenarios with moderate size
  if (hasTextFiles && totalTextChars > 6000) {
    return true;
  }

  return false;
}

/**
 * Detect if a request is lightweight/simple
 */
export function isLightweightRequest(params: {
  promptChars: number;
  totalTextChars: number;
  imageCount: number;
  textFileCount: number;
}): boolean {
  const { promptChars, totalTextChars, imageCount, textFileCount } = params;

  // Short prompt, single image, no other attachments
  // BUT not if it's clearly asking for detailed code extraction/analysis
  if (promptChars < 100 && imageCount === 1 && textFileCount === 0) {
    return true;
  }

  // Short prompt, small text attachment
  if (promptChars < 200 && totalTextChars < 4000 && imageCount === 0) {
    return true;
  }

  return false;
}

/**
 * Detect if prompt/attachments are code-related
 */
export function isCodeRelated(params: {
  prompt: string;
  textFileTypes: string[];
}): boolean {
  const { prompt, textFileTypes } = params;

  // Check file extensions
  const codeExtensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".go", ".rs", ".cpp", ".c", ".h"];
  const hasCodeFile = textFileTypes.some((ext) => codeExtensions.includes(ext));

  if (hasCodeFile) {
    return true;
  }

  // Check prompt for code-related keywords
  const promptLower = prompt.toLowerCase();
  const codeKeywords = [
    "code",
    "function",
    "implement",
    "debug",
    "error",
    "stack trace",
    "bug",
    "typescript",
    "javascript",
    "python",
    "refactor",
  ];

  return codeKeywords.some((keyword) => promptLower.includes(keyword));
}
