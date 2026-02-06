# Code Block Formatting for Model Responses

## Overview

Added automatic code block detection and formatting for model responses. Code is now displayed in monospace with syntax highlighting support, copy buttons, and proper formatting.

## Features

### 1. **Fenced Code Block Support**
Detects and renders triple-backtick code blocks:

```typescript
function example() {
  return "hello";
}
```

- Preserves language tags (```ts, ```js, ```python, etc.)
- Shows language label in top-left corner
- Maintains original indentation and formatting

### 2. **Unfenced Code Detection**
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

### 3. **Copy Button**
- Appears on hover over code blocks
- One-click copy to clipboard
- Shows "✓ Copied" confirmation

### 4. **Responsive Design**
- Horizontal scroll for long lines
- Mobile-friendly layout
- Proper spacing and padding

### 5. **Security**
- All content is HTML-escaped
- No `dangerouslySetInnerHTML` used
- Safe rendering of user-generated content

## Implementation

### Files Created

1. **`lib/response-parser.ts`**
   - Parses responses into text and code segments
   - Detects fenced and unfenced code blocks
   - Heuristic-based code detection
   - HTML escaping utility

2. **`src/components/CodeBlock.tsx`**
   - Renders individual code blocks
   - Copy-to-clipboard functionality
   - Language label display
   - Hover effects and styling

3. **`src/components/FormattedResponse.tsx`**
   - Main component for rendering parsed responses
   - Handles both text and code segments
   - Maintains proper spacing and layout

4. **`__tests__/response-parser.test.ts`**
   - Unit tests for parser
   - Tests all code detection scenarios
   - Ensures normal text isn't mistaken for code

### Files Modified

1. **`src/app/page.tsx`**
   - Replaced `<pre>` tags with `<FormattedResponse>`
   - Applied to both single-answer and Verify Mode
   - Consistent formatting across all responses

2. **`package.json`**
   - Added `test:parser` script

## Usage

The FormattedResponse component is automatically used for all model responses. No configuration needed.

### Code Block Rendering

**Input (from model):**
```
Here's a function:

\`\`\`typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}
\`\`\`

This function returns a greeting.
```

**Output:** Renders as formatted text + styled code block + more text

### Unfenced Code Rendering

**Input (from model):**
```
Here's the solution:

function calculate(x, y) {
  let result = 0;
  for (let i = x; i <= y; i++) {
    result += i;
  }
  return result;
}

This adds numbers from x to y.
```

**Output:** Detects the function as code and renders it in a code block

## Testing

Run tests:
```bash
npm run test:parser
```

All 6 tests pass:
- ✓ Fenced code block with language
- ✓ Fenced code block without language
- ✓ Multiple code blocks
- ✓ Unfenced code detection
- ✓ Normal text not mistaken for code
- ✓ JSON structures detected as code

## Styling

Code blocks use:
- `bg-gray-50` background
- `border-gray-200` border
- `font-mono` for code
- `text-sm` for readability
- `overflow-x-auto` for long lines
- Hover effects for copy button

## Notes

- Parser is conservative - requires strong code signals to avoid false positives
- Normal paragraphs with occasional punctuation won't trigger code detection
- Code blocks in the comparison summary are NOT affected (summary uses plain text)
- Works with all providers (OpenAI, Anthropic, Gemini)
