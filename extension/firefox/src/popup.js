// Popup script for Nexus Gemini Indexer

document.addEventListener('DOMContentLoaded', () => {
  const extractCurrentBtn = document.getElementById('extractCurrentBtn');
  const generateBtn = document.getElementById('generateBtn');
  const testBtn = document.getElementById('testBtn');
  const status = document.getElementById('status');
  const results = document.getElementById('results');
  const resultsContent = document.getElementById('resultsContent');

  // Check if we're on a Gemini page
  browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    const tab = tabs[0];
    if (tab.url && tab.url.includes('gemini.google.com')) {
      extractCurrentBtn.disabled = false;
      generateBtn.disabled = false;
      status.innerHTML = '<p>✅ Gemini page detected. Ready to extract!</p>';
      status.style.borderLeftColor = '#4CAF50';
    } else {
      status.innerHTML = '<p>⚠️ Please open a Gemini conversation page first</p>';
      status.style.borderLeftColor = '#ff9800';
    }
  });

  // Extract current conversation
  extractCurrentBtn.addEventListener('click', async () => {
    extractCurrentBtn.textContent = '⏳ Extracting...';
    extractCurrentBtn.disabled = true;
    status.innerHTML = '<p>🔄 Extracting current conversation...</p>';
    status.style.borderLeftColor = '#2196F3';

    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const response = await browser.tabs.sendMessage(tabs[0].id, { action: 'extractCurrentConversation' });

      if (response.success) {
        results.style.display = 'block';
        resultsContent.textContent = JSON.stringify(response.data, null, 2);
        status.innerHTML = `<p>✅ Extracted conversation with ${response.data.messageCount} messages!</p>`;
        status.style.borderLeftColor = '#4CAF50';

        // Download the JSON file
        const filename = `gemini_conversation_${response.data.conversationId}.json`;
        downloadJSON(response.data, filename);
      } else {
        throw new Error(response.error || 'Unknown error');
      }
    } catch (error) {
      results.style.display = 'block';
      resultsContent.textContent = `Error: ${error.message}`;
      status.innerHTML = '<p>❌ Extraction failed. Make sure a conversation is open.</p>';
      status.style.borderLeftColor = '#f44336';
    } finally {
      extractCurrentBtn.textContent = '📄 Extract Current Conversation';
      extractCurrentBtn.disabled = false;
    }
  });

  // Test API detection
  testBtn.addEventListener('click', async () => {
    testBtn.textContent = 'Testing...';
    testBtn.disabled = true;

    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const response = await browser.tabs.sendMessage(tabs[0].id, { action: 'testAPI' });

      results.style.display = 'block';
      resultsContent.textContent = JSON.stringify(response, null, 2);

      if (response.success) {
        status.innerHTML = '<p>✅ API detection successful!</p>';
        status.style.borderLeftColor = '#4CAF50';
      } else {
        status.innerHTML = '<p>❌ API detection failed. See results below.</p>';
        status.style.borderLeftColor = '#f44336';
      }
    } catch (error) {
      results.style.display = 'block';
      resultsContent.textContent = `Error: ${error.message}`;
      status.innerHTML = '<p>❌ Error during test</p>';
      status.style.borderLeftColor = '#f44336';
    } finally {
      testBtn.textContent = '🔧 Test API Detection';
      testBtn.disabled = false;
    }
  });

  // Generate full index
  generateBtn.addEventListener('click', async () => {
    generateBtn.textContent = '⏳ Generating...';
    generateBtn.disabled = true;
    status.innerHTML = '<p>🔄 Generating full index from sidebar (DOM-based extraction)...</p>';
    status.style.borderLeftColor = '#2196F3';

    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const response = await browser.tabs.sendMessage(tabs[0].id, { action: 'generateIndex' });

      if (response.success) {
        results.style.display = 'block';
        resultsContent.textContent = JSON.stringify(response.data, null, 2);
        status.innerHTML = `<p>✅ Extracted ${response.data.conversations?.length || 0} conversations!</p>`;
        status.style.borderLeftColor = '#4CAF50';

        // Download the JSON file
        downloadJSON(response.data, 'gemini_index.json');
      } else {
        throw new Error(response.error || 'Unknown error');
      }
    } catch (error) {
      results.style.display = 'block';
      resultsContent.textContent = `Error: ${error.message}`;
      status.innerHTML = '<p>❌ Extraction failed</p>';
      status.style.borderLeftColor = '#f44336';
    } finally {
      generateBtn.textContent = '📚 Generate Full Index';
      generateBtn.disabled = false;
    }
  });
});

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

	  // Use an <a download> link instead of browser.downloads.download()
	  // to avoid Firefox bugs with blob: URLs in the downloads API.
	  // This still shows the standard "Save as" dialog for the user.
	  const a = document.createElement('a');
	  a.href = url;
	  a.download = filename;
	  a.style.display = 'none';
	  document.body.appendChild(a);
	  a.click();

	  // Clean up the temporary link and blob URL after a short delay
	  setTimeout(() => {
	    document.body.removeChild(a);
	    URL.revokeObjectURL(url);
	  }, 1000);
}

