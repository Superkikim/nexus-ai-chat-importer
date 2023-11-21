<div align="center">
  <h1>🪨 Obsidian Plugin Creation</h1>
  <p>How to create your own Obsidian plugin</p>
</div>

# About Obsidian

- [Obsidian](https://obsidian.md) is a **note taking** app based on Markdown files
- It's **extensible**

# About this plugin

- Simple plugin, that counts the number of lines of the active file
- The line count will be visible in the status bar

# Resources

- Official [Obsidian Plugin Template](https://github.com/obsidianmd/obsidian-sample-plugin)
- Unofficial [Obsidian Plugin Developer Docs](https://marcus.se.net/obsidian-plugin-docs)

# Usage

**Requirement**

- [Obsidian](https://obsidian.md)
- [Git](https://git-scm.com)
- [GitHub](https://github.com) account
- [Node.js](https://nodejs.org)
- Code Editor (I recommend [VSCode](https://code.visualstudio.com))
- Basic [TypeScript](https://www.typescriptlang.org) knowledge

**Installation**

1. Open terminal
2. `cd path/to/your/obsidian/vault/.obsidian/plugins`
3. `git clone https://github.com/flolu/obsidian-plugin`
4. `npm install`
5. `npm run dev`
6. In Obsidian, press `Ctrl + P` and select `Reload app without saving`
7. In Obsidian, go to settings -> Community plugins -> Enable "Example Plugin"

**Commands**

- `npm i` (Install dependencies)
- `npm run dev` (Install dependencies)

**Releasing**

- [Releasing new releases](https://github.com/obsidianmd/obsidian-sample-plugin#releasing-new-releases)
