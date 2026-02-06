/**
 * Unit tests for code language normalization utilities
 */

import { normalizeCodeLang } from "../lib/code-lang-utils";

function runTests() {
  console.log("Running code language normalization tests...\n");

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: JavaScript variants normalize to same display
  try {
    console.log("Test 1: JavaScript variants normalize consistently");
    const js1 = normalizeCodeLang("js");
    const js2 = normalizeCodeLang("javascript");
    const js3 = normalizeCodeLang("JavaScript");

    if (js1.display !== "JavaScript" || js2.display !== "JavaScript" || js3.display !== "JavaScript") {
      throw new Error(`JavaScript variants should all display as "JavaScript", got: ${js1.display}, ${js2.display}, ${js3.display}`);
    }

    if (js1.highlightKey !== "javascript" || js2.highlightKey !== "javascript" || js3.highlightKey !== "javascript") {
      throw new Error("JavaScript variants should all use 'javascript' highlightKey");
    }

    console.log("  ✓ js, javascript, JavaScript -> all normalize to 'JavaScript'\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 2: TypeScript variants
  try {
    console.log("Test 2: TypeScript variants normalize consistently");
    const ts1 = normalizeCodeLang("ts");
    const ts2 = normalizeCodeLang("typescript");
    const ts3 = normalizeCodeLang("TypeScript");

    if (ts1.display !== "TypeScript" || ts2.display !== "TypeScript" || ts3.display !== "TypeScript") {
      throw new Error("TypeScript variants should all display as 'TypeScript'");
    }

    console.log("  ✓ ts, typescript, TypeScript -> all normalize to 'TypeScript'\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 3: language- prefix removal
  try {
    console.log("Test 3: 'language-' prefix is removed");
    const result = normalizeCodeLang("language-js");

    if (result.display !== "JavaScript") {
      throw new Error(`Expected 'JavaScript', got '${result.display}'`);
    }

    console.log("  ✓ 'language-js' -> 'JavaScript'\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 4: Leading dot removal
  try {
    console.log("Test 4: Leading dot is removed");
    const result = normalizeCodeLang(".js");

    if (result.display !== "JavaScript") {
      throw new Error(`Expected 'JavaScript', got '${result.display}'`);
    }

    console.log("  ✓ '.js' -> 'JavaScript'\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 5: Unknown language hides label
  try {
    console.log("Test 5: Unknown language hides label");
    const result = normalizeCodeLang("foobar");

    if (result.display !== null) {
      throw new Error(`Unknown language should have display=null, got '${result.display}'`);
    }

    if (result.highlightKey !== "foobar") {
      throw new Error(`Unknown language should preserve raw as highlightKey, got '${result.highlightKey}'`);
    }

    console.log("  ✓ Unknown language -> display=null, highlightKey=raw\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 6: Null/undefined/empty handling
  try {
    console.log("Test 6: Null/undefined/empty inputs return null");
    const result1 = normalizeCodeLang(null);
    const result2 = normalizeCodeLang(undefined);
    const result3 = normalizeCodeLang("");
    const result4 = normalizeCodeLang("   ");

    if (result1.display !== null || result1.highlightKey !== null) {
      throw new Error("null input should return { display: null, highlightKey: null }");
    }

    if (result2.display !== null || result2.highlightKey !== null) {
      throw new Error("undefined input should return { display: null, highlightKey: null }");
    }

    if (result3.display !== null || result3.highlightKey !== null) {
      throw new Error("empty string should return { display: null, highlightKey: null }");
    }

    if (result4.display !== null || result4.highlightKey !== null) {
      throw new Error("whitespace-only string should return { display: null, highlightKey: null }");
    }

    console.log("  ✓ null, undefined, empty -> all return null\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 7: Shell variants normalize to same display
  try {
    console.log("Test 7: Shell variants normalize consistently");
    const sh1 = normalizeCodeLang("bash");
    const sh2 = normalizeCodeLang("sh");
    const sh3 = normalizeCodeLang("shell");
    const sh4 = normalizeCodeLang("zsh");

    if (
      sh1.display !== "Shell" ||
      sh2.display !== "Shell" ||
      sh3.display !== "Shell" ||
      sh4.display !== "Shell"
    ) {
      throw new Error("All shell variants should display as 'Shell'");
    }

    if (
      sh1.highlightKey !== "bash" ||
      sh2.highlightKey !== "bash" ||
      sh3.highlightKey !== "bash" ||
      sh4.highlightKey !== "bash"
    ) {
      throw new Error("All shell variants should use 'bash' highlightKey");
    }

    console.log("  ✓ bash, sh, shell, zsh -> all normalize to 'Shell'\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 8: YAML variants
  try {
    console.log("Test 8: YAML variants normalize consistently");
    const yaml1 = normalizeCodeLang("yml");
    const yaml2 = normalizeCodeLang("yaml");

    if (yaml1.display !== "YAML" || yaml2.display !== "YAML") {
      throw new Error("YAML variants should display as 'YAML'");
    }

    console.log("  ✓ yml, yaml -> both normalize to 'YAML'\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 9: Case insensitivity
  try {
    console.log("Test 9: Case insensitivity");
    const result1 = normalizeCodeLang("JSON");
    const result2 = normalizeCodeLang("Json");
    const result3 = normalizeCodeLang("json");

    if (result1.display !== "JSON" || result2.display !== "JSON" || result3.display !== "JSON") {
      throw new Error("JSON in any case should normalize to 'JSON'");
    }

    console.log("  ✓ JSON, Json, json -> all normalize to 'JSON'\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Summary
  console.log("=".repeat(50));
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
  console.log("=".repeat(50));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests();
