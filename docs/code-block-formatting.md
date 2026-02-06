# Code Block Formatting for Model Responses

## Overview

Added automatic code block detection and formatting with **syntax highlighting** for model responses. Code is now displayed with color-coded syntax, monospace font, copy buttons, and proper formatting.

## Features

### 1. **Syntax Highlighting**
Code blocks now include syntax highlighting using `react-syntax-highlighter`:

- **Supported languages:** TypeScript, JavaScript, Python, Go, Rust, Java, C/C++, C#, PHP, Ruby, JSON, YAML, HTML, CSS, SCSS, SQL, Bash, Markdown, and more
- **Theme:** oneDark (dark theme with good contrast and readability)
- **Automatic language detection:** Uses language tags from fenced blocks (```ts, ```js, etc.)
- **Fallback:** Plain monospace for unrecognized or missing language tags

### 2. **Fenced Code Block Support**
Detects and renders triple-backtick code blocks:

```typescript
function example() {
  return "hello";
}
```

- Preserves language tags (```ts, ```js, ```python, etc.)
- Shows language label in top-left corner
- Maintains original indentation and formatting

### 3. **Unfenced Code Detection**
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

### 4. **Copy Button**
- Appears on hover over code blocks
- One-click copy to clipboard
- Shows "✓ Copied" confirmation
- Positioned to not interfere with highlighted code

### 5. **Responsive Design**
- Horizontal scroll for long lines
- Mobile-friendly layout
- Proper spacing and padding
- Dark background works in both light and dark mode contexts

### 6. **Security**
- No `dangerouslySetInnerHTML` used
- `react-syntax-highlighter` uses safe React rendering
- All content properly escaped

## Implementation

### Dependencies Added

- **`react-syntax-highlighter`** - Syntax highlighting component
- **`@types/react-syntax-highlighter`** - TypeScript types

### Files Modified

1. **`src/components/CodeBlock.tsx`**
   - Added `react-syntax-highlighter` integration
   - Language mapping for common aliases (ts→typescript, py→python, etc.)
   - Uses `oneDark` theme for consistent styling
   - Fallback to plain monospace for unknown languages
   - Updated button styling for dark theme

### Styling

Code blocks now use:
- **oneDark theme** - Professional, high-contrast dark theme
- `bg-gray-900` background for plain code
- `text-gray-300` for non-highlighted code
- `border-gray-800` borders
- Language tags and copy buttons use dark styling for consistency

## Supported Languages

The component supports 20+ languages with automatic alias mapping:

| Input | Normalized | Language |
|-------|-----------|----------|
| `ts` | `typescript` | TypeScript |
| `js` | `javascript` | JavaScript |
| `jsx` | `jsx` | JSX |
| `tsx` | `tsx` | TSX |
| `py` | `python` | Python |
| `rb` | `ruby` | Ruby |
| `sh` | `bash` | Bash |
| `yml` | `yaml` | YAML |
| `json` | `json` | JSON |
| `md` | `markdown` | Markdown |
| `html` | `markup` | HTML |
| `css` | `css` | CSS |
| `go` | `go` | Go |
| `rust` | `rust` | Rust |
| `java` | `java` | Java |
| `c` | `c` | C |
| `cpp` | `cpp` | C++ |
| `cs` | `csharp` | C# |
| `php` | `php` | PHP |
| `sql` | `sql` | SQL |

## Usage

The FormattedResponse component automatically applies syntax highlighting. No configuration needed.

### Example Rendering

**Input (from model):**
```
Here's a TypeScript function:

\`\`\`typescript
interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  return `Hello, ${user.name}!`;
}
\`\`\`

This function greets a user.
```

**Output:** Renders with:
- TypeScript syntax highlighting (keywords, types, strings colored)
- "typescript" label in top-left
- Copy button on hover
- Dark theme background
- Scrollable for long lines

## Performance

- **Bundle size:** ~50KB (react-syntax-highlighter with Prism)
- **Runtime:** Highlighting happens after parsing, not during streaming
- **No layout shift:** Code blocks have consistent sizing
- **Lazy loading:** Only loaded when code blocks are present

## Testing

Run existing tests:
```bash
npm run test:parser
```

All tests still pass (syntax highlighting doesn't affect parsing logic).

Test manually:
1. Submit a prompt with code (e.g., "Write a TypeScript function")
2. Verify syntax highlighting appears
3. Check copy button works
4. Test with different languages

## Notes

- Parser is conservative - requires strong code signals to avoid false positives
- Normal paragraphs won't trigger code detection
- Code blocks in comparison summary are NOT highlighted (summary uses plain text)
- Works with all providers (OpenAI, Anthropic, Gemini)
- Theme is consistent across all code blocks
