/**
 * Attachment gist generator
 * Produces lightweight, structured summaries of attachments for routing explanations
 */

export interface AttachmentGist {
  kind: string; // "TypeScript file", "log file", "screenshot of code", etc.
  language?: string; // "TypeScript", "JavaScript", "Python", etc.
  topic: string; // 3-8 word description
  signals: string[]; // Optional indicators like ["imports react", "error codes"]
}

/**
 * Generate a lightweight gist of text/code file contents
 * Uses only the first ~500 chars to stay token-safe
 */
export function getTextFileGist(
  filename: string,
  content: string,
  extension: string
): AttachmentGist {
  // Use only first 500 chars for quick analysis
  const snippet = content.substring(0, 500).toLowerCase();
  
  // Determine kind and language from extension
  const extMap: Record<string, { kind: string; language: string }> = {
    ".ts": { kind: "TypeScript file", language: "TypeScript" },
    ".tsx": { kind: "TypeScript React file", language: "TypeScript" },
    ".js": { kind: "JavaScript file", language: "JavaScript" },
    ".jsx": { kind: "JavaScript React file", language: "JavaScript" },
    ".py": { kind: "Python file", language: "Python" },
    ".java": { kind: "Java file", language: "Java" },
    ".go": { kind: "Go file", language: "Go" },
    ".rs": { kind: "Rust file", language: "Rust" },
    ".cpp": { kind: "C++ file", language: "C++" },
    ".c": { kind: "C file", language: "C" },
    ".json": { kind: "JSON config", language: "JSON" },
    ".yaml": { kind: "YAML config", language: "YAML" },
    ".yml": { kind: "YAML config", language: "YAML" },
    ".md": { kind: "Markdown document", language: "Markdown" },
    ".log": { kind: "log file", language: "text" },
    ".txt": { kind: "text file", language: "text" },
  };

  const fileInfo = extMap[extension] || { kind: "text file", language: "text" };
  const signals: string[] = [];
  let topic = "code";

  // Detect React/Next.js
  if (snippet.includes("import react") || snippet.includes("from 'react'") || snippet.includes('from "react"')) {
    signals.push("React");
    if (snippet.includes("usestate") || snippet.includes("useeffect")) {
      topic = "React component with hooks";
    } else if (snippet.includes("export default function") || snippet.includes("const ") && snippet.includes("=>")) {
      topic = "React component";
    } else {
      topic = "React code";
    }
  }

  // Detect Next.js
  if (snippet.includes("next/") || snippet.includes("from 'next") || snippet.includes('from "next')) {
    signals.push("Next.js");
    if (snippet.includes("app/") || snippet.includes("route.")) {
      topic = "Next.js API route";
    } else if (snippet.includes("page.")) {
      topic = "Next.js page component";
    }
  }

  // Detect API/route handlers
  if (snippet.includes("export async function get") || snippet.includes("export async function post")) {
    topic = "API route handler";
    signals.push("API handler");
  }

  // Detect utility/helper functions
  if (snippet.includes("export function") || snippet.includes("export const")) {
    if (!signals.includes("React") && !signals.includes("Next.js")) {
      topic = "utility functions";
      signals.push("exports");
    }
  }

  // Detect type definitions
  if (snippet.includes("interface ") || snippet.includes("type ") || snippet.includes("enum ")) {
    if (!topic || topic === "code") {
      topic = "type definitions";
      signals.push("types");
    }
  }

  // Detect config files
  if (filename.includes("config") || filename.includes("tsconfig") || filename.includes("package.json")) {
    topic = "configuration";
    signals.push("config");
  }

  // Detect errors/logs
  if (snippet.includes("error:") || snippet.includes("exception") || snippet.includes("stack trace")) {
    topic = "error log or stack trace";
    signals.push("error codes");
    if (!fileInfo.kind.includes("log")) {
      fileInfo.kind = "log file";
    }
  }

  // Detect build/deployment output
  if (snippet.includes("build") && snippet.includes("failed")) {
    topic = "build error output";
    signals.push("build failure");
  }

  // Detect test files
  if (filename.includes(".test.") || filename.includes(".spec.") || snippet.includes("describe(") || snippet.includes("it(")) {
    topic = "test file";
    signals.push("tests");
  }

  return {
    kind: fileInfo.kind,
    language: fileInfo.language,
    topic,
    signals,
  };
}

/**
 * Generate a lightweight gist for an image (for future vision API integration)
 * For now, uses prompt-based heuristics
 */
export function getImageGist(
  filename: string,
  prompt: string
): AttachmentGist {
  const promptLower = prompt.toLowerCase();
  
  let kind = "image";
  let topic = "visual content";
  const signals: string[] = [];

  // Infer from prompt what kind of image it might be
  if (promptLower.includes("code") || promptLower.includes("function") || promptLower.includes("syntax")) {
    kind = "screenshot of code";
    topic = "code snippet or file";
    signals.push("code");
  } else if (promptLower.includes("error") || promptLower.includes("terminal") || promptLower.includes("console")) {
    kind = "screenshot of terminal output";
    topic = "error message or command output";
    signals.push("terminal");
  } else if (promptLower.includes("ui") || promptLower.includes("interface") || promptLower.includes("design") || promptLower.includes("button")) {
    kind = "screenshot of UI";
    topic = "user interface or design";
    signals.push("UI");
  } else if (promptLower.includes("diagram") || promptLower.includes("chart") || promptLower.includes("architecture")) {
    kind = "diagram or chart";
    topic = "visual diagram";
    signals.push("diagram");
  } else if (filename.toLowerCase().includes("screenshot")) {
    kind = "screenshot";
    topic = "screen capture";
  }

  return {
    kind,
    topic,
    signals,
  };
}

/**
 * Get a combined gist for multiple attachments
 * Returns the most relevant gist (prioritizes images, then code files)
 */
export function getAttachmentsGist(
  attachments: Array<{ type: string; filename?: string; content?: string; extension?: string }>,
  prompt: string
): AttachmentGist | null {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  // Prioritize images (most visually distinctive)
  const imageAttachment = attachments.find(a => a.type === "image");
  if (imageAttachment) {
    return getImageGist(imageAttachment.filename || "image", prompt);
  }

  // Then code/text files
  const textAttachment = attachments.find(a => a.type === "text" && a.content);
  if (textAttachment && textAttachment.content) {
    return getTextFileGist(
      textAttachment.filename || "file",
      textAttachment.content,
      textAttachment.extension || ".txt"
    );
  }

  return null;
}
