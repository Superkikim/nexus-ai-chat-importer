/**
 * Reusable Ko-fi support box component
 * Used in upgrade dialogs, installation dialog, etc.
 * All styles are defined in styles.css under "KO-FI SUPPORT BOX" section
 */

/**
 * Create a Ko-fi support callout box
 * @param container - The HTML element to append the box to
 * @param message - Optional custom message (default: standard support message)
 */
export function createKofiSupportBox(container: HTMLElement, message?: string): void {
    const supportBox = container.createDiv('kofi-support-box');

    // Header
    const header = supportBox.createDiv('kofi-header');
    header.innerHTML = `☕ <span class="kofi-header-highlight">Support This Plugin</span>`;

    // Message with emphasis on unemployment + health issues
    const messageEl = supportBox.createDiv('kofi-message');

    if (message) {
        // Custom message - split by \n\n for paragraphs
        const paragraphs = message.split('\n\n');
        messageEl.innerHTML = paragraphs.map(p => {
            // Check if paragraph contains stats (numbers) to make it bold
            const hasStats = /\d{1,3}[',]\d{3}|\$\d+/.test(p);
            if (hasStats) {
                return `<p><span class="kofi-message-emphasis">${p}</span></p>`;
            }
            return `<p>${p}</p>`;
        }).join('');
    } else {
        // Default message - emphasize unemployment + health issues
        messageEl.innerHTML = `
            <p><span class="kofi-message-emphasis">I'm working on Nexus projects full-time while unemployed and dealing with health issues.</span></p>
            <p>If this plugin makes your life easier, a donation would mean the world to me and help keep them alive.</p>
        `;
    }

    // Support message (more visible, with thousands of hours)
    const realityCheck = supportBox.createDiv('kofi-reality-check');
    realityCheck.innerHTML = `
        <strong>Thank you to everyone who has supported this project!</strong> Thousands of hours of work, more than 4'300 downloads. If this plugin makes your life easier, please consider supporting its continued development.
    `;

    // Ko-fi button (using GitHub raw link from tag 1.3.0)
    const buttonContainer = supportBox.createDiv('kofi-button-container');
    const buttonImagePath = 'https://raw.githubusercontent.com/Superkikim/nexus-ai-chat-importer/1.3.0/assets/support_me_on_kofi_red.png';

    buttonContainer.innerHTML = `
        <a href="https://ko-fi.com/nexusplugins" target="_blank">
            <img src="${buttonImagePath}" alt="Support me on Ko-fi" height="50">
        </a>
    `;
}

