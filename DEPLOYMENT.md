# Production Deployment Checklist

## ✅ Completed Setup

### Static Assets
- ✅ Created `/public` folder
- ✅ Added `robots.txt` (allows all crawlers)
- ✅ Added `sitemap.xml` (update URLs when domain is final)
- ✅ Added `manifest.webmanifest` (PWA configuration)

### Metadata & SEO
- ✅ Updated `src/app/layout.tsx` with production metadata
- ✅ Configured Open Graph tags (1200x630)
- ✅ Configured Twitter Card tags
- ✅ Set up favicon references
- ✅ Added manifest link
- ✅ Smart site URL detection (NEXT_PUBLIC_SITE_URL → VERCEL_URL → fallback)

### Build & TypeScript
- ✅ Build passes (`npm run build`)
- ✅ No TypeScript errors
- ✅ No localhost URLs in metadata

### Documentation
- ✅ Created `env.example` with required API keys
- ✅ Created `public/README.md` with image requirements

---

## 🚨 TODO Before Launch

### 1. Add Image Assets to `/public`

**Required files:**
```
public/
├── og-image.png          (1200x630) - Social sharing preview
├── favicon.ico           (32x32)    - Browser tab icon
├── icon-192.png          (192x192)  - PWA icon
├── icon-512.png          (512x512)  - PWA icon
└── apple-touch-icon.png  (180x180)  - iOS home screen
```

**Quick generation:**
- Use https://realfavicongenerator.net/ for favicons
- Use https://www.canva.com/ for OG image (template: 1200x630)
- Design tip: Include "ModelTriage - Right LLM, every time."

### 2. Set Environment Variables in Vercel

Go to your Vercel project → Settings → Environment Variables:

**Required (Production + Preview + Development):**
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
```

**Optional (Production only):**
```
NEXT_PUBLIC_SITE_URL=https://modeltriage.com
```
*(Only set if your domain is different from Vercel's auto-generated URL)*

### 3. Update Domain References

If your final domain is NOT `modeltriage.com`, update:
- `public/robots.txt` - Line 4: Sitemap URL
- `public/sitemap.xml` - Line 3: `<loc>` URL
- `src/app/layout.tsx` - Line 19: Fallback URL (optional, auto-detected)

### 4. Test Social Sharing

After deploying with images:
1. Visit https://www.opengraph.xyz/
2. Enter your production URL
3. Verify OG image appears correctly
4. Test on Twitter, LinkedIn, Slack

### 5. Verify PWA Installation

On mobile:
1. Visit your site
2. Look for "Add to Home Screen" prompt
3. Verify icon appears correctly

---

## 🔍 Pre-Launch Verification

Run these checks before going live:

```bash
# 1. Build passes
npm run build

# 2. No TypeScript errors
npx tsc --noEmit

# 3. Lint passes
npm run lint

# 4. Tests pass (if applicable)
npm run test:attachment-routing
npm run test:image-gist-schema
```

**Manual checks:**
- [ ] All images in `/public` folder
- [ ] Environment variables set in Vercel
- [ ] Domain configured in Vercel
- [ ] SSL certificate active
- [ ] API keys valid and have sufficient credits
- [ ] Test file upload (text + images)
- [ ] Test all 3 providers (OpenAI, Anthropic, Gemini)
- [ ] Test Verify Mode with 2-3 models
- [ ] Social sharing preview works

---

## 📊 Post-Launch Monitoring

**Week 1:**
- Monitor Vercel logs for errors
- Check API usage/costs for each provider
- Verify social shares render correctly
- Test on multiple devices/browsers

**Ongoing:**
- Update `sitemap.xml` when adding new pages
- Regenerate OG image if tagline changes
- Monitor API rate limits

---

## 🆘 Troubleshooting

**OG image not showing:**
- Ensure file is exactly 1200x630
- Clear social media cache: https://developers.facebook.com/tools/debug/
- Wait 24-48 hours for cache to clear

**Favicon not updating:**
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+F5 (Windows)
- Clear browser cache
- Check file exists at `/favicon.ico`

**Build fails on Vercel:**
- Check environment variables are set
- Verify all dependencies in `package.json`
- Check build logs for specific error

**API errors in production:**
- Verify API keys are set correctly
- Check API key permissions/quotas
- Monitor provider status pages
