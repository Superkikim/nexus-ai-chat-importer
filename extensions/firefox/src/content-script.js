// Content script for Nexus Gemini Indexer
// Runs on gemini.google.com pages

console.log('Nexus Gemini Indexer: Content script loaded');

// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'testAPI') {
    testAPIDetection().then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.action === 'generateIndex') {
    generateIndex().then(sendResponse);
    return true;
  }

  if (message.action === 'extractCurrentConversation') {
    extractCurrentConversation().then(sendResponse);
    return true;
  }
});

/**
 * Test API detection by hooking into fetch
 */
async function testAPIDetection() {
  try {
    const apiCalls = await captureAPICallsForDuration(5000); // Capture for 5 seconds
    
    return {
      success: true,
      apiCalls: apiCalls,
      message: `Captured ${apiCalls.length} API calls in 5 seconds`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate the full conversation index using DOM-based extraction.
 *
 * This walks the Gemini sidebar, clicks each conversation, waits for the
 * first message to change, then records the first message (id + preview).
 */
async function generateIndex() {
  try {
    const index = await extractAllConversationsWithMessages();

    return {
      success: true,
      data: index
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================
// DOM-BASED EXTRACTION (Main approach)
// ============================================

/**
 * Calcule le hash SHA-256 d'une chaîne de caractères
 * @param {string} text - Texte à hasher
 * @returns {Promise<string>} Hash en hexadécimal
 */
async function hashText(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Extrait le contenu complet d'un message (prompt utilisateur)
 * @param {Element} container - Conteneur du message
 * @returns {string} Texte complet du message
 */
function extractMessageContent(container) {
  const promptElement = container.querySelector('.query-text');
  if (!promptElement) return '';

  // Extraire tout le texte, y compris les paragraphes multiples
  const paragraphs = promptElement.querySelectorAll('.query-text-line');

  if (paragraphs.length > 0) {
    // Si des paragraphes sont trouvés, les joindre
    const fullText = Array.from(paragraphs)
      .map(p => p.textContent.trim())
      .filter(text => text.length > 0)
      .join('\n');
    return fullText.trim();
  } else {
    // Sinon, prendre tout le texte du .query-text
    return promptElement.textContent.trim();
  }
}

/**
 * Extrait tous les messages utilisateur de la conversation courante,
 * avec leur hash. Peut optionnellement inclure le contenu complet pour le debug.
 *
 * @param {boolean} includeFullContent - Inclure ou non le texte complet dans chaque entrée
 * @returns {Promise<Array<{messageId: string, messageHash: string, contentPreview: string, contentLength: number, fullContent?: string}>>}
 */
async function extractHashedMessagesForCurrentConversation(includeFullContent = false) {
  console.log('💬 Extraction des messages utilisateur avec hash...');

  const results = [];
  const messageContainers = document.querySelectorAll('.conversation-container[id]');

  for (const container of messageContainers) {
    const messageId = container.id;
    const messageContent = extractMessageContent(container);

    if (!messageContent) continue;

    const messageHash = await hashText(messageContent);
    const base = {
      messageId, // ID DOM (ex: "f92cc12dfbfa6748")
      messageHash, // Hash SHA-256 du contenu
      contentPreview:
        messageContent.substring(0, 100) + (messageContent.length > 100 ? '...' : ''),
      contentLength: messageContent.length
    };

    if (includeFullContent) {
      base.fullContent = messageContent;
    }

    results.push(base);
  }

  console.log(`✅ ${results.length} messages extraits et hashés`);
  return results;
}

/**
 * Extrait les données d'une conversation Gemini avec hachage des messages
 * @returns {Promise<Object|null>} Données de la conversation avec hashes
 */
async function extractGeminiConversationData() {
  console.log('🔍 Extraction des données de la conversation...');

  // 1. Récupérer l'ID de conversation depuis le panneau latéral
  const selectedConversation = document.querySelector('[data-test-id="conversation"].selected');

  if (!selectedConversation) {
    console.error('❌ Aucune conversation sélectionnée');
    return null;
  }

  // Extraire l'ID depuis l'attribut jslog
  const jslog = selectedConversation.getAttribute('jslog') || '';
  const idMatch = jslog.match(/c_[a-z0-9]{16}/);
  const conversationId = idMatch ? idMatch[0] : null;

  // Extraire le titre
  const titleElement = selectedConversation.querySelector('.conversation-title');
  const title = titleElement ? titleElement.textContent.trim() : 'Sans titre';

  if (!conversationId) {
    console.error('❌ ID de conversation introuvable');
    return null;
  }

  console.log(`📌 Conversation ID: ${conversationId}`);
  console.log(`📝 Titre: ${title}`);

  // 2. Récupérer tous les messages de la conversation avec hash + contenu complet
  const messages = await extractHashedMessagesForCurrentConversation(true);

  // 3. Construire l'objet final
  const conversationData = {
    conversationId,
    title,
    url: `https://gemini.google.com/app/${conversationId}`,
    extractedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages
  };

  return conversationData;
}

/**
 * Wrapper used by the popup to extract the currently open conversation.
 */
async function extractCurrentConversation() {
  try {
    const data = await extractGeminiConversationData();

    if (!data) {
      throw new Error('No conversation data found');
    }

    return {
      success: true,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================
// API-BASED EXTRACTION (Fallback/Alternative)
// ============================================

/**
 * Capture API calls for a specific duration
 */
function captureAPICallsForDuration(duration) {
  return new Promise((resolve) => {
    const capturedCalls = [];
    const originalFetch = window.fetch;

    // Hook fetch
    window.fetch = async function(...args) {
      const url = args[0];
      const options = args[1] || {};

      // Call original fetch
      const response = await originalFetch.apply(this, args);

      // Capture if it's a Gemini API call
      if (url.includes('gemini.google.com') || url.includes('/_/')) {
        const clonedResponse = response.clone();

        try {
          const text = await clonedResponse.text();
          capturedCalls.push({
            url: url,
            method: options.method || 'GET',
            responsePreview: text.substring(0, 200)
          });
        } catch (e) {
          // Ignore parsing errors
        }
      }

      return response;
    };

    // Restore after duration
    setTimeout(() => {
      window.fetch = originalFetch;
      resolve(capturedCalls);
    }, duration);
  });
}

// ============================================
// Multi-conversation DOM extraction
// ============================================

/**
 * Get the id of the first message of the currently open conversation.
 */
function getCurrentFirstMessageId() {
  const messageContainers = document.querySelectorAll('.conversation-container[id]');

  if (messageContainers.length === 0) {
    return null;
  }

  return messageContainers[0].id || null;
}

/**
 * Wait until the first message id changes (indicating the conversation
 * actually switched), or until maxWaitMs is reached.
 */
async function waitForMessageChange(previousMessageId, maxWaitMs = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const currentMessageId = getCurrentFirstMessageId();

    if (currentMessageId && currentMessageId !== previousMessageId) {
      const loadTime = Date.now() - startTime;
      console.log(`⏱️  Conversation changée en ${loadTime}ms`);

      // Small extra delay to let rich content (images, etc.) stabilise
      await new Promise((resolve) => setTimeout(resolve, 500));
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const loadTime = Date.now() - startTime;
  console.warn(`⚠️  Pas de changement détecté après ${loadTime}ms`);
  return false;
}

/**
 * Extract the first user message from the currently open conversation.
 */
function extractFirstMessage() {
  const messageContainers = document.querySelectorAll('.conversation-container[id]');

  if (messageContainers.length === 0) {
    return { messageId: null, preview: 'Aucun message trouvé', length: 0 };
  }

  const firstContainer = messageContainers[0];
  const messageId = firstContainer.id;
  const promptElement = firstContainer.querySelector('.query-text');

  if (!promptElement) {
    return { messageId, preview: 'Texte non trouvé', length: 0 };
  }

  const paragraphs = promptElement.querySelectorAll('.query-text-line');
  let fullText = '';

  if (paragraphs.length > 0) {
    fullText = Array.from(paragraphs)
      .map((p) => p.textContent.trim())
      .filter((text) => text.length > 0)
      .join('\n');
  } else {
    fullText = promptElement.textContent.trim();
  }

  return {
    messageId,
    preview: fullText.substring(0, 20),
    length: fullText.length
  };
}

/**
 * Extract all conversations visible in the Gemini sidebar.
 *
 * For each conversation we:
 *  - read its id + title from the sidebar
 *  - click it
 *  - wait for the first message to change
 *  - record the first message id + preview + length
 */
async function extractAllConversationsWithMessages() {
  console.log('🔍 Extraction complète des conversations depuis la barre latérale...');

  const sidebarConversations = document.querySelectorAll('[data-test-id="conversation"]');

  if (sidebarConversations.length === 0) {
    throw new Error('Aucune conversation trouvée dans la barre latérale');
  }

  const conversationList = [];

  sidebarConversations.forEach((element, index) => {
    const jslog = element.getAttribute('jslog') || '';
    const idMatch = jslog.match(/c_[a-z0-9]{16}/);
    const conversationId = idMatch ? idMatch[0] : null;

    const titleElement = element.querySelector('.conversation-title');
    const title = titleElement ? titleElement.textContent.trim() : 'Sans titre';

    if (conversationId) {
      conversationList.push({
        index: index + 1,
        conversationId,
        title,
        element
      });
    }
  });

  console.log(`✅ ${conversationList.length} conversations avec ID valide`);

  const results = [];

  for (let i = 0; i < conversationList.length; i++) {
    const conv = conversationList[i];

    console.log(`📖 [${i + 1}/${conversationList.length}] ${conv.title.substring(0, 60)}...`);

    const previousMessageId = getCurrentFirstMessageId();
    conv.element.click();

    const loadSuccess = await waitForMessageChange(previousMessageId, 5000);
    const firstMessageData = extractFirstMessage();
    const hashedMessages = await extractHashedMessagesForCurrentConversation(false);

    results.push({
      index: conv.index,
      conversationId: conv.conversationId,
      title: conv.title,
      firstMessageId: firstMessageData.messageId,
      firstMessagePreview: firstMessageData.preview,
      firstMessageLength: firstMessageData.length,
      messages: hashedMessages,
      loadSuccess
    });

    if (firstMessageData.messageId) {
      console.log(
        `   ✅ Message ID: ${firstMessageData.messageId} | Aperçu: "${firstMessageData.preview}" (${firstMessageData.length} car.)`
      );
    } else {
      console.log('   ❌ Aucun message extrait');
    }
  }

  const uniqueMessageIds = new Set(
    results.map((r) => r.firstMessageId).filter((id) => id !== null)
  );

  console.log('🔍 Vérification d’unicité :');
  console.log(`   - Total de conversations : ${results.length}`);
  console.log(
    `   - Conversations avec message : ${results.filter((r) => r.firstMessageId).length}`
  );
  console.log(`   - Message IDs uniques : ${uniqueMessageIds.size}`);

  if (uniqueMessageIds.size === results.filter((r) => r.firstMessageId).length) {
    console.log('   ✅ Tous les messages sont différents !');
  } else {
    console.warn('   ⚠️  Certains messages ont le même ID (problème potentiel de navigation)');
  }

  const exportData = {
    extractedAt: new Date().toISOString(),
    totalConversations: results.length,
    successfulExtractions: results.filter((r) => r.firstMessageId).length,
    uniqueMessages: uniqueMessageIds.size,
    source: 'dom-click-with-change-detection',
    conversations: results.map((r) => ({
      conversationId: r.conversationId,
      title: r.title,
      url: `https://gemini.google.com/app/${r.conversationId}`,
      firstMessage: {
        messageId: r.firstMessageId,
        preview: r.firstMessagePreview,
        length: r.firstMessageLength
      },
      // Nouvel index détaillé : tous les messages utilisateur avec hash
      messages: (r.messages || []).map((m) => ({
        messageId: m.messageId,
        messageHash: m.messageHash,
        length: m.contentLength
      })),
      loadSuccess: r.loadSuccess
    }))
  };

  return exportData;
}

