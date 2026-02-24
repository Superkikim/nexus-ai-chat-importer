/**
 * Reusable support box component
 * Used in upgrade dialogs, installation dialog, etc.
 * All styles are defined in styles.css under "SUPPORT BOX" section
 */

/**
 * Create a support callout box
 * @param container - The HTML element to append the box to
 * @param message - Optional custom message (default: standard support message)
 */
export function createSupportBox(container: HTMLElement, message?: string): void {
    const supportBox = container.createDiv('nexus-support-box');

    // Header
    const header = supportBox.createDiv('nexus-support-header');
    header.innerHTML = `☕ <span class="nexus-support-header-highlight">Support This Plugin</span>`;

    // Message with emphasis on unemployment + health issues
    const messageEl = supportBox.createDiv('nexus-support-message');

    if (message) {
        // Custom message - split by \n\n for paragraphs
        const paragraphs = message.split('\n\n');
        messageEl.innerHTML = paragraphs.map(p => {
            // Check if paragraph contains stats (numbers) to make it bold
            const hasStats = /\d{1,3}[',]\d{3}|\$\d+/.test(p);
            if (hasStats) {
                return `<p><span class="nexus-support-message-emphasis">${p}</span></p>`;
            }
            return `<p>${p}</p>`;
        }).join('');
    } else {
        // Default message - emphasize unemployment + health issues
        messageEl.innerHTML = `
            <p><span class="nexus-support-message-emphasis">I'm working on Nexus projects full-time while unemployed and dealing with health issues.</span></p>
            <p>If this plugin makes your life easier, a donation would mean the world to me and help keep them alive.</p>
        `;
    }

	    // Appreciation message (still honest about health situation, but more positive)
	    const realityCheck = supportBox.createDiv('nexus-support-reality-check');
	    realityCheck.innerHTML = `
	        <strong>Thank you!</strong> Thousands of hours of work have gone into these plugins, and every coffee helps me keep improving them while managing ongoing health issues. If this plugin makes your life easier, please consider supporting me.
	    `;

    const buttonContainer = supportBox.createDiv('nexus-support-button-container');
    buttonContainer.innerHTML = `
        <a href="https://nexus-prod.dev/nexus-ai-chat-importer/support" target="_blank" class="nexus-support-link">
            ☕ Support my work
        </a>
    `;
}


