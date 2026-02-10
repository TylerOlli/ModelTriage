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
    // TypeScript / JavaScript
    ".ts": { kind: "TypeScript file", language: "TypeScript" },
    ".tsx": { kind: "TypeScript React file", language: "TypeScript" },
    ".js": { kind: "JavaScript file", language: "JavaScript" },
    ".jsx": { kind: "JavaScript React file", language: "JavaScript" },
    ".mjs": { kind: "JavaScript module", language: "JavaScript" },
    ".cjs": { kind: "JavaScript CommonJS module", language: "JavaScript" },
    // Styling
    ".css": { kind: "CSS stylesheet", language: "CSS" },
    ".scss": { kind: "SCSS stylesheet", language: "SCSS" },
    ".sass": { kind: "Sass stylesheet", language: "Sass" },
    ".less": { kind: "Less stylesheet", language: "Less" },
    ".styl": { kind: "Stylus stylesheet", language: "Stylus" },
    ".pcss": { kind: "PostCSS stylesheet", language: "PostCSS" },
    // Markup / Templates
    ".html": { kind: "HTML file", language: "HTML" },
    ".htm": { kind: "HTML file", language: "HTML" },
    ".xml": { kind: "XML file", language: "XML" },
    ".svg": { kind: "SVG file", language: "SVG" },
    ".vue": { kind: "Vue component", language: "Vue" },
    ".svelte": { kind: "Svelte component", language: "Svelte" },
    ".astro": { kind: "Astro component", language: "Astro" },
    ".ejs": { kind: "EJS template", language: "EJS" },
    ".hbs": { kind: "Handlebars template", language: "Handlebars" },
    ".pug": { kind: "Pug template", language: "Pug" },
    // Systems languages
    ".py": { kind: "Python file", language: "Python" },
    ".java": { kind: "Java file", language: "Java" },
    ".kt": { kind: "Kotlin file", language: "Kotlin" },
    ".go": { kind: "Go file", language: "Go" },
    ".rs": { kind: "Rust file", language: "Rust" },
    ".cpp": { kind: "C++ file", language: "C++" },
    ".cc": { kind: "C++ file", language: "C++" },
    ".cxx": { kind: "C++ file", language: "C++" },
    ".c": { kind: "C file", language: "C" },
    ".h": { kind: "C/C++ header file", language: "C/C++" },
    ".hpp": { kind: "C++ header file", language: "C++" },
    ".cs": { kind: "C# file", language: "C#" },
    ".swift": { kind: "Swift file", language: "Swift" },
    ".m": { kind: "Objective-C file", language: "Objective-C" },
    ".scala": { kind: "Scala file", language: "Scala" },
    ".clj": { kind: "Clojure file", language: "Clojure" },
    ".ex": { kind: "Elixir file", language: "Elixir" },
    ".exs": { kind: "Elixir script", language: "Elixir" },
    ".erl": { kind: "Erlang file", language: "Erlang" },
    ".hs": { kind: "Haskell file", language: "Haskell" },
    ".lua": { kind: "Lua file", language: "Lua" },
    ".r": { kind: "R file", language: "R" },
    ".jl": { kind: "Julia file", language: "Julia" },
    ".dart": { kind: "Dart file", language: "Dart" },
    ".zig": { kind: "Zig file", language: "Zig" },
    ".nim": { kind: "Nim file", language: "Nim" },
    ".v": { kind: "V file", language: "V" },
    // Scripting
    ".rb": { kind: "Ruby file", language: "Ruby" },
    ".php": { kind: "PHP file", language: "PHP" },
    ".pl": { kind: "Perl file", language: "Perl" },
    ".sh": { kind: "shell script", language: "Shell" },
    ".bash": { kind: "Bash script", language: "Bash" },
    ".zsh": { kind: "Zsh script", language: "Zsh" },
    ".fish": { kind: "Fish script", language: "Fish" },
    ".ps1": { kind: "PowerShell script", language: "PowerShell" },
    // Database / Query
    ".sql": { kind: "SQL file", language: "SQL" },
    ".graphql": { kind: "GraphQL schema", language: "GraphQL" },
    ".gql": { kind: "GraphQL query", language: "GraphQL" },
    ".prisma": { kind: "Prisma schema", language: "Prisma" },
    // Config / Data
    ".json": { kind: "JSON file", language: "JSON" },
    ".jsonc": { kind: "JSON with comments file", language: "JSON" },
    ".json5": { kind: "JSON5 file", language: "JSON" },
    ".yaml": { kind: "YAML file", language: "YAML" },
    ".yml": { kind: "YAML file", language: "YAML" },
    ".toml": { kind: "TOML config file", language: "TOML" },
    ".ini": { kind: "INI config file", language: "INI" },
    ".env": { kind: "environment config file", language: "env" },
    ".cfg": { kind: "config file", language: "config" },
    ".conf": { kind: "config file", language: "config" },
    ".properties": { kind: "properties file", language: "Properties" },
    // Documentation / Text
    ".md": { kind: "Markdown document", language: "Markdown" },
    ".mdx": { kind: "MDX document", language: "MDX" },
    ".rst": { kind: "reStructuredText document", language: "RST" },
    ".tex": { kind: "LaTeX document", language: "LaTeX" },
    ".txt": { kind: "text file", language: "text" },
    ".csv": { kind: "CSV data file", language: "CSV" },
    ".tsv": { kind: "TSV data file", language: "TSV" },
    // Build / CI
    ".dockerfile": { kind: "Dockerfile", language: "Docker" },
    ".tf": { kind: "Terraform file", language: "Terraform" },
    ".proto": { kind: "Protocol Buffer file", language: "Protobuf" },
    ".gradle": { kind: "Gradle build file", language: "Gradle" },
    ".cmake": { kind: "CMake file", language: "CMake" },
    // Logs
    ".log": { kind: "log file", language: "text" },
  };

  const fileInfo = extMap[extension] || { kind: "text file", language: "text" };
  const signals: string[] = [];
  let topic = "code";

  // ===== Content-based detection =====

  // CSS / Styling detection
  if (fileInfo.language === "CSS" || fileInfo.language === "SCSS" || fileInfo.language === "Sass" || fileInfo.language === "Less" || fileInfo.language === "Stylus" || fileInfo.language === "PostCSS") {
    signals.push("styling");
    if (snippet.includes("@media")) {
      topic = "responsive layout styles";
      signals.push("responsive");
    } else if (snippet.includes("@keyframes") || snippet.includes("animation")) {
      topic = "animation and transition styles";
      signals.push("animations");
    } else if (snippet.includes(":root") || snippet.includes("--")) {
      topic = "CSS custom properties and theming";
      signals.push("CSS variables");
    } else if (snippet.includes("@tailwind") || snippet.includes("@apply")) {
      topic = "Tailwind CSS configuration";
      signals.push("Tailwind");
    } else if (snippet.includes("grid") || snippet.includes("flexbox") || snippet.includes("display: flex") || snippet.includes("display: grid")) {
      topic = "layout and positioning styles";
      signals.push("layout");
    } else if (snippet.includes(".dark") || snippet.includes("dark-mode") || snippet.includes("prefers-color-scheme")) {
      topic = "dark mode and theme styles";
      signals.push("theming");
    } else {
      topic = "styling rules and visual design";
    }
  }

  // HTML detection
  else if (fileInfo.language === "HTML") {
    signals.push("markup");
    if (snippet.includes("<form") || snippet.includes("<input")) {
      topic = "form layout and structure";
      signals.push("forms");
    } else if (snippet.includes("<table") || snippet.includes("<thead")) {
      topic = "table structure and data display";
      signals.push("tables");
    } else if (snippet.includes("<nav") || snippet.includes("<header") || snippet.includes("<footer")) {
      topic = "page layout and navigation";
      signals.push("navigation");
    } else {
      topic = "page structure and markup";
    }
  }

  // SQL detection
  else if (fileInfo.language === "SQL") {
    signals.push("database");
    if (snippet.includes("create table") || snippet.includes("alter table")) {
      topic = "database schema definitions";
      signals.push("schema");
    } else if (snippet.includes("select") && (snippet.includes("join") || snippet.includes("where"))) {
      topic = "database queries";
      signals.push("queries");
    } else if (snippet.includes("insert") || snippet.includes("update") || snippet.includes("delete")) {
      topic = "data manipulation queries";
      signals.push("mutations");
    } else if (snippet.includes("migration") || snippet.includes("seed")) {
      topic = "database migration";
      signals.push("migration");
    } else {
      topic = "database operations";
    }
  }

  // Shell script detection
  else if (fileInfo.language === "Shell" || fileInfo.language === "Bash" || fileInfo.language === "Zsh") {
    signals.push("scripting");
    if (snippet.includes("docker") || snippet.includes("container")) {
      topic = "Docker automation script";
      signals.push("Docker");
    } else if (snippet.includes("deploy") || snippet.includes("ci") || snippet.includes("cd")) {
      topic = "deployment and CI/CD script";
      signals.push("CI/CD");
    } else if (snippet.includes("install") || snippet.includes("setup")) {
      topic = "setup and installation script";
    } else {
      topic = "automation script";
    }
  }

  // GraphQL / Prisma detection
  else if (fileInfo.language === "GraphQL" || fileInfo.language === "Prisma") {
    signals.push("schema");
    if (snippet.includes("mutation") || snippet.includes("query") || snippet.includes("subscription")) {
      topic = "API schema and operations";
    } else if (snippet.includes("model") || snippet.includes("type")) {
      topic = "data model definitions";
    } else {
      topic = `${fileInfo.language} schema`;
    }
  }

  // Docker detection
  else if (fileInfo.language === "Docker" || filename.toLowerCase().includes("dockerfile")) {
    signals.push("Docker");
    topic = "container build configuration";
  }

  // Terraform / Infrastructure
  else if (fileInfo.language === "Terraform") {
    signals.push("infrastructure");
    topic = "infrastructure-as-code configuration";
  }

  // Vue / Svelte / Astro component detection
  else if (fileInfo.language === "Vue" || fileInfo.language === "Svelte" || fileInfo.language === "Astro") {
    signals.push(fileInfo.language);
    topic = `${fileInfo.language} component`;
  }

  // CSV / TSV data detection
  else if (fileInfo.language === "CSV" || fileInfo.language === "TSV") {
    signals.push("data");
    topic = "structured data";
  }

  // LaTeX detection
  else if (fileInfo.language === "LaTeX") {
    signals.push("academic");
    topic = "LaTeX document";
  }

  // Markdown / MDX detection
  else if (fileInfo.language === "Markdown" || fileInfo.language === "MDX") {
    signals.push("documentation");
    if (snippet.includes("# api") || snippet.includes("## endpoint")) {
      topic = "API documentation";
    } else if (snippet.includes("# readme") || snippet.includes("## installation") || snippet.includes("## getting started")) {
      topic = "project documentation";
    } else {
      topic = "documentation or content";
    }
  }

  // For all other code/config files, apply framework and pattern detection:
  else {
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

    // Detect class-based code
    if (snippet.includes("class ") && (snippet.includes("constructor") || snippet.includes("extends"))) {
      if (!topic || topic === "code") {
        topic = "class definitions";
        signals.push("OOP");
      }
    }
  }

  // ===== Universal detectors (apply to all file types) =====

  // Detect config files by filename
  if (filename.includes("config") || filename.includes("tsconfig") || filename.includes("package.json") || filename.includes("webpack") || filename.includes("vite") || filename.includes("eslint") || filename.includes("prettier")) {
    topic = "project configuration";
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

  // ===== Default topic: use the file language if topic is still generic =====
  if (topic === "code" && fileInfo.language && fileInfo.language !== "text") {
    topic = `${fileInfo.language} code`;
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
