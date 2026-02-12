# Testing Instructions

## 🧪 Phase 1: Console Script Test (START HERE)

Before building the extension, we need to understand how Gemini's API works.

### Step 1: Open Gemini

1. Go to [gemini.google.com](https://gemini.google.com)
2. Make sure you're logged in and have some conversations

### Step 2: Open DevTools

1. Press **F12** (or right-click → Inspect)
2. Click on the **Console** tab
3. Clear the console (click the 🚫 icon or press Ctrl+L)

### Step 3: Run the Test Script

1. Open the file `test-console-script.js` in a text editor
2. **Copy the entire content** (Ctrl+A, Ctrl+C)
3. **Paste it into the Console** (Ctrl+V)
4. Press **Enter**

You should see:
```
🚀 Nexus Gemini Indexer - Test Script Started
📡 Monitoring API calls for 10 seconds...
💡 TIP: Scroll through conversations or click on different chats
```

### Step 4: Trigger API Calls

While the script is running (10 seconds), do these actions:

1. **Scroll through the conversation sidebar** (left side)
2. **Click on different conversations**
3. **Navigate to a conversation** if you're not already in one
4. **Scroll down in a conversation** to load more messages

### Step 5: Analyze Results

After 10 seconds, the script will display:

```
📊 RESULTS SUMMARY
==============================================================
Total API calls captured: X
Conversations extracted: Y
```

#### ✅ Success Case

If you see conversations extracted:
```javascript
💬 Extracted Conversations:
┌─────────┬──────────────────┬─────────────────────┬──────────────┐
│ (index) │ conversationId   │ title               │ timestamp    │
├─────────┼──────────────────┼─────────────────────┼──────────────┤
│    0    │ 'abc123def456'   │ 'My conversation'   │ '2025-01-...'│
└─────────┴──────────────────┴─────────────────────┴──────────────┘
```

**What to do:**
1. Copy the JSON output from the console
2. Save it as `test-output.json`
3. Share it with the developer (or analyze it yourself)
4. Proceed to Phase 2 (Extension Testing)

#### ❌ No Conversations Extracted

If you see:
```
⚠️ No conversations extracted.
```

**What to do:**
1. Check the "📋 All API Calls" table
2. Look at the "📋 Raw API responses" section
3. Copy the raw responses and share them
4. We need to analyze the API format

**Common reasons:**
- Gemini changed their API format
- You didn't trigger any API calls (try scrolling more)
- The API uses a different endpoint than expected

### Step 6: Share Results

Create a GitHub issue or comment with:

1. **Number of API calls captured**
2. **Number of conversations extracted** (if any)
3. **Sample API URLs** (from the table)
4. **Raw API response** (first 500 characters)
5. **Your browser** (Firefox/Chrome version)

Example:
```
API Calls: 5
Conversations: 0
Sample URL: https://gemini.google.com/_/BardChatUi/data/...
Browser: Firefox 122.0

Raw response:
)]}'
[["wrb.fr","GetHistory","[[\"abc123\",\"Title\",1234567890]]",null,"generic"]]
```

---

## 🔧 Phase 2: Extension Testing (After Console Test)

Only proceed here if the console script successfully extracted conversations.

### Step 1: Install Extension

#### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Navigate to `extension/firefox/`
4. Select `manifest.json`

#### Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select `extension/firefox/` directory

### Step 2: Test the Extension

1. Go to [gemini.google.com](https://gemini.google.com)
2. Click the extension icon in your toolbar
3. You should see: "✅ Gemini page detected. Ready to extract!"
4. Click "Test API Detection"
5. Wait for results

### Step 3: Generate Index

1. Click "Generate Index"
2. Wait 10 seconds
3. A file `gemini_index.json` should download
4. Open it and verify the structure:

```json
{
  "conversations": [
    {
      "conversationId": "abc123",
      "title": "My conversation",
      "timestamp": "2025-01-14T10:30:00.000Z",
      "url": "https://gemini.google.com/app/abc123"
    }
  ],
  "exportDate": "2025-01-14T12:00:00.000Z",
  "totalConversations": 1,
  "source": "gemini-api"
}
```

### Step 4: Test with Obsidian Plugin

1. Export your Google Takeout (Gemini data)
2. Open Obsidian with Nexus AI Chat Importer
3. Import the Takeout + the `gemini_index.json`
4. Verify conversations are grouped correctly

---

## 🐛 Troubleshooting

### Console script doesn't capture anything

**Check:**
- Are you on gemini.google.com?
- Did you scroll/click during the 10 seconds?
- Check Network tab: Are there any XHR/Fetch requests?

**Try:**
- Refresh the page and run again
- Try a different browser
- Check if you're logged in to Gemini

### Extension popup shows "Please open Gemini page"

**Fix:**
- Make sure you're on `https://gemini.google.com/*`
- Refresh the page
- Reload the extension

### "No conversations found via API"

**Possible causes:**
- API format changed (need to update parser)
- Not enough time to capture (increase timeout)
- Gemini uses different endpoints now

**Debug:**
1. Open DevTools on the Gemini page
2. Check Console for logs from content script
3. Check Network tab for API calls
4. Share findings in GitHub issue

---

## 📊 What We're Looking For

The goal is to find API responses that contain:

1. **Conversation ID** (unique identifier)
2. **Title** (conversation name)
3. **Timestamp** (when created/updated)
4. **Message previews** (optional but helpful)

Example ideal response:
```json
{
  "conversations": [
    {
      "id": "abc123",
      "title": "Help with Python",
      "created": "2025-01-10T14:30:00Z",
      "updated": "2025-01-14T10:00:00Z",
      "messages": [
        {
          "timestamp": "2025-01-10T14:30:00Z",
          "preview": "How do I read a CSV file..."
        }
      ]
    }
  ]
}
```

Once we understand the format, we can update the parser in `content-script.js`.

