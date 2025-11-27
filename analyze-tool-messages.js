const fs = require('fs');

// Read conversation with proper encoding handling
const rawData = fs.readFileSync('local_resources/claude/nouvelle_conversation_artifact.json', 'utf8');

// Parse line by line to avoid control character issues
const lines = rawData.split('\n');
let inToolUse = false;
let currentTool = null;
let toolUseBlocks = [];
let toolResultBlocks = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect tool_use blocks
    if (line.includes('"type": "tool_use"')) {
        inToolUse = true;
        currentTool = { line: i };
    }
    
    if (inToolUse && line.includes('"name":')) {
        const match = line.match(/"name":\s*"([^"]+)"/);
        if (match) {
            currentTool.name = match[1];
        }
    }
    
    if (inToolUse && line.includes('"path":')) {
        const match = line.match(/"path":\s*"([^"]+)"/);
        if (match) {
            currentTool.path = match[1];
        }
    }
    
    if (inToolUse && line.includes('"file_text":')) {
        const match = line.match(/"file_text":\s*"(.{0,100})/);
        if (match) {
            currentTool.file_text_preview = match[1].substring(0, 80) + '...';
        }
    }
    
    if (inToolUse && line.includes('"description":')) {
        const match = line.match(/"description":\s*"([^"]+)"/);
        if (match) {
            currentTool.description = match[1];
        }
    }
    
    if (inToolUse && line.includes('"command":')) {
        const match = line.match(/"command":\s*"([^"]+)"/);
        if (match) {
            currentTool.command = match[1];
        }
    }
    
    if (inToolUse && line.includes('"code":')) {
        const match = line.match(/"code":\s*"(.{0,100})/);
        if (match) {
            currentTool.code_preview = match[1].substring(0, 80) + '...';
        }
    }
    
    if (inToolUse && line.trim() === '},') {
        if (currentTool && currentTool.name) {
            toolUseBlocks.push(currentTool);
        }
        inToolUse = false;
        currentTool = null;
    }
    
    // Detect tool_result blocks
    if (line.includes('"type": "tool_result"')) {
        const nextLines = lines.slice(i, i + 10).join(' ');
        const nameMatch = nextLines.match(/"name":\s*"([^"]+)"/);
        const textMatch = nextLines.match(/"text":\s*"([^"]+)"/);
        
        if (nameMatch) {
            toolResultBlocks.push({
                line: i,
                name: nameMatch[1],
                text_preview: textMatch ? textMatch[1].substring(0, 80) : null
            });
        }
    }
}

console.log('📊 TOOL_USE ANALYSIS\n');
console.log('='.repeat(80));

// Group by tool name
const toolGroups = {};
for (const tool of toolUseBlocks) {
    if (!toolGroups[tool.name]) {
        toolGroups[tool.name] = [];
    }
    toolGroups[tool.name].push(tool);
}

for (const [name, tools] of Object.entries(toolGroups)) {
    console.log(`\n🔧 Tool: ${name} (${tools.length} occurrences)`);
    console.log('-'.repeat(80));
    
    // Show first 3 examples
    for (let i = 0; i < Math.min(3, tools.length); i++) {
        const tool = tools[i];
        console.log(`\n  Example ${i + 1}:`);
        if (tool.path) console.log(`    Path: ${tool.path}`);
        if (tool.description) console.log(`    Description: ${tool.description}`);
        if (tool.command) console.log(`    Command: ${tool.command}`);
        if (tool.file_text_preview) console.log(`    File text: ${tool.file_text_preview}`);
        if (tool.code_preview) console.log(`    Code: ${tool.code_preview}`);
    }
}

console.log('\n\n📊 TOOL_RESULT ANALYSIS\n');
console.log('='.repeat(80));

const resultGroups = {};
for (const result of toolResultBlocks) {
    if (!resultGroups[result.name]) {
        resultGroups[result.name] = [];
    }
    resultGroups[result.name].push(result);
}

for (const [name, results] of Object.entries(resultGroups)) {
    console.log(`\n✅ Result: ${name} (${results.length} occurrences)`);
    if (results[0].text_preview) {
        console.log(`    Sample: ${results[0].text_preview}`);
    }
}

console.log('\n\n📋 SUMMARY TABLE\n');
console.log('='.repeat(80));
console.log('Tool Name'.padEnd(25) + 'Count'.padEnd(10) + 'Has Path'.padEnd(12) + 'Has Code'.padEnd(12) + 'Has Description');
console.log('-'.repeat(80));

for (const [name, tools] of Object.entries(toolGroups)) {
    const hasPath = tools.some(t => t.path);
    const hasCode = tools.some(t => t.code_preview);
    const hasDesc = tools.some(t => t.description);
    
    console.log(
        name.padEnd(25) + 
        tools.length.toString().padEnd(10) + 
        (hasPath ? '✓' : '✗').padEnd(12) + 
        (hasCode ? '✓' : '✗').padEnd(12) + 
        (hasDesc ? '✓' : '✗')
    );
}

