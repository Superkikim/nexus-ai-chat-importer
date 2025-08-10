const fs = require('fs');

// Read the devices_table.json file
const data = JSON.parse(fs.readFileSync('devices_table_array.json', 'utf8'));
const artifacts = data[0]; // First array contains the artifacts

console.log('=== TEST SIMULATION DEVICES_TABLE ===');
let artifactContents = new Map();
let versionCounter = 0;

for (const artifact of artifacts) {
    versionCounter++;
    
    console.log(`\n--- v${versionCounter} (${artifact.command}) ---`);
    console.log(`version_uuid: ${artifact.version_uuid}`);
    console.log(`has content: ${!!(artifact.content)}`);
    console.log(`has old_str: ${!!(artifact.old_str)}`);
    console.log(`has new_str: ${!!(artifact.new_str)}`);
    
    let finalContent = '';
    const previousContent = artifactContents.get('devices_table') || '';
    
    if (artifact.command === 'create' || artifact.command === 'rewrite') {
        finalContent = artifact.content || '';
        console.log(`RESET content: ${finalContent.length} chars`);
    } else if (artifact.command === 'update') {
        if (artifact.old_str && artifact.new_str) {
            finalContent = previousContent.replace(artifact.old_str, artifact.new_str);
            console.log(`REPLACE: ${previousContent.length} -> ${finalContent.length} chars`);
        } else if (artifact.content && artifact.content.length > 0) {
            finalContent = artifact.content;
            console.log(`FULL CONTENT: ${finalContent.length} chars`);
        } else {
            finalContent = previousContent;
            console.log(`KEEP PREVIOUS: ${finalContent.length} chars`);
        }
    }
    
    artifactContents.set('devices_table', finalContent);
    console.log(`Final content length: ${finalContent.length}`);
}

console.log('\n=== SUMMARY ===');
console.log(`Total versions: ${versionCounter}`);
console.log(`Final content length: ${artifactContents.get('devices_table')?.length || 0}`);
