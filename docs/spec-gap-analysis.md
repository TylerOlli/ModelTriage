# Spec vs Implementation Gap Analysis

**Date**: Feb 9, 2026  
**Status**: Specs are outdated - many features implemented but not documented in specs

## Executive Summary

Your specs are **significantly out of date**. You've added approximately **8 major features** that aren't in the requirements. The specs represent the original MVP vision, but the product has evolved substantially.

---

## ✅ Features in Specs AND Implemented

These features are documented in both specs and code:

| Feature | Spec Location | Status |
|---------|--------------|--------|
| Single-answer mode | `requirements.md` ✅ | ✅ Implemented |
| Streaming output (SSE) | `requirements.md` ✅ | ✅ Implemented |
| Model routing with explanation | `requirements.md` ✅ | ✅ Implemented |
| Verify/Compare Mode | `requirements.md` ✅ | ✅ Implemented |
| Side-by-side panels | `requirements.md` ✅ | ✅ Implemented |
| Diff summary | `requirements.md` ✅ | ✅ Implemented |
| Cost & latency display | `requirements.md` ✅ | ✅ Implemented |
| Error isolation | `requirements.md` ✅ | ✅ Implemented |
| Usage limits (4k char, rate limits) | `requirements.md` + `conventions.md` ✅ | ✅ Implemented |
| Preferred response selection | `requirements.md` ✅ | ⚠️ Partially (UI only) |

---

## ❌ Major Features Implemented But NOT in Specs

These are substantial features you've shipped that have zero mention in requirements:

### 1. **File Attachments System** ⭐ MAJOR GAP
**Implemented**: Full-featured file attachment with text and images  
**Spec Status**: ❌ Not mentioned at all

**What exists**:
- Attach up to 3 files (text + images)
- Supported: `.txt`, `.log`, `.json`, `.md`, `.ts`, `.tsx`, `.js`, `.jsx`, `.env`, `.yml`, `.yaml`
- Images: `.png`, `.jpg`, `.webp` with auto-resize
- Text file limits: 2MB per file, 20k chars per file, 35k total
- Image limits: 5MB per file, 2 images max
- Automatic truncation and summarization for cost control
- Vision model filtering (only vision-capable models get images)
- Security warnings in UI

**Documentation**: `docs/file-attachments.md` (comprehensive)

---

### 2. **Drag-and-Drop File Upload** ⭐ NEW (Added this week)
**Implemented**: Native drag-drop for file attachments  
**Spec Status**: ❌ Not mentioned at all

**What exists**:
- Drag files anywhere over prompt area
- Visual drop state (blue border, overlay with paperclip icon)
- Validates file types on drop
- Shows clear errors for unsupported files
- Works with existing attachment system
- Multiple file drop support

**Documentation**: `docs/drag-drop-attachments.md` + `docs/drag-drop-testing.md`

---

### 3. **Attachment-Aware Routing** ⭐ MAJOR GAP
**Implemented**: Smart routing based on attachment type  
**Spec Status**: ❌ Not mentioned at all

**What exists**:
- Uploaded code files → Claude Sonnet 4.5 (never downgrades to fast models)
- Images → Vision-capable models only
- Text gist generation for better routing
- Image gist schema for vision models
- Complexity detection for uploaded files
- Context-aware model selection

**Documentation**: `docs/attachment-aware-routing.md` (495 lines, very detailed)

---

### 4. **Prompt History** ⭐ MEDIUM GAP
**Implemented**: Persistent prompt history with popover UI  
**Spec Status**: ❌ Not mentioned at all

**What exists**:
- Last 10 prompts saved to localStorage
- Deduplication (no consecutive duplicates)
- History button with dropdown popover
- Click to reuse previous prompt
- Clear all history action
- Overflow menu for management

**Code**: `src/app/page.tsx` lines 214-221, 331-349, 1581-1698

---

### 5. **Conversation Continuation (Follow-ups)** ⭐ MAJOR GAP
**Implemented**: Context-aware follow-up prompts  
**Spec Status**: ❌ Not mentioned at all

**What exists**:
- "Ask a follow-up" button after responses
- Previous prompt + response sent as context
- Works in both Auto-select and Compare modes
- Inline follow-up input in Compare mode
- Visual indicator when continuing conversation
- Placeholder changes to "Ask a follow-up question..."

**Code**: `src/app/page.tsx` lines 264-267, 557-786, 1123-1148, 2132-2783

---

### 6. **Safe Mode Switching** ⭐ MEDIUM GAP
**Implemented**: Confirmation when switching modes with results  
**Spec Status**: ❌ Not mentioned at all

**What exists**:
- Detects mode switch attempt when results present
- Inline confirmation bar (not modal)
- Stores previous results in session state
- "Restore previous results" button after switch
- Smooth animations for transitions
- Prevents accidental data loss

**Documentation**: `docs/safe-mode-switching.md`  
**Code**: `src/app/page.tsx` lines 1049-1117

---

### 7. **Image Gist Generation** ⭐ TECHNICAL GAP
**Implemented**: AI-generated image descriptions for better routing  
**Spec Status**: ❌ Not mentioned at all

**What exists**:
- Gemini models generate IMAGE_GIST during streaming
- Structured schema for image analysis
- Upgrades routing reason with better context
- Prevents overwriting manual routing reasons
- Used for attachment-aware routing decisions

**Documentation**: `docs/attachment-aware-routing.md` (section on IMAGE_GIST)  
**Code**: `lib/attachments/image-gist-schema.ts`, `lib/llm/providers/gemini.ts`

---

### 8. **Enhanced UI States** ⚠️ Minor Gap
**Implemented**: Additional UI states beyond specs  
**Spec Status**: Partially mentioned

**What exists beyond specs**:
- Streaming stage indicators (connecting, routing, contacting, streaming)
- Reset button with double-click confirmation
- Character count with warning state
- Attachment file chips with remove buttons
- File counter (X/3 files)
- Security warnings for attachments

**Documentation**: `docs/ui-states.md`

---

## 📊 Summary Statistics

| Category | Count |
|----------|-------|
| **Core features in specs** | 10 |
| **Core features implemented** | 10 ✅ |
| **New major features (not in specs)** | 8 ❌ |
| **Total implemented features** | 18 |
| **Spec coverage** | ~55% |

---

## 🎯 Recommended Actions

### Option 1: Full Spec Update (2-3 hours)
Update all spec files to reflect current reality:

**Files to update**:
1. `.specify/requirements.md` - Add 8 new feature sections
2. `.specify/user-stories.md` - Add user stories for each feature
3. `.specify/conventions.md` - Update limits and conventions
4. `.specify/product.md` - Update product description

**Benefits**:
- Complete documentation of current product
- Useful for onboarding new team members
- Clear "source of truth" for what exists

**Cons**:
- Time-consuming
- Will get stale again unless maintained

---

### Option 2: Hybrid Approach (30 mins)
Add a "Current Features" appendix to requirements without rewriting everything:

1. Add section to `requirements.md`: "Features Added Post-MVP"
2. List each new feature with brief description
3. Link to technical docs in `docs/` folder
4. Keep original MVP requirements intact for historical context

**Benefits**:
- Quick to do
- Preserves MVP intent
- Acknowledges current reality

---

### Option 3: Status Quo (Do Nothing)
Keep using the hybrid approach you've already adopted:

- Specs = historical MVP definition
- Technical docs = current source of truth
- Update specs only for strategic features

**Benefits**:
- Zero immediate work
- Already working this way
- Focus on shipping

**Cons**:
- Confusing for new developers
- Specs become less useful over time

---

## 💡 My Recommendation

**Go with Option 2** (Hybrid Approach):

1. Add a new section at the end of `requirements.md` called "Post-MVP Features"
2. List the 8 new features with 2-3 sentences each
3. Link to the detailed docs in `docs/` folder
4. Takes 30 minutes, keeps specs minimally useful

Then continue with your current workflow:
- New features → implement + document in `docs/`
- Batch update specs every month or two
- Focus on shipping, not perfect documentation

Would you like me to implement Option 2 for you?
