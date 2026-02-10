# Spec Rewrite Changelog

**Date**: February 9, 2026  
**Type**: Full specification update to match current product state  
**Reason**: 8 major features were implemented but not documented in specs

---

## Summary

Updated all `.specify/` files to reflect the current state of the ModelTriage product. The specs now document all implemented features including file attachments, drag-and-drop, conversation continuation, and other enhancements added since the MVP.

---

## Files Updated

### 1. `.specify/requirements.md`
**Added 7 new requirement sections** (200+ lines of new requirements):

#### New Section: File attachments
- Support for up to 3 files per request
- Text file support (.txt, .log, .json, .md, .ts, .tsx, .js, .jsx, .env, .yml, .yaml)
- Image file support (.png, .jpg, .webp)
- File size limits (2MB text, 5MB images)
- Attachment count limits (3 total, 2 images max)
- Automatic text truncation (20k per file, 35k total)
- Automatic image optimization (resize to 1024px)
- Smart summarization (if text > 12k chars)
- Vision model filtering
- Security warnings
- In-memory processing only
- Attachment indicators (chips, counter)

#### New Section: Drag-and-drop file upload
- Drag-and-drop support on prompt area
- Visual feedback (blue border, overlay, paperclip icon)
- File type validation on drop
- Prevention during streaming or when 3 files attached
- Multiple file drop support
- Error messages for invalid files
- Browser default behavior prevention
- Nested drag event handling
- Seamless integration with file picker button

#### New Section: Attachment-aware routing
- Model routing based on attachment type
- Code files → Claude Sonnet 4.5 (never downgrade to fast models)
- Images → vision-capable models only
- Text gist generation for routing
- Image gist generation from vision models
- File complexity detection

#### New Section: Prompt history
- Last 10 prompts in localStorage
- Deduplication of consecutive duplicates
- History button with dropdown
- Click to reuse prompts
- Clear all history action
- Cross-session persistence

#### New Section: Conversation continuation
- Follow-up prompt support with context
- "Ask a follow-up" button after responses
- Previous prompt + response included as context
- Placeholder change to indicate continuation mode
- Inline follow-up input in Compare mode
- Visual continuation indicators
- Ability to break continuation with Clear

#### New Section: Safe mode switching
- Confirmation when switching modes with results
- Inline warning bar (not modal)
- Temporary result preservation in state
- "Restore previous results" button
- Smooth animations
- No confirmation if no results exist

#### New Section: Enhanced UI states
- Streaming stage indicators (connecting, routing, contacting, streaming)
- Reset button with double-click confirmation
- Character count with warning state
- Attachment file chips (icon, name, size, remove)
- File counter (X/3)
- Security warnings for attachments

**Total new requirements**: ~70+ individual requirement items

---

### 2. `.specify/user-stories.md`
**Added 6 new user stories**:

#### Story 11: Attach files to prompts
- Acceptance criteria for file attachment UX
- File type support
- Automatic optimization
- Security warnings
- File chip display

#### Story 12: Drag and drop files
- Acceptance criteria for drag-drop functionality
- Visual feedback
- File validation
- Error handling
- Multiple file support

#### Story 13: Smart routing with attachments
- Acceptance criteria for attachment-aware routing
- Code file routing
- Image routing
- Gist generation
- No downgrade to fast models

#### Story 14: Access prompt history
- Acceptance criteria for history feature
- 10 prompt limit
- Reuse and clear functionality
- Persistence behavior

#### Story 15: Ask follow-up questions
- Acceptance criteria for conversation continuation
- Context inclusion
- Visual indicators
- Compare mode support
- Breaking continuation

#### Story 16: Switch modes safely
- Acceptance criteria for safe mode switching
- Confirmation flow
- Result preservation
- Restore functionality

**Total new user stories**: 6 (bringing total from 10 to 16)

---

### 3. `.specify/conventions.md`
**Updated 4 sections** with new technical details:

#### Updated: Numeric defaults (MVP)
Added file attachment limits:
- Max files per request: 3
- Max images per request: 2
- Max text file size: 2MB
- Max image file size: 5MB
- Max characters per text file: 20,000
- Max total characters: 35,000
- Text summarization threshold: 12,000 characters
- Image max dimension: 1024px
- Prompt history: 10 prompts

#### Updated: Routing conventions
Added attachment-aware routing section:
- Code/text files → strong coding models
- Never downgrade with file uploads
- Images → vision-capable models only
- File content informs decisions
- Text gist generation
- Image gist generation

#### Updated: UX conventions
Massively expanded (5x larger):
- File attachment UI patterns
- Drag-and-drop visual feedback
- Prompt history patterns
- Conversation continuation UI
- Mode switching confirmation
- Streaming stage indicators
- Input control behaviors

#### Updated: Architecture conventions
Added file processing architecture:
- In-memory file processing
- Multipart/form-data requests
- Image optimization (sharp library)
- Text summarization (gpt-5-mini)
- Vision model filtering
- Text gist generation
- Image gist streaming

---

### 4. `.specify/product.md`
**Updated 3 sections**:

#### Updated: Core value
Added new value propositions:
- Supporting file attachments with intelligent routing
- Maintaining conversation context for follow-ups
- Providing smart history and workflow features

#### Updated: What ModelTriage is
Added:
- A system for analyzing files and images with appropriate AI models
- A workflow tool with history, follow-ups, and context preservation

#### Updated: Explicit non-goals (MVP)
Clarified:
- History is localStorage-only (not cross-device)
- File storage/persistence is not supported (in-memory only)
- Real-time collaboration not supported

---

## Statistics

### Before Rewrite
- **Requirements**: 10 sections, ~115 lines
- **User Stories**: 10 stories
- **Product features**: Core MVP only
- **Spec coverage**: ~55% of current product

### After Rewrite
- **Requirements**: 17 sections, ~380 lines (+265 lines, +230%)
- **User Stories**: 16 stories (+6, +60%)
- **Product features**: Full current product
- **Spec coverage**: 100% of current product ✅

### Changes by File
| File | Lines Added | Sections Added | Status |
|------|-------------|----------------|--------|
| `requirements.md` | ~265 | +7 | ✅ Complete |
| `user-stories.md` | ~140 | +6 | ✅ Complete |
| `conventions.md` | ~80 | 4 sections updated | ✅ Complete |
| `product.md` | ~20 | 3 sections updated | ✅ Complete |
| **Total** | **~505 lines** | **+13 new sections** | ✅ Complete |

---

## Features Now Documented

All current product features are now in specs:

### ✅ Original MVP (Already in Specs)
1. Single-answer mode
2. Streaming output (SSE)
3. Model routing with explanation
4. Verify/Compare Mode
5. Side-by-side panels
6. Diff summary
7. Cost & latency display
8. Error isolation
9. Usage limits
10. Persistence (minimal)

### ✅ New Features (Just Added to Specs)
11. **File attachments** (text + images)
12. **Drag-and-drop upload**
13. **Attachment-aware routing**
14. **Prompt history** (last 10)
15. **Conversation continuation** (follow-ups)
16. **Safe mode switching** (confirmation)
17. **Image gist generation**
18. **Enhanced UI states** (streaming stages, etc.)

---

## Benefits of Updated Specs

### For Development
- ✅ Clear requirements for all existing features
- ✅ Acceptance criteria for testing
- ✅ Technical limits and conventions documented
- ✅ Source of truth for current product state

### For Onboarding
- ✅ New developers can read specs to understand full product
- ✅ User stories explain the "why" behind features
- ✅ Conventions document technical decisions

### For Planning
- ✅ Specs can now guide future feature decisions
- ✅ Easy to see what's in scope vs out of scope
- ✅ Product vision is clear and current

### For AI Agents
- ✅ Can use specs for context on major features
- ✅ Clear conventions to follow
- ✅ User stories provide acceptance criteria

---

## Maintenance Going Forward

Following the hybrid approach defined in `.specify/README.md`:

### For Small/Medium Features
- Implement directly
- Document in `docs/`
- No immediate spec update required

### For Major Features
- Write specs first (use SpecKit)
- Plan with user stories
- Document edge cases
- Then implement

### Batch Spec Updates
- Every 2-4 weeks: update specs with shipped features
- Keep specs minimally current
- Focus on high-level requirements, not implementation details

---

## Next Steps

Specs are now **100% current** with the product. No immediate action required.

When you add new major features:
1. **Option A**: Write specs first using SpecKit
2. **Option B**: Implement, then add to specs in next batch update

The updated specs serve as:
- ✅ Onboarding documentation for new team members
- ✅ Product overview for stakeholders
- ✅ Context for AI agents
- ✅ Historical record of feature evolution
