/**
 * NEXUS GEMINI INDEXER - CONSOLE TEST SCRIPT
 * 
 * Instructions:
 * 1. Open gemini.google.com in your browser
 * 2. Open DevTools (F12) → Console tab
 * 3. Copy-paste this entire script and press Enter
 * 4. The script will:
 *    - Hook into fetch() to capture API calls
 *    - Monitor network requests for 10 seconds
 *    - Extract conversation data from API responses
 *    - Display results in the console
 * 
 * While the script is running, scroll through your conversations
 * or navigate to different chats to trigger API calls.
 */

(function() {
  console.log('🚀 Nexus Gemini Indexer - Test Script Started');
  console.log('📡 Monitoring API calls for 10 seconds...');
  console.log('💡 TIP: Scroll through conversations or click on different chats');
  
  const capturedAPICalls = [];
  const extractedConversations = [];
  const originalFetch = window.fetch;
  
  // Hook into fetch
  window.fetch = async function(...args) {
    const url = args[0];
    const options = args[1] || {};
    
    // Call original fetch
    const response = await originalFetch.apply(this, args);
    
    // Only capture Gemini API calls
    if (typeof url === 'string' && 
        (url.includes('gemini.google.com') || url.includes('/_/'))) {
      
      const clonedResponse = response.clone();
      
      try {
        const text = await clonedResponse.text();
        
        // Store API call info
        const apiCall = {
          url: url,
          method: options.method || 'GET',
          timestamp: new Date().toISOString(),
          responseSize: text.length,
          responsePreview: text.substring(0, 300)
        };
        
        capturedAPICalls.push(apiCall);
        
        console.log('📥 API Call captured:', {
          url: url,
          size: text.length,
          preview: text.substring(0, 100) + '...'
        });
        
        // Try to extract conversation data
        const conversations = tryExtractConversations(text, url);
        if (conversations.length > 0) {
          extractedConversations.push(...conversations);
          console.log('✅ Extracted conversations:', conversations);
        }
        
      } catch (error) {
        console.error('❌ Error processing response:', error);
      }
    }
    
    return response;
  };
  
  // Restore original fetch after 10 seconds
  setTimeout(() => {
    window.fetch = originalFetch;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total API calls captured: ${capturedAPICalls.length}`);
    console.log(`Conversations extracted: ${extractedConversations.length}`);
    console.log('\n📋 All API Calls:');
    console.table(capturedAPICalls.map(call => ({
      URL: call.url.substring(0, 80),
      Method: call.method,
      Size: call.responseSize,
      Time: call.timestamp
    })));
    
    if (extractedConversations.length > 0) {
      console.log('\n💬 Extracted Conversations:');
      console.table(extractedConversations);
      
      console.log('\n📥 Download JSON:');
      console.log('Copy this data to save as gemini_index.json:');
      console.log(JSON.stringify({
        conversations: extractedConversations,
        exportDate: new Date().toISOString(),
        totalConversations: extractedConversations.length,
        source: 'console-test'
      }, null, 2));
    } else {
      console.log('\n⚠️ No conversations extracted.');
      console.log('💡 Try these actions:');
      console.log('   1. Scroll through the conversation sidebar');
      console.log('   2. Click on different conversations');
      console.log('   3. Refresh the page and run the script again');
      console.log('\n📋 Raw API responses (first 500 chars each):');
      capturedAPICalls.forEach((call, i) => {
        console.log(`\n--- API Call ${i + 1} ---`);
        console.log(call.responsePreview);
      });
    }
    
    console.log('\n✅ Test complete!');
    
  }, 10000);
  
  /**
   * Try to extract conversation data from API response
   */
  function tryExtractConversations(responseText, url) {
    const conversations = [];
    
    try {
      // Remove XSSI protection prefix
      let cleaned = responseText.replace(/^\)\]\}'\n/, '');
      
      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(cleaned);
      } catch (e) {
        // Not valid JSON
        return conversations;
      }
      
      // Strategy 1: Look for array of arrays (common Google RPC format)
      if (Array.isArray(data)) {
        searchArrayForConversations(data, conversations);
      }
      
      // Strategy 2: Look for specific keys
      if (typeof data === 'object') {
        searchObjectForConversations(data, conversations);
      }
      
    } catch (error) {
      // Ignore parsing errors
    }
    
    return conversations;
  }
  
  /**
   * Recursively search arrays for conversation-like data
   */
  function searchArrayForConversations(arr, results, depth = 0) {
    if (depth > 10) return; // Prevent infinite recursion
    
    for (const item of arr) {
      if (Array.isArray(item)) {
        // Check if this looks like a conversation entry
        // Format: [id, title, timestamp, ...]
        if (item.length >= 2 && 
            typeof item[0] === 'string' && 
            typeof item[1] === 'string') {
          
          const conversation = {
            conversationId: item[0],
            title: item[1],
            timestamp: item[2] || null,
            url: `https://gemini.google.com/app/${item[0]}`
          };
          
          // Only add if it looks valid
          if (conversation.conversationId.length > 5) {
            results.push(conversation);
          }
        }
        
        // Recurse
        searchArrayForConversations(item, results, depth + 1);
      }
    }
  }
  
  /**
   * Recursively search objects for conversation-like data
   */
  function searchObjectForConversations(obj, results, depth = 0) {
    if (depth > 10) return;
    
    for (const key in obj) {
      const value = obj[key];
      
      if (Array.isArray(value)) {
        searchArrayForConversations(value, results, depth + 1);
      } else if (typeof value === 'object' && value !== null) {
        searchObjectForConversations(value, results, depth + 1);
      }
    }
  }
  
  // Also try to extract from current page URL
  const currentUrl = window.location.href;
  const match = currentUrl.match(/\/app\/([a-zA-Z0-9_-]+)/);
  if (match) {
    console.log('📍 Current conversation ID from URL:', match[1]);
  }
  
})();

