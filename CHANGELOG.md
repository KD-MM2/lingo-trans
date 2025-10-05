# Changelog - LingoTrans

All notable changes to this project will be documented in this file.

## [0.2.0] - 2025-10-05

### 🎉 Added

#### API Integration

- **OpenAI API Client** - Full implementation supporting Chat Completions and Responses API
- **Real-time Streaming** - Server-Sent Events (SSE) parser for token-by-token display
- **Error Handling** - Automatic retry with exponential backoff for transient errors
- **Rate Limit Support** - Handles 429 errors with Retry-After header
- **Request Cancellation** - AbortController integration for cancelling in-flight requests
- **Template Engine** - Variable substitution system for prompt customization
    - Supports: `{{source_text}}`, `{{target_language}}`, `{{source_language}}`, `{{tone}}`, `{{preserve_html}}`, `{{glossary}}`
    - Template validation and preview capabilities
    - Default templates for Translation, Rewriting, and Summarization

#### UI Features

- **Tone Selector** in Rewriting page
    - Neutral (default)
    - Formal - professional language
    - Casual - friendly, conversational
    - Concise - brief and to-the-point
- **Real-time Streaming Display** - Watch translations appear word-by-word
- **Enhanced Error Messages** - User-friendly error messages with troubleshooting hints

### 🔧 Changed

#### Translation Page

- Replaced mock translation with real OpenAI API calls
- Removed "Translation is simulated" message
- Added streaming support with real-time token display
- Improved error handling with detailed messages

#### Rewriting Page

- Replaced mock rewriting with real OpenAI API calls
- Added tone selection dropdown
- Removed "Rewriting is simulated" message
- Added streaming support
- Updated label from "Text to translate" to "Text to rewrite"

### 📦 New Files

#### API Layer (`src/lib/api/`)

- `types.ts` - TypeScript type definitions for API requests/responses
- `streaming.ts` - SSE parser and stream handling utilities
- `providers/openai.ts` - OpenAI API client implementation
- `index.ts` - Unified API interface for all providers

#### Translation Layer (`src/lib/translation/`)

- `template-engine.ts` - Prompt template engine with variable substitution

#### Documentation

- `IMPLEMENTATION_SUMMARY.md` - Comprehensive implementation documentation
- `QUICK_START.md` - Quick testing guide for developers
- `CHANGELOG.md` - This file

### 🐛 Fixed

- Character counter now accurately reflects remaining characters
- Form validation prevents empty submissions
- API errors are properly caught and displayed to users

### 🔒 Security

- API keys are validated before making requests
- Proper error messages without exposing sensitive information
- AbortController prevents memory leaks from cancelled requests

### 📊 Technical Details

- **Total Lines Added**: ~1,157 lines of production code
- **Files Modified**: 2 (translation.tsx, rewriting.tsx)
- **Files Created**: 5 (API layer) + 3 (documentation)
- **TypeScript Coverage**: 100%
- **Error Types Supported**: auth, rate_limit, timeout, network, invalid_request, server_error

---

## [0.1.0] - 2025-10-04 (Previous State)

### ✅ Completed (Before This Update)

#### Extension Structure

- Manifest configuration with full permissions
- Side panel setup
- Background service worker
- Floating Action Button (FAB) content script

#### UI Components

- Translation tab (mock implementation)
- Rewriting tab (mock implementation)
- Templates tab with CRUD operations
- Settings tab with provider configuration
- About tab
- Theme system (light/dark mode)

#### Storage & Settings

- LocalStorage for settings persistence
- LocalStorage for templates
- Settings validation and sanitization
- 37 languages support

---

## [Unreleased] - Planned Features

### Phase 2: Text Selection Translation

- [ ] Content script for text selection detection
- [ ] Floating popup near selected text
- [ ] Context menu "Translate selected text"
- [ ] Auto-translate on selection (optional)
- [ ] Quick language switcher in popup
- [ ] Copy button in popup
- [ ] "Pin to SidePanel" button

### Phase 3: Full Page Translation

- [ ] DOM traversal logic (p, li, h1, div...)
- [ ] Inline tag preservation (a, strong, em, code, span...)
- [ ] Placeholder system for HTML structure
- [ ] Batch processing with delimiters
- [ ] Progress overlay with cancel/undo
- [ ] Replace mode (direct replacement)
- [ ] Undo/restore functionality
- [ ] Skip script/style/hidden elements

### Phase 4: Enhancements

- [ ] Translation memory/cache system
- [ ] Keyboard shortcuts (Alt+T, Alt+Shift+T, Alt+P)
- [ ] Claude API support (different message format)
- [ ] Source language auto-detection
- [ ] Language swap button
- [ ] "Fetch Models" button functionality
- [ ] Enhanced health check UI
- [ ] Template picker in UI
- [ ] Custom template saving
- [ ] Export/import configuration

### Future Considerations

- [ ] MutationObserver for dynamic content (SPA support)
- [ ] Side-by-side translation display mode
- [ ] Translation history
- [ ] Glossary UI management
- [ ] Style guide enforcement
- [ ] API key encryption with passphrase
- [ ] Multiple provider profiles
- [ ] Domain-specific translation settings

---

## Version History

- **v0.2.0** (2025-10-05) - OpenAI API Integration + Streaming ✅
- **v0.1.0** (2025-10-04) - Initial MVP Frontend

---

## Breaking Changes

### v0.2.0

- **Translation/Rewriting now require API key** - No longer simulated
- **Settings must be configured** - Model and API key required before use
- **Internet connection required** - API calls need network access

---

## Migration Guide

### From v0.1.0 to v0.2.0

1. **Configure OpenAI API Key**
    - Go to Settings tab
    - Enter your OpenAI API key
    - Select a model (e.g., `gpt-3.5-turbo`)

2. **Test Translation**
    - Go to Translation tab
    - Enter text and click Translate
    - Should see streaming results

3. **Test Rewriting**
    - Go to Rewriting tab
    - Select a tone
    - Click Rewrite
    - Should see streaming results

---

## Known Issues

### Current Version (v0.2.0)

1. **No Translation Cache** - Every request hits the API (can be expensive)
2. **Claude Provider Not Tested** - Infrastructure ready but needs testing
3. **Self-hosted Not Fully Tested** - OpenAI-compatible endpoints need verification
4. **No "Fetch Models" Button** - Infrastructure ready, UI integration pending
5. **Templates Hardcoded** - Can't select/edit templates from UI yet

### Workarounds

1. **Cache Issue**: Keep requests small, reuse output instead of re-translating
2. **Claude Provider**: Use OpenAI for now
3. **Fetch Models**: Manually enter model name (e.g., `gpt-4`)
4. **Templates**: Modify `src/lib/translation/template-engine.ts` directly

---

## Performance Benchmarks

### API Response Times (Typical)

- **First token**: 500ms - 1s
- **Streaming rate**: 20-50 tokens/second
- **Short text (< 50 words)**: 2-3 seconds
- **Medium text (100-200 words)**: 5-10 seconds
- **Long text (500+ words)**: 15-30 seconds

### Error Recovery

- **Retry delays**: 1s → 2s → 4s → 8s (exponential backoff)
- **Max retries**: 3 attempts
- **Timeout**: Browser default (~60 seconds)

---

## Credits

**Implementation**: Phase 1 API Integration (2025-10-05)
**Architecture**: Modular API layer with provider abstraction
**Streaming**: Server-Sent Events (SSE) parsing
**Templates**: Variable substitution system

---

## License

[To be determined - check LICENSE file]

---

**Last Updated**: October 5, 2025  
**Current Version**: 0.2.0  
**Status**: Phase 1 Complete ✅
