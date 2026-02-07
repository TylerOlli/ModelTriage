# Deployment Checklist

This document verifies that ModelTriage is ready for Vercel deployment.

## ✅ Pre-Deployment Verification

### Runtime Configuration

**Status:** ✅ Confirmed

- **File:** `src/app/api/stream/route.ts`
- **Line 10:** `export const runtime = "nodejs"`
- **Purpose:** Ensures SSE streaming works without buffering
- **Notes:** Node.js runtime is required for optimal streaming performance

### Environment Variables

**Status:** ✅ No secrets required

**Checked:**
- ✅ No `process.env.*` references in `/src`
- ✅ No `process.env.*` references in `/lib`
- ✅ No API keys required for MVP
- ✅ MockProvider works without any configuration

**Future flags (not yet implemented):**
- `USE_LIVE_PROVIDERS=true` - will enable real LLM providers
- `ENABLE_DB_WRITES=true` - will enable database persistence

### Git Ignore Configuration

**Status:** ✅ Protected

**File:** `.gitignore`

Protected files:
```
.env
.env.local
.env*.local
.env.development.local
.env.test.local
.env.production.local
.vercel
```

**Verification:**
```bash
git ls-files | grep ".env"  # Should return nothing
```

### Dependencies

**Status:** ✅ All dependencies in package.json

**Production dependencies:**
- `react` ^19.0.0
- `react-dom` ^19.0.0
- `next` ^15.1.6

**Dev dependencies:**
- TypeScript, ESLint, Tailwind, tsx (for tests)

**No external services required:**
- MockProvider only (zero external API calls)
- No database required
- No authentication service required

### API Routes

**Status:** ✅ Verified

**Endpoint:** `POST /api/stream`

**Location:** `src/app/api/stream/route.ts`

**Features:**
- ✅ SSE streaming (Server-Sent Events)
- ✅ Single-answer mode
- ✅ Comparison Mode (2-3 models in parallel)
- ✅ Input validation (prompt length, model count)
- ✅ Error isolation (per-model try-catch)
- ✅ Clean stream closure

**Test:**
```bash
curl -X POST http://localhost:3000/api/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}'
```

Expected: SSE events stream progressively (not buffered)

## Deployment Steps

### 1. Push to Git

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your Git repository
4. Select "Next.js" framework (auto-detected)
5. Click "Deploy" (no environment variables needed)

### 3. Post-Deployment Tests

**Test single-answer mode:**
1. Enter prompt: "Explain React hooks"
2. Verify: Response streams progressively
3. Check: Routing explanation displays
4. Check: Metadata shows (model, latency, tokens)

**Test Comparison Mode:**
1. Enable Comparison Mode toggle
2. Select 2 models
3. Enter prompt: "Compare React and Vue"
4. Verify: Both panels stream independently
5. Check: Diff summary appears after completion

**Test error handling:**
1. Empty prompt → validation error
2. Prompt > 4,000 chars → error message
3. Cancel streaming → partial output preserved

**Test routing:**
- "Compare X and Y" → routes to `mock-quality-1`
- "Write a function..." → routes to `mock-code-1`
- "Hi" → routes to `mock-fast-1`

## Vercel Configuration

### Framework Detection

Vercel will automatically detect:
- Framework: **Next.js 15**
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

### Runtime Configuration

No `vercel.json` required. Runtime is configured per-route:

```typescript
// src/app/api/stream/route.ts
export const runtime = "nodejs";
```

### Environment Variables

**Required:** None

**Optional (future):** None for MVP

### Build Settings

Default Next.js settings work out-of-the-box:
- ✅ TypeScript compilation
- ✅ Tailwind CSS processing
- ✅ API route bundling
- ✅ Static page optimization

## Known Limitations

### Vercel Free Tier

- **Serverless timeout:** 10 seconds (sufficient for MockProvider)
- **Concurrent executions:** 100 (ample for testing)
- **Bandwidth:** 100 GB/month

**MVP Impact:** None. MockProvider responses complete in < 2 seconds.

### SSE Streaming

- ✅ Works on Vercel out-of-the-box
- ✅ No buffering with Node.js runtime
- ✅ Supports parallel streams (Comparison Mode)

## Troubleshooting

### Issue: Build Fails

**Check:**
```bash
npm run build  # Run locally
npm run lint   # Check for errors
```

**Common causes:**
- TypeScript errors
- ESLint errors
- Missing dependencies

### Issue: Streaming Buffered

**Check:**
1. Verify `export const runtime = "nodejs"` in route file
2. Hard refresh browser (Cmd+Shift+R)
3. Check DevTools → Network → EventStream tab

**Verify:**
```bash
curl -N -X POST https://your-app.vercel.app/api/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}' \
  --no-buffer
```

Chunks should appear progressively.

### Issue: 404 on API Routes

**Check:**
1. Verify `src/app/api/stream/route.ts` exists
2. Check deployment logs for file tree
3. Verify build completed successfully

### Issue: Application Crashes

**Check:**
1. Deployment logs for errors
2. "Module not found" errors
3. Missing dependencies in `package.json`

## Post-Deployment Monitoring

### What to Monitor

1. **Streaming performance:**
   - Time to first chunk (should be < 200ms)
   - Total response time (should be < 2 seconds for MockProvider)

2. **Error rates:**
   - API route errors (should be 0% for valid requests)
   - Client-side errors (check browser console)

3. **Comparison Mode:**
   - Both/all panels should stream simultaneously
   - Diff summary should appear after completion
   - Error isolation (one panel error doesn't affect others)

### Metrics to Track

- **Build time:** ~2-3 minutes (typical for Next.js 15)
- **Cold start:** < 1 second (Node.js runtime)
- **Response time:** < 2 seconds (MockProvider)
- **Error rate:** 0% (for valid inputs)

## Security Notes

### No Secrets Exposed

✅ No API keys in code
✅ No database credentials
✅ No authentication tokens
✅ `.env*` files ignored by git
✅ MockProvider only (no external API calls)

### Safe for Public Deployment

✅ No cost risk (no external API calls)
✅ No data leakage (no database, no user data)
✅ No abuse risk (single-user MVP, no persistence)

## Rollback Plan

If deployment issues occur:

1. **Check Vercel deployment logs**
2. **Verify build succeeded**
3. **Test locally:** `npm run build && npm run start`
4. **Rollback:** Vercel → Deployments → select previous working version → "Promote to Production"

## Success Criteria

Deployment is successful when:

✅ Build completes without errors
✅ Homepage loads and renders correctly
✅ Single-answer mode streams progressively
✅ Comparison Mode runs 2-3 models in parallel
✅ Routing explanation displays for each request
✅ Diff summary appears after Comparison Mode completes
✅ Error handling works (validation, cancellation, try again)
✅ No console errors in browser
✅ No serverless errors in Vercel logs

---

**Last Updated:** 2026-02-02
**Status:** ✅ Ready for deployment
**Deployment Platform:** Vercel
**Configuration:** Zero-config (no environment variables required)
