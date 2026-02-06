/**
 * Utilities for normalizing and formatting code language labels
 */

export interface NormalizedLanguage {
  display: string | null; // User-facing label (e.g. "JavaScript", "TypeScript")
  highlightKey: string | null; // Key for syntax highlighter (e.g. "javascript", "typescript")
}

/**
 * Normalize a raw language tag into display label and highlighter key
 *
 * Handles common variations, aliases, and weird formats
 */
export function normalizeCodeLang(
  raw: string | undefined | null
): NormalizedLanguage {
  if (!raw || typeof raw !== "string") {
    return { display: null, highlightKey: null };
  }

  // Clean the input
  let cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^\./, "") // Remove leading dot (.js -> js)
    .replace(/^language-/, ""); // Remove language- prefix (language-js -> js)

  if (cleaned.length === 0) {
    return { display: null, highlightKey: null };
  }

  // Normalization map: input -> { display, highlightKey }
  const normalizationMap: Record<string, NormalizedLanguage> = {
    // JavaScript variants
    js: { display: "JavaScript", highlightKey: "javascript" },
    javascript: { display: "JavaScript", highlightKey: "javascript" },
    jsx: { display: "JSX", highlightKey: "jsx" },

    // TypeScript variants
    ts: { display: "TypeScript", highlightKey: "typescript" },
    typescript: { display: "TypeScript", highlightKey: "typescript" },
    tsx: { display: "TSX", highlightKey: "tsx" },

    // Python
    py: { display: "Python", highlightKey: "python" },
    python: { display: "Python", highlightKey: "python" },

    // Shell variants
    bash: { display: "Shell", highlightKey: "bash" },
    sh: { display: "Shell", highlightKey: "bash" },
    shell: { display: "Shell", highlightKey: "bash" },
    zsh: { display: "Shell", highlightKey: "bash" },

    // Markup variants
    html: { display: "HTML", highlightKey: "markup" },
    xml: { display: "XML", highlightKey: "markup" },
    markup: { display: "HTML", highlightKey: "markup" },

    // YAML variants
    yml: { display: "YAML", highlightKey: "yaml" },
    yaml: { display: "YAML", highlightKey: "yaml" },

    // Markdown variants
    md: { display: "Markdown", highlightKey: "markdown" },
    markdown: { display: "Markdown", highlightKey: "markdown" },

    // JSON
    json: { display: "JSON", highlightKey: "json" },

    // CSS variants
    css: { display: "CSS", highlightKey: "css" },
    scss: { display: "SCSS", highlightKey: "scss" },
    sass: { display: "Sass", highlightKey: "sass" },
    less: { display: "Less", highlightKey: "less" },

    // Go
    go: { display: "Go", highlightKey: "go" },
    golang: { display: "Go", highlightKey: "go" },

    // Rust
    rust: { display: "Rust", highlightKey: "rust" },
    rs: { display: "Rust", highlightKey: "rust" },

    // Java
    java: { display: "Java", highlightKey: "java" },

    // C variants
    c: { display: "C", highlightKey: "c" },
    cpp: { display: "C++", highlightKey: "cpp" },
    "c++": { display: "C++", highlightKey: "cpp" },
    cxx: { display: "C++", highlightKey: "cpp" },

    // C#
    cs: { display: "C#", highlightKey: "csharp" },
    csharp: { display: "C#", highlightKey: "csharp" },
    "c#": { display: "C#", highlightKey: "csharp" },

    // PHP
    php: { display: "PHP", highlightKey: "php" },

    // Ruby
    rb: { display: "Ruby", highlightKey: "ruby" },
    ruby: { display: "Ruby", highlightKey: "ruby" },

    // SQL
    sql: { display: "SQL", highlightKey: "sql" },

    // Other common languages
    kotlin: { display: "Kotlin", highlightKey: "kotlin" },
    swift: { display: "Swift", highlightKey: "swift" },
    dart: { display: "Dart", highlightKey: "dart" },
    elixir: { display: "Elixir", highlightKey: "elixir" },
    erlang: { display: "Erlang", highlightKey: "erlang" },
    haskell: { display: "Haskell", highlightKey: "haskell" },
    lua: { display: "Lua", highlightKey: "lua" },
    perl: { display: "Perl", highlightKey: "perl" },
    r: { display: "R", highlightKey: "r" },
    scala: { display: "Scala", highlightKey: "scala" },
    clojure: { display: "Clojure", highlightKey: "clojure" },
    docker: { display: "Dockerfile", highlightKey: "docker" },
    dockerfile: { display: "Dockerfile", highlightKey: "docker" },
    graphql: { display: "GraphQL", highlightKey: "graphql" },
    vim: { display: "Vim", highlightKey: "vim" },
    diff: { display: "Diff", highlightKey: "diff" },
    git: { display: "Git", highlightKey: "git" },
  };

  const normalized = normalizationMap[cleaned];
  if (normalized) {
    return normalized;
  }

  // Unknown language - hide label but keep raw for potential highlighting
  return { display: null, highlightKey: cleaned };
}
