# 🎉 Nexus AI Chat Importer v1.3.0

**The "You're in Control" Update**

---

## 🌟 What's New in 30 Seconds

**v1.3.0 gives you control:**
- 🎯 **Pick which conversations to import** - no more all-or-nothing
- 📁 **Organize your folders your way** - separate settings for conversations, attachments, and reports
- 🌍 **Works everywhere** - proper international date support
- 🎨 **Smarter artifact dates** - Claude artifacts now get the correct creation date

**Upgrading?** The plugin handles everything automatically. Just install and go! ✨

---

## ☕ Love This Plugin?

**This plugin is free and always will be.**

But if it saves you time, a small donation helps me keep improving it:

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/nexusplugins)

**Reality check:** 1000+ downloads, only $10 in donations. Even $5 helps! 🙏

---

## 🎯 The Big New Features

### 1. **Selective Import** - Pick What You Want

**Before v1.3.0:** Import everything or nothing.

**Now:** Choose exactly which conversations to import!

**How it works:**
1. Select your ZIP file(s)
2. See a beautiful list of all conversations with:
   - 📝 Title and date
   - 💬 Message count
   - 🆕 Status (New / Updated / Already imported)
   - 📎 Attachments info
3. Check the ones you want
4. Click "Import Selected"

**Why it's awesome:**
- ✅ Import only what you need
- ✅ Process multiple ZIP files at once
- ✅ Automatically finds duplicates
- ✅ Sort and filter the list
- ✅ Save time and vault space

---

### 2. **Better Folder Organization** - Your Vault, Your Way

**Before v1.3.0:** Everything in one folder structure.

**Now:** Three separate, independent folders!

**The new setup:**
- 📝 **Conversations Folder**: Your chat notes
- 📎 **Attachments Folder**: Images, files, Claude artifacts
- 📊 **Reports Folder**: Import summaries

**Why it's awesome:**
- ✅ Organize however you like
- ✅ Move folders anytime (plugin updates links automatically)
- ✅ Exclude attachments from sync to save space
- ✅ Keep reports separate from conversations

**Upgrading from v1.2.0?** The plugin automatically migrates your Reports folder to the new structure. No manual work needed!

---

### 3. **International Date Support** - Works Everywhere

**Before v1.3.0:** Date parsing issues for non-US users.

**Now:** Proper international support!

**What changed:**
- ✅ All metadata uses **ISO 8601** format (universal standard)
- ✅ Choose your preferred format for message timestamps
- ✅ Works correctly in all languages
- ✅ No more MM/DD vs DD/MM confusion

**Available formats:**
- ISO 8601: `2024-01-15 14:30:22`
- US: `01/15/2024 2:30:22 PM`
- European: `15/01/2024 14:30:22`
- UK: `15/01/2024 14:30:22`
- German: `15.01.2024 14:30:22`
- Japanese: `2024/01/15 14:30:22`

---

### 4. **Smarter Artifact Dates** - Finally Accurate!

**Before v1.3.0:** All Claude artifacts had the conversation creation date.

**Now:** Each artifact gets the date of the message that created it!

**Why it matters:**
- ✅ Accurate creation dates
- ✅ Better timeline tracking
- ✅ Proper version history

**Technical note:** This was a complex fix involving regex patterns and date parsing. It just works now! 🎉

---

## 🔧 Other Improvements

### **Enhanced Import Reports**

Reports now show:
- 📊 Per-file breakdown (when importing multiple ZIPs)
- 📈 Better statistics
- 🔗 Clickable links to imported conversations
- ⏱️ Processing time

### **Better User Experience**

- 🎨 Modern file selection dialog
- 📱 Responsive conversation selection table
- ✅ Clear success/error messages
- 🔄 Progress tracking for long operations

### **Quality of Life**

- 🗑️ Automatically skips empty conversations
- 🔍 Better error messages with context
- 📝 Comprehensive debug logging
- 🚀 Improved performance

---

## 🐛 Bug Fixes

**Major fixes:**
- ✅ Fixed artifact date extraction (regex literal notation issue)
- ✅ Fixed folder deletion order (bottom-up approach)
- ✅ Fixed links in artifact body not updating when moving folders
- ✅ Fixed double slash bug when selecting "/" as vault root
- ✅ Fixed Browse button targeting wrong input field

**Import & Processing:**
- ✅ Fixed Claude detection for older export formats
- ✅ Fixed duplicate conversation handling
- ✅ Fixed timestamp normalization for ZIP comparisons
- ✅ Prevented report generation when import is cancelled

**UI & Formatting:**
- ✅ Fixed DALL-E callout formatting
- ✅ Cleaned up message spacing
- ✅ Fixed truncated text in dialogs
- ✅ Fixed YAML frontmatter sanitization

---

## ⚠️ Important: License Change

**Previous versions (≤1.2.0):** MIT License  
**Version 1.3.0+:** GNU GPL v3.0

### What This Means for You

**As a user:** Nothing changes!
- ✅ Still free forever
- ✅ Still open source
- ✅ Still fully functional

**As a developer:** If you fork this plugin:
- ✅ Must keep it open source (GPL v3)
- ✅ Must share your improvements
- ❌ Cannot create closed-source commercial versions

**Why the change?** After 300+ hours of development and 1000+ downloads with only $10 in donations, I'm protecting this work from commercial exploitation while keeping it free for everyone.

---

## 🔄 Upgrading from v1.2.0

**Good news:** It's automatic!

When you install v1.3.0, the plugin will:

1. ✅ **Migrate your settings** to the new format
2. ✅ **Move your Reports folder** to the new location (with your permission)
3. ✅ **Update artifact dates** to use message timestamps
4. ✅ **Update all links** to work with the new structure
5. ✅ **Show you a report** of what changed

**No manual work required!** Just install and go.

**What gets migrated:**
- Settings structure (`archiveFolder` → `conversationFolder`)
- Reports folder location (moved to vault root)
- Artifact metadata (dates updated)
- All links (automatically updated)

**What stays the same:**
- Your conversations (untouched)
- Your attachments (untouched)
- Your manual edits (preserved)

---

## 📋 Testing Checklist

Before you start using v1.3.0 heavily, we recommend:

### **Quick Test (5 minutes)**
- [ ] Install v1.3.0
- [ ] Check that migration completed successfully
- [ ] Import one conversation using selective import
- [ ] Verify links work in the imported conversation
- [ ] Check that the import report looks good

### **Full Test (15 minutes)**
- [ ] Import multiple ZIP files at once
- [ ] Try moving a folder in settings
- [ ] Verify that links update correctly
- [ ] Check artifact dates are accurate
- [ ] Test both ChatGPT and Claude imports

**Found an issue?** [Report it on GitHub](https://github.com/Superkikim/nexus-ai-chat-importer/issues)

---

## 🚀 What's Next

**v1.3.0 is a major milestone!** The plugin now has:
- ✅ Selective import
- ✅ Flexible folder organization
- ✅ International support
- ✅ Accurate metadata

**Future plans:**
- 🤖 Support for more AI providers (Mistral, etc.)
- 🌍 Multi-language UI
- 🎙️ Audio conversation support
- 📊 Advanced filtering and search

**Your feedback matters!** [Suggest features on GitHub](https://github.com/Superkikim/nexus-ai-chat-importer/issues)

---

## 🙏 Thank You

To everyone who:
- ⭐ Starred the repo
- 🐛 Reported bugs
- 💡 Suggested features
- ☕ Donated to support development

**You make this plugin better!** ❤️

---

## 📚 Resources

- **Full README**: [View on GitHub](https://github.com/Superkikim/nexus-ai-chat-importer/blob/dev-1.3.0/README.md)
- **Report Issues**: [GitHub Issues](https://github.com/Superkikim/nexus-ai-chat-importer/issues)
- **Support Development**: [Ko-fi](https://ko-fi.com/nexusplugins)
- **Migration Guide**: [MIGRATION-v1.3.0.md](https://github.com/Superkikim/nexus-ai-chat-importer/blob/dev-1.3.0/MIGRATION-v1.3.0.md)

---

**Enjoy v1.3.0! 🎉**

