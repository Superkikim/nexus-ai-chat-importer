const fs = require('fs');

const rawData = fs.readFileSync('local_resources/claude/nouvelle_conversation_artifact.json', 'utf8');
const lines = rawData.split('\n');

let inCreateFile = false;
let currentBlock = null;
let createFileBlocks = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('"type": "tool_use"')) {
        inCreateFile = false;
        currentBlock = { line: i };
    }
    
    if (line.includes('"name": "create_file"')) {
        inCreateFile = true;
    }
    
    if (inCreateFile && line.includes('"path":')) {
        const match = line.match(/"path":\s*"([^"]+)"/);
        if (match) currentBlock.path = match[1];
    }
    
    if (inCreateFile && line.includes('"description":')) {
        const match = line.match(/"description":\s*"([^"]+)"/);
        if (match) currentBlock.description = match[1];
    }
    
    if (inCreateFile && line.includes('"display_content":')) {
        // Read next few lines to get the full display_content
        const nextLines = lines.slice(i, i + 5).join(' ');
        const typeMatch = nextLines.match(/"type":\s*"([^"]+)"/);
        const languageMatch = nextLines.match(/"language":\s*"([^"]+)"/);
        const filenameMatch = nextLines.match(/"filename":\s*"([^"]+)"/);

        if (currentBlock) {
            if (typeMatch) currentBlock.display_type = typeMatch[1];
            if (languageMatch) currentBlock.display_language = languageMatch[1];
            if (filenameMatch) currentBlock.display_filename = filenameMatch[1];
        }
    }
    
    if (inCreateFile && line.trim() === '},') {
        if (currentBlock && currentBlock.path) {
            createFileBlocks.push(currentBlock);
        }
        inCreateFile = false;
        currentBlock = null;
    }
}

console.log('📊 DISPLAY_CONTENT ANALYSIS FOR create_file\n');
console.log('='.repeat(100));

for (const block of createFileBlocks) {
    const fileName = block.path.split('/').pop();
    const extension = fileName.split('.').pop();
    
    console.log(`\n📄 ${fileName}`);
    console.log(`   Path: ${block.path}`);
    console.log(`   Description: ${block.description || 'N/A'}`);
    console.log(`   Display Type: ${block.display_type || 'N/A'}`);
    console.log(`   Display Language: ${block.display_language || 'N/A'}`);
    console.log(`   Display Filename: ${block.display_filename || 'N/A'}`);
}

console.log('\n\n📋 SUMMARY TABLE\n');
console.log('='.repeat(100));
console.log('File'.padEnd(50) + 'Display Type'.padEnd(20) + 'Display Language');
console.log('-'.repeat(100));

for (const block of createFileBlocks) {
    const fileName = block.path.split('/').pop();
    console.log(
        fileName.padEnd(50) + 
        (block.display_type || 'N/A').padEnd(20) + 
        (block.display_language || 'N/A')
    );
}

console.log('\n\n🔍 PATTERNS DETECTED\n');
console.log('='.repeat(100));

const byDisplayType = {};
for (const block of createFileBlocks) {
    const type = block.display_type || 'unknown';
    if (!byDisplayType[type]) byDisplayType[type] = [];
    byDisplayType[type].push(block);
}

for (const [type, blocks] of Object.entries(byDisplayType)) {
    console.log(`\n${type}: ${blocks.length} files`);
    for (const block of blocks) {
        const fileName = block.path.split('/').pop();
        console.log(`  - ${fileName} (${block.display_language || 'no language'})`);
    }
}

