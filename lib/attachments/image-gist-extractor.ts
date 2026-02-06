/**
 * Extract image understanding from vision model response
 * Parses the model's response to infer what it saw in the image
 */

export interface ImageGist {
  kind: "code screenshot" | "terminal output" | "UI screenshot" | "diagram" | "unknown";
  language?: string;
  purpose?: string;
}

/**
 * Analyze vision model response to extract what it understood about the image
 * Uses keyword detection and pattern matching to infer image contents
 */
export function extractImageGistFromResponse(
  response: string,
  prompt: string
): ImageGist {
  const responseLower = response.toLowerCase();
  const promptLower = prompt.toLowerCase();
  
  let kind: ImageGist["kind"] = "unknown";
  let language: string | undefined;
  let purpose: string | undefined;
  
  // Count code-related signals vs UI signals to resolve ambiguity
  const codeSignals = [
    "code", "function", "class", "method", "variable", "import", "const ", 
    "let ", "def ", "typescript", "javascript", "python", "java ", "react",
    "component", "hook"
  ].filter(keyword => responseLower.includes(keyword)).length;
  
  const uiSignals = [
    "button", "interface", "ui ", "user interface", "webpage", "website",
    "layout", "design", "menu"
  ].filter(keyword => responseLower.includes(keyword)).length;
  
  // Detect terminal output / error messages
  if (
    responseLower.includes("terminal") ||
    responseLower.includes("command line") ||
    responseLower.includes("shell") ||
    responseLower.includes("error message") ||
    responseLower.includes("stack trace") ||
    (responseLower.includes("error") && responseLower.includes("output"))
  ) {
    kind = "terminal output";
    
    if (responseLower.includes("build error") || responseLower.includes("compilation error")) {
      purpose = "build error";
    } else if (responseLower.includes("dependency") || responseLower.includes("npm") || responseLower.includes("package")) {
      purpose = "dependency error";
    } else if (responseLower.includes("runtime error") || responseLower.includes("exception")) {
      purpose = "runtime error";
    } else {
      purpose = "error message";
    }
  }
  // Detect diagrams (before UI/code)
  else if (
    responseLower.includes("diagram") ||
    responseLower.includes("chart") ||
    responseLower.includes("graph") ||
    responseLower.includes("flowchart") ||
    responseLower.includes("architecture")
  ) {
    kind = "diagram";
    purpose = "visual diagram";
  }
  // Detect code screenshots (prioritized when code signals > UI signals)
  else if (
    codeSignals > 0 && (codeSignals > uiSignals || promptLower.includes("code"))
  ) {
    kind = "code screenshot";
    
    // Detect language
    if (responseLower.includes("javascript") || responseLower.includes("js ")) {
      language = "JavaScript";
    } else if (responseLower.includes("typescript") || responseLower.includes("ts ")) {
      language = "TypeScript";
    } else if (responseLower.includes("python")) {
      language = "Python";
    } else if (responseLower.includes("java ") && !responseLower.includes("javascript")) {
      language = "Java";
    } else if (responseLower.includes("c++") || responseLower.includes("cpp")) {
      language = "C++";
    } else if (responseLower.includes("rust")) {
      language = "Rust";
    } else if (responseLower.includes("go ") || responseLower.includes("golang")) {
      language = "Go";
    } else if (responseLower.includes("react")) {
      language = "React";
    }
    
    // Detect purpose
    if (responseLower.includes("component")) {
      purpose = "component implementation";
    } else if (responseLower.includes("api") || responseLower.includes("endpoint") || responseLower.includes("route")) {
      purpose = "API handler";
    } else if (responseLower.includes("utility") || responseLower.includes("helper")) {
      purpose = "utility function";
    } else if (responseLower.includes("hook")) {
      purpose = "custom hook";
    } else if (responseLower.includes("type") || responseLower.includes("interface")) {
      purpose = "type definitions";
    } else if (responseLower.includes("config")) {
      purpose = "configuration";
    } else if (responseLower.includes("test")) {
      purpose = "test code";
    } else if (responseLower.includes("authentication") || responseLower.includes("auth")) {
      purpose = "authentication logic";
    } else if (responseLower.includes("database") || responseLower.includes("query")) {
      purpose = "database operations";
    } else if (responseLower.includes("validation") || responseLower.includes("validates")) {
      purpose = "validation logic";
    } else {
      purpose = "application logic";
    }
  }
  // Detect UI screenshots (only when UI signals dominate)
  else if (uiSignals > 0) {
    kind = "UI screenshot";
    purpose = "user interface";
  }
  
  return { kind, language, purpose };
}

/**
 * Generate a routing reason from image gist
 */
export function generateImageBasedReason(
  imageGist: ImageGist,
  modelName: string
): string {
  const { kind, language, purpose } = imageGist;
  
  // Terminal output
  if (kind === "terminal output") {
    return `This image contains terminal output showing ${purpose || "command execution"}, and ${modelName} is effective at interpreting visual error messages and suggesting fixes.`;
  }
  
  // UI screenshot
  if (kind === "UI screenshot") {
    return `This screenshot shows a user interface, and ${modelName} is well-suited for analyzing interface behavior and visual layout issues.`;
  }
  
  // Diagram
  if (kind === "diagram") {
    return `This image contains a visual diagram, and ${modelName} is effective at interpreting and explaining structured visual information.`;
  }
  
  // Code screenshot with specific language and purpose
  if (kind === "code screenshot" && language && purpose) {
    return `This screenshot shows ${language} code implementing ${purpose}, and ${modelName} is well-suited for accurately extracting and interpreting code from images.`;
  }
  
  // Code screenshot with just language
  if (kind === "code screenshot" && language) {
    return `This screenshot shows ${language} code, and ${modelName} is well-suited for accurately extracting and interpreting code from images.`;
  }
  
  // Code screenshot generic
  if (kind === "code screenshot") {
    return `This screenshot shows code, and ${modelName} is well-suited for accurately extracting and interpreting code from images.`;
  }
  
  // Fallback for unknown
  return `This request includes an image, and ${modelName} is well-suited for analyzing and interpreting visual content.`;
}
