# Code Block Formatting for Model Responses

## Overview

Added automatic code block detection and formatting with **syntax highlighting** and **consistent language labels** for model responses. Code is now displayed with color-coded syntax, monospace font, copy buttons, and proper formatting.

## Features

### 1. **Syntax Highlighting**
Code blocks now include syntax highlighting using `react-syntax-highlighter`:

- **Supported languages:** TypeScript, JavaScript, Python, Go, Rust, Java, C/C++, C#, PHP, Ruby, JSON, YAML, HTML, CSS, SCSS, SQL, Bash, Markdown, and more
- **Theme:** oneDark (dark theme with good contrast and readability)
- **Automatic language detection:** Uses language tags from fenced blocks (```ts, ```js, etc.)
- **Fallback:** Plain monospace for unrecognized or missing language tags

### 2. **Consistent Language Labels**
Language labels are now **normalized** across all models:

- **Universal normalization:** `js`, `javascript`, `JavaScript` all display as **"JavaScript"**
- **Handles variants:** Shell (bash/sh/shell/zsh), YAML (yml/yaml), etc.
- **Cleans input:** Removes `language-` prefix, leading dots, trims whitespace
- **Hides unknown:** Unknown languages hide the label but may still get highlighting

**Example normalizations:**
- `js`, `javascript`, `JavaScript` → **"JavaScript"**
- `ts`, `typescript`, `TypeScript` → **"TypeScript"**
- `bash`, `sh`, `shell`, `zsh` → **"Shell"**
- `yml`, `yaml` → **"YAML"**
- `language-js` → **"JavaScript"**
- `.js` → **"JavaScript"**

### 3. **No Overlapping Header**
Code blocks now use a **dedicated header row** that sits above the code:

- **Header contains:** Language label (left) + Copy button (right)
- **No absolute positioning** over code content
- **Always aligned** with code block container
- **Mobile-friendly** layout

### 4. **Fenced Code Block Support**
Detects and renders triple-backtick code blocks:

```typescript
function example() {
  return "hello";
}
```

- Preserves language tags (```ts, ```js, ```python, etc.)
- Shows normalized language label in header
- Maintains original indentation and formatting

### 5. **Unfenced Code Detection**
Automatically detects multi-line code segments without backticks using heuristics:

```javascript
function sum(a, b) {
  return a + b;
}
```

Detection patterns:
- Function declarations
- Class/interface definitions
- JSON structures
- Common code patterns (braces, semicolons, imports)
- Requires 3+ consecutive code-like lines

### 6. **Copy Button**
- Always visible in header (no hover required)
- One-click copy to clipboard
- Shows "✓ Copied" confirmation
- Never overlaps code content

### 7. **Responsive Design**
- Horizontal scroll for long lines
- Mobile-friendly layout
- Proper spacing and padding
- Dark background works in both light and dark mode contexts

### 8. **Security**
- No `dangerouslySetInnerHTML` used
- `react-syntax-highlighter` uses safe React rendering
- All content properly escaped

## Implementation

### Files Created

1. **`lib/code-lang-utils.ts`**
   - `normalizeCodeLang()` function for universal language normalization
   - Maps 50+ language variants to consistent display names
   - Returns `{ display, highlightKey }` for UI and highlighting
   - Handles edge cases (language- prefix, leading dots, etc.)

2. **`__tests__/code-lang-utils.test.ts`**
   - 9 comprehensive tests for normalization
   - Tests JS/TS variants, shell variants, YAML, case insensitivity
   - Tests edge cases (null, empty, unknown languages)
   - All tests passing ✓

### Dependencies Added

- **`react-syntax-highlighter`** - Syntax highlighting component
- **`@types/react-syntax-highlighter`** - TypeScript types

### Files Modified

1. **`src/components/CodeBlock.tsx`**
   - Refactored to use dedicated header row
   - Integrated `normalizeCodeLang()` for consistent labels
   - Uses normalized `display` for label, `highlightKey` for highlighting
   - Removed absolute positioning (no overlap)
   - Header always present for consistent layout

2. **`package.json`**
   - Added `test:code-lang` script

### UI Structure

```
┌─────────────────────────────────┐
│ JavaScript          [Copy]      │ ← Header row (no overlap)
├─────────────────────────────────┤
│ function example() {            │
│   return "hello";               │ ← Code content
│ }                               │
└─────────────────────────────────┘
```

## Supported Languages

50+ languages with automatic normalization:

| Input Variants | Display Label | Highlight Key |
|---------------|---------------|---------------|
| js, javascript, JavaScript | **JavaScript** | javascript |
| ts, typescript, TypeScript | **TypeScript** | typescript |
| tsx | **TSX** | tsx |
| jsx | **JSX** | jsx |
| py, python | **Python** | python |
| bash, sh, shell, zsh | **Shell** | bash |
| yml, yaml | **YAML** | yaml |
| md, markdown | **Markdown** | markdown |
| json, JSON, Json | **JSON** | json |
| html, HTML | **HTML** | markup |
| css, CSS | **CSS** | css |
| go, golang | **Go** | go |
| rust, rs | **Rust** | rust |
| rb, ruby | **Ruby** | ruby |
| ...and 35+ more | | |

## Testing

Run all tests:
```bash
npm run test:code-lang  # Language normalization
npm run test:parser     # Response parser
```

**Language normalization tests (9 tests):**
- ✓ JS variants (js, javascript, JavaScript) normalize consistently
- ✓ TS variants normalize consistently
- ✓ `language-` prefix removed
- ✓ Leading dot removed (`.js` → `JavaScript`)
- ✓ Unknown languages hide label
- ✓ Null/undefined/empty return null
- ✓ Shell variants normalize consistently
- ✓ YAML variants normalize consistently
- ✓ Case insensitivity

**Response parser tests (6 tests):**
- ✓ Fenced code blocks parsed
- ✓ Unfenced code detected
- ✓ Normal text not mistaken for code

## Example Output

**Input:**
```typescript
interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  return `Hello, ${user.name}!`;
}
```

**Rendered with:**
- Header row: "TypeScript" label + Copy button
- Syntax highlighted code below (no overlap)
- Keywords: blue
- Types: cyan
- Strings: green
- Dark background

## Performance

- **Bundle size:** ~50KB (react-syntax-highlighter)
- **Runtime:** Fast - highlighting happens after parsing
- **No blocking:** Doesn't affect streaming performance
- **Layout:** No absolute positioning = no reflow

## Notes

- Parser is conservative - requires strong code signals
- Normal paragraphs won't trigger code detection
- Code blocks in comparison summary are NOT highlighted
- Works with all providers (OpenAI, Anthropic, Gemini)
- Language labels now consistent across all models
- Header design prevents any overlap with code content
