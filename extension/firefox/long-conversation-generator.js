/**
 * NEXUS GEMINI – Générer une longue conversation (100 messages)
 *
 * Utilisation :
 * 1. Ouvre https://gemini.google.com dans ton navigateur.
 * 2. Crée une nouvelle conversation (ou utilise-en une dédiée aux tests).
 * 3. Ouvre les DevTools (F12) → onglet "Console".
 * 4. Copie-colle l'intégralité de ce fichier et appuie sur Entrée.
 *
 * Le script envoie TOTAL_MESSAGES prompts successifs en attendant que
 * le bouton "Envoyer" revienne entre chaque message.
 */

(async () => {
  const TOTAL_MESSAGES = 100;
  const DELAY_BETWEEN_MESSAGES_MS = 4000; // délai entre deux messages
  const MAX_WAIT_FOR_SEND_MS = 60000;     // timeout pour le bouton Envoyer

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function findInputElementOnce() {
    const selectors = [
      // Sélecteurs fréquents (EN)
      'textarea[aria-label*="Message"][aria-label*="Gemini"]',
      'textarea[aria-label*="Send a message"]',
      // Variantes FR probables
      'textarea[aria-label*="message"][aria-label*="Gemini"]',
      'textarea[aria-label*="Envoyer un message"]',
      // Fallbacks génériques
      'textarea',
      '[contenteditable="true"][role="textbox"]',
      '[contenteditable="true"]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    return null;
  }

  function findSendButtonOnce() {
    const selectors = [
      // ARIA typiques
      'button[aria-label*="Send"]',
      'button[aria-label*="Envoyer"]',
      // Data-testid / structure locale
      '[data-testid*="send-button"]',
      '[data-testid*="input-area"] button',
      // Fallback générique
      'button[type="submit"]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    return null;
  }

  async function waitForSendButton(maxWaitMs = MAX_WAIT_FOR_SEND_MS) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const btn = findSendButtonOnce();
      if (btn) return btn;
      await sleep(500);
    }
    throw new Error("Bouton Envoyer introuvable après attente.");
  }

  function setInputValue(input, text) {
    if (!input) {
      throw new Error("Champ de saisie Gemini introuvable.");
    }

    if (input.tagName === "TEXTAREA") {
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (input.isContentEditable) {
      input.innerText = text;
      const ev = new InputEvent("input", { bubbles: true, cancelable: true });
      input.dispatchEvent(ev);
    } else {
      throw new Error("Type de champ non géré pour l'input Gemini.");
    }
  }

  async function sendOneMessage(index, total) {
    const input = findInputElementOnce();
    if (!input) {
      throw new Error("Impossible de trouver le champ de saisie Gemini.");
    }

    // Attendre que le bouton Envoyer soit présent (Gemini prêt à recevoir)
    const sendButton = await waitForSendButton();

    const text = `Lazy-load test message ${index}/${total} – ${new Date().toISOString()}`;
    setInputValue(input, text);

    // Petit délai pour laisser le texte se propager dans la stack d'événements
    await sleep(200);

    if (sendButton.disabled) {
      console.warn(`⚠️ Bouton Envoyer désactivé au message ${index}, tentative quand même...`);
    }

    sendButton.click();
    console.log(`✅ Message ${index}/${total} envoyé : "${text}"`);
  }

  console.log(`🚀 Démarrage de la génération de ${TOTAL_MESSAGES} messages...`);

  for (let i = 1; i <= TOTAL_MESSAGES; i++) {
    try {
      await sendOneMessage(i, TOTAL_MESSAGES);
    } catch (e) {
      console.error(`❌ Erreur lors de l'envoi du message ${i}:`, e);
      break;
    }

    if (i < TOTAL_MESSAGES) {
      await sleep(DELAY_BETWEEN_MESSAGES_MS);
    }
  }

  console.log("🏁 Script terminé.");
})();

