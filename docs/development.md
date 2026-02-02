# Development Guide

## Quick Start

### Prerequisites
- **Node.js:** 18.x or higher
- **npm:** 9.x or higher (comes with Node.js)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd modeltriage
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open the app:**
   - Navigate to [http://localhost:3000](http://localhost:3000)

## Available Commands

### Development

**Start dev server:**
```bash
npm run dev
```
- Starts Next.js development server on port 3000
- Enables hot-reload for code changes
- Includes source maps and error overlays

**Build for production:**
```bash
npm run build
```
- Creates optimized production build in `.next/`
- Runs type checking and linting
- Outputs build statistics

**Start production server:**
```bash
npm run start
```
- Serves the production build (requires `npm run build` first)
- Runs on port 3000 by default

### Code Quality

**Run linter:**
```bash
npm run lint
```
- Runs ESLint with Next.js config
- Checks TypeScript files for style and potential errors
- Auto-fixable issues can be fixed with `npm run lint -- --fix`

### Testing

**Test MockProvider:**
```bash
npm run test:mock
```
- Runs unit tests for `lib/providers/mock-provider.ts`
- Verifies streaming behavior, determinism, and metadata
- Uses `tsx` to run TypeScript tests directly

**Test routing logic:**
```bash
npm run test:routing
```
- Runs unit tests for `lib/routing/router.ts`
- Verifies model selection rules and priority order
- Tests analytical vs. code intent routing

**Demo MockProvider streaming:**
```bash
npm run demo:mock
```
- Runs a terminal demo of MockProvider streaming
- Prints chunks as they arrive (simulates real streaming)
- Useful for verifying provider behavior

**Test streaming API:**
```bash
npm run test:stream
```
- Sends test requests to `/api/stream` endpoint
- **Requires dev server to be running** (`npm run dev` in another terminal)
- Tests both single-answer and Verify Mode

## Project Structure

```
modeltriage/
├── src/app/              # Next.js App Router
│   ├── api/stream/       # SSE streaming endpoint
│   ├── page.tsx          # Main UI
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── lib/                  # Core modules
│   ├── providers/        # Provider interface + MockProvider
│   ├── routing/          # Model router
│   └── diff/             # Diff analyzer
├── __tests__/            # Unit tests
├── docs/                 # Documentation
├── .specify/             # Product specifications
└── package.json          # Dependencies and scripts
```

## Development Workflow

### 1. Making Code Changes

**UI changes:**
- Edit `src/app/page.tsx`
- Changes auto-reload in browser
- Check browser console for errors

**API changes:**
- Edit `src/app/api/stream/route.ts`
- Restart dev server if streaming behaves unexpectedly
- Test with `npm run test:stream`

**Provider changes:**
- Edit `lib/providers/mock-provider.ts`
- Run `npm run test:mock` to verify
- Use `npm run demo:mock` to see streaming in terminal

**Routing changes:**
- Edit `lib/routing/router.ts`
- Run `npm run test:routing` to verify
- Add test cases for new rules

### 2. Testing Locally

**Browser testing:**
1. Start dev server: `npm run dev`
2. Open [http://localhost:3000](http://localhost:3000)
3. Enter prompts and verify streaming
4. Check Verify Mode with 2-3 models

**API testing:**
1. Start dev server: `npm run dev`
2. In another terminal: `npm run test:stream`
3. Watch for SSE events in output

**Unit testing:**
```bash
npm run test:mock      # Test provider
npm run test:routing   # Test router
```

### 3. Debugging

**Enable verbose logging:**
- Check browser console for client-side errors
- Check terminal where `npm run dev` is running for server-side errors

**Inspect SSE stream:**
- Open browser DevTools → Network tab
- Filter by "stream"
- Click the request and view "EventStream" tab

**Check terminal output:**
- Server-side errors appear in the terminal running `npm run dev`
- Look for stack traces and error messages

## Troubleshooting

### Problem: `src/app` vs `app` Directory Confusion

**Symptoms:**
- Changes to `src/app/page.tsx` don't appear
- "404 Not Found" when accessing pages
- Duplicate components or routes

**Cause:**
- Next.js supports both `app/` and `src/app/` directory structures
- This project uses `src/app/` (configured in project setup)
- Editing files in a non-existent `app/` directory has no effect

**Solution:**
1. Verify files are in `src/app/`, not `app/`
2. Delete any `app/` directory at project root if it exists
3. All Next.js routes and pages must be in `src/app/`

**Verification:**
```bash
# Should exist:
ls src/app/page.tsx

# Should NOT exist:
ls app/page.tsx
```

---

### Problem: Streaming Not Updating / Stale UI

**Symptoms:**
- Responses don't stream progressively
- Old responses appear after making code changes
- Chunks arrive all at once instead of progressively

**Cause:**
- Browser cache or Next.js dev server cache
- Service worker intercepting requests
- Dev server not restarting after API changes

**Solution:**

**1. Hard refresh the browser:**
- **Mac:** `Cmd + Shift + R`
- **Windows/Linux:** `Ctrl + Shift + R`
- Or open DevTools → Network tab → check "Disable cache"

**2. Restart dev server:**
```bash
# Stop the dev server (Ctrl+C)
# Then restart:
npm run dev
```

**3. Clear Next.js cache:**
```bash
rm -rf .next
npm run dev
```

**4. Clear browser storage:**
- Open DevTools → Application → Storage
- Click "Clear site data"
- Reload page

**5. Check for service workers:**
- Open DevTools → Application → Service Workers
- If any are registered, click "Unregister"

---

### Problem: SSE Buffering / Chunks Not Streaming

**Symptoms:**
- All chunks arrive at once (no progressive rendering)
- Large delay before first chunk appears
- Entire response appears instantly

**Cause:**
- Edge runtime buffering (Next.js 13+)
- Proxy or reverse proxy buffering
- Missing SSE headers or incorrect content-type

**Solution:**

**1. Verify Node.js runtime (not Edge):**

Check `src/app/api/stream/route.ts` has:
```typescript
export const runtime = 'nodejs';
```

**If using Edge runtime:**
- SSE may buffer unpredictably
- Switch to Node.js runtime

**2. Check SSE headers:**

Ensure the route returns:
```typescript
headers: {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
}
```

**3. Verify SSE event format:**

Events must follow this exact format:
```
data: {"type":"chunk","content":"text"}\n\n
```

- Must have `data: ` prefix
- Must end with `\n\n` (two newlines)
- No extra whitespace

**4. Check for reverse proxy buffering:**

If running behind nginx or similar:
```nginx
# Disable buffering for SSE
proxy_buffering off;
proxy_cache off;
```

**5. Test with curl:**
```bash
curl -N -X POST http://localhost:3000/api/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello"}' \
  --no-buffer
```

Chunks should appear progressively, not all at once.

---

### Problem: Port Already in Use

**Symptoms:**
- `Error: listen EADDRINUSE: address already in use :::3000`
- Dev server fails to start

**Cause:**
- Another process is using port 3000
- Previous dev server didn't shut down cleanly

**Solution:**

**1. Find and kill the process:**

**Mac/Linux:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process (replace PID with actual process ID)
kill -9 <PID>
```

**Windows:**
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

**2. Use a different port:**
```bash
PORT=3001 npm run dev
```

**3. Restart terminal:**
- Sometimes the process is tied to the terminal session
- Close and reopen the terminal
- Try `npm run dev` again

---

### Problem: TypeScript Errors After `npm install`

**Symptoms:**
- `Cannot find module` errors
- Type errors in IDE but code runs fine
- Red squiggly lines in VSCode

**Cause:**
- TypeScript language server not restarted
- Stale type definitions
- Missing `@types/*` packages

**Solution:**

**1. Restart TypeScript server (VSCode):**
- `Cmd/Ctrl + Shift + P`
- Type: "TypeScript: Restart TS Server"
- Press Enter

**2. Regenerate types:**
```bash
rm -rf node_modules
npm install
```

**3. Check `tsconfig.json`:**

Ensure `paths` are correct:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/lib/*": ["./lib/*"]
    }
  }
}
```

**4. Restart IDE:**
- Sometimes the simplest solution
- Close and reopen VSCode/Cursor

---

### Problem: Tests Fail with Module Errors

**Symptoms:**
- `npm run test:mock` or `npm run test:routing` fail
- `Cannot find module` errors in tests
- Import path errors

**Cause:**
- Tests use `tsx` to run TypeScript directly
- Path aliases may not resolve correctly
- Missing imports or circular dependencies

**Solution:**

**1. Check imports in test files:**

Tests should use relative imports:
```typescript
// Good:
import { MockProvider } from '../../lib/providers/mock-provider';

// May fail:
import { MockProvider } from '@/lib/providers/mock-provider';
```

**2. Verify file paths:**
```bash
# Test files should be in __tests__/
ls __tests__/providers/mock-provider.test.ts
ls __tests__/routing/router.test.ts
```

**3. Check `tsconfig.json` includes test files:**
```json
{
  "include": ["src", "lib", "__tests__"]
}
```

**4. Run with verbose output:**
```bash
npx tsx __tests__/providers/mock-provider.test.ts
```

---

### Problem: API Route Not Found (404)

**Symptoms:**
- `POST /api/stream` returns 404
- Browser console shows "Failed to fetch"
- Network tab shows 404 error

**Cause:**
- Route file not in correct location
- Dev server not running
- Typo in API path

**Solution:**

**1. Verify file location:**
```bash
# Should exist:
ls src/app/api/stream/route.ts
```

**2. Check dev server is running:**
```bash
# Should see "Ready - started server on 0.0.0.0:3000"
npm run dev
```

**3. Test route directly:**
```bash
curl -X POST http://localhost:3000/api/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}'
```

**4. Check route.ts exports:**

Must export `POST` function:
```typescript
export async function POST(request: Request) {
  // ...
}
```

---

### Problem: Linter Errors Block Development

**Symptoms:**
- `npm run dev` shows linter warnings/errors
- Build fails due to linting
- Red squiggly lines everywhere

**Cause:**
- ESLint rules are strict by default
- Next.js linting is opinionated
- Unused imports or variables

**Solution:**

**1. Auto-fix issues:**
```bash
npm run lint -- --fix
```

**2. Temporarily disable linting (not recommended):**

In `next.config.ts`:
```typescript
const config = {
  eslint: {
    ignoreDuringBuilds: true, // Only for emergency
  },
};
```

**3. Ignore specific rules:**

Add to `.eslintrc.json`:
```json
{
  "rules": {
    "@typescript-eslint/no-unused-vars": "warn",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

---

## Best Practices

### 1. Development Server
- ✅ Keep `npm run dev` running in a dedicated terminal
- ✅ Restart dev server after API changes
- ✅ Hard refresh browser after clearing cache

### 2. Testing
- ✅ Run unit tests before committing
- ✅ Test both single-answer and Verify Mode
- ✅ Verify streaming behavior in browser

### 3. Code Changes
- ✅ Check linter before committing: `npm run lint`
- ✅ Use TypeScript types (avoid `any`)
- ✅ Add tests for new routing rules

### 4. Debugging
- ✅ Check browser console for client errors
- ✅ Check terminal for server errors
- ✅ Use DevTools Network tab to inspect SSE stream

### 5. Git Workflow
- ✅ Don't commit `.next/` or `node_modules/`
- ✅ Don't commit test files to `src/` directory
- ✅ Keep commits focused on one feature/fix

## Environment Variables

Currently, the project does **not require** any environment variables for local development. All features work with MockProvider out of the box.

**Future environment variables (not yet implemented):**

```bash
# Enable real LLM providers (future)
USE_LIVE_PROVIDERS=true

# Real provider API keys (future)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Database connection (future)
ENABLE_DB_WRITES=true
DATABASE_URL=postgresql://...
```

**Note:** These variables are **reserved for future use** and do not currently affect application behavior.

## IDE Setup

### VSCode / Cursor

**Recommended extensions:**
- **ESLint:** `dbaeumer.vscode-eslint`
- **TypeScript:** Built-in
- **Tailwind CSS IntelliSense:** `bradlc.vscode-tailwindcss`
- **Prettier:** `esbenp.prettier-vscode` (optional)

**Recommended settings (.vscode/settings.json):**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## Getting Help

### Documentation
- **Architecture:** `docs/architecture.md`
- **Streaming API:** `docs/streaming-api.md`
- **Verify Mode:** `docs/verify-mode.md`
- **Routing:** `docs/routing.md`
- **UI States:** `docs/ui-states.md`

### Specifications
- **Product:** `.specify/product.md`
- **Conventions:** `.specify/conventions.md`
- **Requirements:** `.specify/requirements.md`
- **User Stories:** `.specify/user-stories.md`

### Debugging Checklist

When something doesn't work:
1. ✅ Is the dev server running?
2. ✅ Is the file in `src/app/` (not `app/`)?
3. ✅ Did you hard refresh the browser?
4. ✅ Did you restart the dev server after API changes?
5. ✅ Are there errors in the browser console?
6. ✅ Are there errors in the terminal?
7. ✅ Did you run `npm run lint`?
8. ✅ Did you check the Network tab for failed requests?

If all else fails:
```bash
# Nuclear option: clean everything and restart
rm -rf .next node_modules
npm install
npm run dev
```
