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
            <p>Over 4,300 downloads so far, yet I've received only $20 in donations in the last two months while paying about $200/month out of pocket in expenses.</p>
            <p>If this plugin makes your life easier, a donation would mean the world to me and help keep them alive.</p>
        `;
    }

    // Reality check (more visible, with thousands of hours)
    const realityCheck = supportBox.createDiv('kofi-reality-check');
    realityCheck.innerHTML = `
        <strong>Reality check:</strong> Thousands of hours of work, over 4,300 downloads, but only $20 in donations over two months. If you use this plugin regularly, please consider contributing. Even $5 makes a real difference! 🙏
    `;

    // Ko-fi button
    const buttonContainer = supportBox.createDiv('kofi-button-container');
    buttonContainer.innerHTML = `
        <a href="https://ko-fi.com/nexusplugins" target="_blank">
            <img src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" alt="Buy Me a Coffee at ko-fi.com" height="50">
        </a>
    `;

    // Suggested amounts
    const amounts = supportBox.createDiv('kofi-amounts');
    amounts.innerHTML = `
        <div class="kofi-amounts-title">Suggested amounts:</div>
        <div class="kofi-amounts-list">
            <span class="kofi-amount-badge">☕ $5 - Coffee</span>
            <span class="kofi-amount-badge">🤖 $25 - AI Tools</span>
            <span class="kofi-amount-badge">🚀 $75 - Dev Toolkit</span>
        </div>
    `;
}

