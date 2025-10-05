# Quick Start Guide - Testing LingoTrans API Integration

## 🚀 Getting Started

### Step 1: Configure Settings

1. Open the extension and go to **Settings** tab
2. Fill in the following:
    - **Provider**: Select "OpenAI"
    - **OpenAI API Key**: Enter your OpenAI API key (starts with `sk-`)
    - **Model**: Enter `gpt-3.5-turbo` or `gpt-4`
    - **Default Target Language**: Choose your preferred language (e.g., Vietnamese)

3. Save settings

### Step 2: Test Translation

1. Go to **Translation** tab
2. Enter some text in English (e.g., "Hello, how are you?")
3. Select **Target Language**: Vietnamese (or any language)
4. Click **Translate**
5. Watch the translation appear word-by-word in real-time!

### Step 3: Test Rewriting

1. Go to **Rewriting** tab
2. Enter text to rewrite (e.g., "This is a simple test")
3. Select **Target Language**: English
4. Select **Tone**:
    - **Neutral**: Standard rewrite
    - **Formal**: Professional language
    - **Casual**: Friendly, conversational
    - **Concise**: Short and to-the-point
5. Click **Rewrite**
6. Watch the rewritten text stream in!

## ✅ What to Expect

### Successful Translation

```
Input: "Hello, how are you?"
Target: Vietnamese
Output (streaming): "Xin chào, bạn khỏe không?"
```

### Successful Rewriting (Formal Tone)

```
Input: "Hey, wanna grab lunch?"
Tone: Formal
Output: "Would you be available to have lunch together?"
```

## ⚠️ Common Issues

### Issue: "No model selected"

**Solution**: Go to Settings → Enter model name (e.g., `gpt-3.5-turbo`)

### Issue: "OpenAI API key is required"

**Solution**: Go to Settings → Enter your OpenAI API key

### Issue: "API request failed with status 401"

**Solution**: Your API key is invalid or expired. Check Settings.

### Issue: "API request failed with status 429"

**Solution**: Rate limit exceeded. Wait a moment or check your OpenAI quota.

### Issue: No streaming / text appears all at once

**Solution**: This is normal for very short texts. Streaming is more noticeable with longer content.

## 🎯 Testing Checklist

- [ ] Translation works with valid API key
- [ ] Can see tokens streaming in real-time
- [ ] Rewriting works with all 4 tones
- [ ] Copy button works in output
- [ ] Character counter updates correctly
- [ ] Error messages display when API key is wrong
- [ ] Can switch between different languages
- [ ] Clear button resets the form

## 📝 Advanced Testing

### Test Different Languages

Try translating to:

- Vietnamese (vi)
- Spanish (es)
- French (fr)
- Japanese (ja)
- Chinese (zh)
- Korean (ko)

### Test Different Tones (Rewriting)

Same input with different tones:

```
Input: "We need to talk about the project"

Neutral: "We should discuss the project"
Formal: "I would like to schedule a discussion regarding the project"
Casual: "Let's chat about the project"
Concise: "Discuss project"
```

### Test Error Handling

1. Enter invalid API key → Should show auth error
2. Enter very long text (5000+ chars) → Should hit character limit
3. Disconnect internet → Should show network error
4. Use expired API key → Should show 401 error

## 🔍 Debugging

### Open Browser Console

1. Right-click extension → Inspect
2. Go to Console tab
3. Look for errors or logs

### Check Network Requests

1. Open DevTools → Network tab
2. Filter by "fetch/XHR"
3. Look for requests to `api.openai.com`
4. Check request/response details

## 🎉 Success Indicators

✅ Translation streaming works
✅ Rewriting with tone works
✅ Error handling works (shows user-friendly messages)
✅ Copy button works
✅ Character counter accurate
✅ Can switch languages easily

## 📞 Need Help?

Check these files for implementation details:

- `src/lib/api/index.ts` - Main API interface
- `src/lib/api/providers/openai.ts` - OpenAI client
- `src/lib/api/streaming.ts` - Streaming parser
- `src/pages/translation.tsx` - Translation UI
- `src/pages/rewriting.tsx` - Rewriting UI

## 🚧 Known Limitations (To Be Implemented)

- ❌ Text selection translation (highlight text → translate)
- ❌ Full page translation
- ❌ Translation cache (every request hits API)
- ❌ Context menu integration
- ❌ Keyboard shortcuts
- ❌ Claude API support
- ❌ "Fetch Models" button in Settings

---

**Status**: Phase 1 API Integration Complete ✅  
**Last Updated**: October 5, 2025
