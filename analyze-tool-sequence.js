const fs = require('fs');

const rawData = fs.readFileSync('local_resources/claude/nouvelle_conversation_artifact.json', 'utf8');
const lines = rawData.split('\n');

let toolSequence = [];
let currentMessage = null;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect message boundaries
    if (line.includes('"uuid":') && line.includes('019aa')) {
        currentMessage = { uuid: line.match(/"uuid":\s*"([^"]+)"/)?.[1], tools: [] };
    }
    
    // Detect tool_use
    if (line.includes('"type": "tool_use"')) {
        const nextLines = lines.slice(i, i + 20).join(' ');
        const nameMatch = nextLines.match(/"name":\s*"([^"]+)"/);
        const pathMatch = nextLines.match(/"path":\s*"([^"]+)"/);
        const commandMatch = nextLines.match(/"command":\s*"([^"]{0,150})/);
        const descMatch = nextLines.match(/"description":\s*"([^"]+)"/);
        
        if (nameMatch && currentMessage) {
            const tool = {
                type: 'tool_use',
                name: nameMatch[1],
                path: pathMatch?.[1],
                command_preview: commandMatch?.[1]?.substring(0, 80),
                description: descMatch?.[1]
            };
            currentMessage.tools.push(tool);
        }
    }
    
    // Detect tool_result
    if (line.includes('"type": "tool_result"')) {
        const nextLines = lines.slice(i, i + 10).join(' ');
        const nameMatch = nextLines.match(/"name":\s*"([^"]+)"/);
        
        if (nameMatch && currentMessage) {
            currentMessage.tools.push({
                type: 'tool_result',
                name: nameMatch[1]
            });
        }
    }
    
    // Save message when complete
    if (line.includes('"sender":') && currentMessage && currentMessage.tools.length > 0) {
        toolSequence.push(currentMessage);
        currentMessage = null;
    }
}

console.log('🔍 TOOL SEQUENCE ANALYSIS\n');
console.log('='.repeat(100));

// Focus on messages with create_file
for (const msg of toolSequence) {
    const hasCreateFile = msg.tools.some(t => t.name === 'create_file');
    if (!hasCreateFile) continue;
    
    console.log(`\n📨 Message: ${msg.uuid?.substring(0, 20)}...`);
    console.log('-'.repeat(100));
    
    for (let i = 0; i < msg.tools.length; i++) {
        const tool = msg.tools[i];
        const next = msg.tools[i + 1];
        
        if (tool.type === 'tool_use') {
            console.log(`\n  ${i + 1}. ${tool.name.toUpperCase()}`);
            if (tool.path) {
                const fileName = tool.path.split('/').pop();
                console.log(`     File: ${fileName}`);
            }
            if (tool.description) {
                console.log(`     Desc: ${tool.description}`);
            }
            if (tool.command_preview) {
                console.log(`     Cmd:  ${tool.command_preview}...`);
            }
            
            // Check if followed by bash_tool execution
            if (tool.name === 'create_file' && next && next.name === 'bash_tool') {
                console.log(`     ⚠️  FOLLOWED BY bash_tool → Script will be executed!`);
            }
        }
    }
}

console.log('\n\n📋 PATTERN SUMMARY\n');
console.log('='.repeat(100));

// Analyze create_file patterns
const createFilePatterns = [];

for (const msg of toolSequence) {
    for (let i = 0; i < msg.tools.length; i++) {
        const tool = msg.tools[i];
        
        if (tool.type === 'tool_use' && tool.name === 'create_file') {
            const fileName = tool.path?.split('/').pop() || 'unknown';
            const extension = fileName.split('.').pop();
            
            // Look ahead for bash_tool
            let followedByBash = false;
            for (let j = i + 1; j < msg.tools.length && j < i + 5; j++) {
                if (msg.tools[j].type === 'tool_use' && msg.tools[j].name === 'bash_tool') {
                    const bashCmd = msg.tools[j].command_preview || '';
                    if (bashCmd.includes(fileName) || bashCmd.includes('node ') || bashCmd.includes('python')) {
                        followedByBash = true;
                        break;
                    }
                }
            }
            
            createFilePatterns.push({
                file: fileName,
                extension,
                description: tool.description,
                followedByBash
            });
        }
    }
}

console.log('\nFile'.padEnd(50) + 'Extension'.padEnd(15) + 'Executed?');
console.log('-'.repeat(100));

for (const pattern of createFilePatterns) {
    console.log(
        pattern.file.padEnd(50) + 
        pattern.extension.padEnd(15) + 
        (pattern.followedByBash ? '✅ YES (Script)' : '❌ NO (Final artifact)')
    );
}

