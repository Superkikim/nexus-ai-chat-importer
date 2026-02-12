// Background script for Nexus Gemini Indexer

console.log('Nexus Gemini Indexer: Background script loaded');

// Listen for extension installation
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Nexus Gemini Indexer installed');
    
    // Open welcome page or instructions
    browser.tabs.create({
      url: 'https://github.com/Superkikim/nexus-ai-chat-importer#gemini-support'
    });
  }
});

// Handle messages from content script or popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  // Handle any background tasks here if needed
  
  return true;
});

