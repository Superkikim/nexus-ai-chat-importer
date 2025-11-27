const fs = require('fs');

// Read file line by line to avoid JSON parsing issues with control characters
const rawData = fs.readFileSync('local_resources/claude/nouvelle_conversation_artifact.json', 'utf8');

let data;
try {
    data = JSON.parse(rawData);
} catch (e) {
    console.error('JSON parse error, trying with regex extraction...');
    // Fallback: extract messages using regex
    process.exit(1);
}

console.log('🔍 COMPLETE WORKFLOW ANALYSIS FOR ALL ARTIFACTS\n');
console.log('='.repeat(120));

// Extract all messages
const messages = data.chat_messages;

// Track all create_file occurrences
const createFileWorkflows = [];

for (let msgIndex = 0; msgIndex < messages.length; msgIndex++) {
    const message = messages[msgIndex];
    
    if (message.sender !== 'assistant') continue;
    
    const content = message.content || [];
    
    // Find all create_file in this message
    for (let i = 0; i < content.length; i++) {
        const block = content[i];
        
        if (block.type === 'tool_use' && block.name === 'create_file') {
            const filePath = block.input?.path;
            const fileName = filePath?.split('/').pop() || 'unknown';
            const description = block.input?.description || '';
            const fileTextLength = (block.input?.file_text || '').length;
            
            // Get display_content language
            const displayLang = block.display_content?.json_block 
                ? JSON.parse(block.display_content.json_block).language 
                : 'N/A';
            
            // Look for bash_tool execution after this create_file
            let bashToolFound = false;
            let bashCommand = '';
            
            for (let j = i + 1; j < content.length && j < i + 10; j++) {
                if (content[j].type === 'tool_use' && content[j].name === 'bash_tool') {
                    const cmd = content[j].input?.command || '';
                    if (cmd.includes(fileName) || cmd.includes('node ') || cmd.includes('python')) {
                        bashToolFound = true;
                        bashCommand = cmd.substring(0, 80);
                        break;
                    }
                }
            }
            
            // Look for final text block with computer:/// link
            let finalTextBlock = null;
            let computerLink = null;
            
            for (let j = content.length - 1; j >= 0; j--) {
                if (content[j].type === 'text' && content[j].text) {
                    finalTextBlock = content[j].text;
                    
                    // Extract computer:/// links
                    const computerLinkMatch = finalTextBlock.match(/computer:\/\/\/[^\)]+/g);
                    if (computerLinkMatch) {
                        computerLink = computerLinkMatch.map(link => link.split('/').pop()).join(', ');
                    }
                    break;
                }
            }
            
            createFileWorkflows.push({
                msgIndex,
                fileName,
                filePath,
                description,
                fileTextLength,
                displayLang,
                bashToolFound,
                bashCommand,
                hasFinalText: !!finalTextBlock,
                computerLink,
                finalTextPreview: finalTextBlock ? finalTextBlock.substring(0, 150) : null
            });
        }
    }
}

console.log('\n📋 ALL CREATE_FILE WORKFLOWS\n');
console.log('='.repeat(120));

for (const workflow of createFileWorkflows) {
    console.log(`\n${'─'.repeat(120)}`);
    console.log(`📄 FILE: ${workflow.fileName}`);
    console.log(`   Path: ${workflow.filePath}`);
    console.log(`   Description: ${workflow.description}`);
    console.log(`   File text length: ${workflow.fileTextLength} chars`);
    console.log(`   Display language: ${workflow.displayLang}`);
    console.log(`   Followed by bash_tool: ${workflow.bashToolFound ? '✅ YES' : '❌ NO'}`);
    if (workflow.bashToolFound) {
        console.log(`   Bash command: ${workflow.bashCommand}...`);
    }
    console.log(`   Has final text block: ${workflow.hasFinalText ? '✅ YES' : '❌ NO'}`);
    console.log(`   Computer link in text: ${workflow.computerLink ? `✅ ${workflow.computerLink}` : '❌ NONE'}`);
    if (workflow.finalTextPreview) {
        console.log(`   Final text preview: "${workflow.finalTextPreview}..."`);
    }
}

console.log('\n\n📊 PATTERN SUMMARY\n');
console.log('='.repeat(120));

console.log('\nFile'.padEnd(50) + 'Lang'.padEnd(15) + 'Bash?'.padEnd(10) + 'Text?'.padEnd(10) + 'Link?');
console.log('─'.repeat(120));

for (const workflow of createFileWorkflows) {
    console.log(
        workflow.fileName.padEnd(50) +
        workflow.displayLang.padEnd(15) +
        (workflow.bashToolFound ? '✅ YES' : '❌ NO').padEnd(10) +
        (workflow.hasFinalText ? '✅ YES' : '❌ NO').padEnd(10) +
        (workflow.computerLink ? `✅ ${workflow.computerLink}` : '❌ NONE')
    );
}

console.log('\n\n🎯 DECISION LOGIC\n');
console.log('='.repeat(120));

for (const workflow of createFileWorkflows) {
    let decision = '';
    let reason = '';
    
    if (workflow.computerLink && workflow.computerLink.includes(workflow.fileName)) {
        decision = '⚠️  CALLOUT (Produit final sur serveur)';
        reason = `Lien computer:/// vers ${workflow.fileName}`;
    } else if (workflow.bashToolFound) {
        decision = '⚠️  CALLOUT (Script exécuté)';
        reason = 'Suivi de bash_tool qui exécute le script';
    } else if (workflow.fileTextLength >= 200) {
        decision = '✅ ARTIFACT (Contenu complet)';
        reason = `Contenu complet (${workflow.fileTextLength} chars), pas exécuté`;
    } else {
        decision = '⚠️  CALLOUT (Description courte)';
        reason = `Contenu court (${workflow.fileTextLength} chars)`;
    }
    
    console.log(`\n${workflow.fileName}`);
    console.log(`  → ${decision}`);
    console.log(`     Raison: ${reason}`);
}

