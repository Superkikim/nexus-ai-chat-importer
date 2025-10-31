/**
 * Reusable Ko-fi support box component
 * Used in upgrade dialogs, installation dialog, etc.
 */

/**
 * Create a Ko-fi support callout box
 * @param container - The HTML element to append the box to
 * @param message - Optional custom message (default: standard support message)
 */
export function createKofiSupportBox(container: HTMLElement, message?: string): void {
    const supportBox = container.createDiv('kofi-support-box');
    supportBox.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        padding: 24px;
        margin: 24px 0;
        color: white;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;

    // Header with icon and title
    const header = supportBox.createDiv();
    header.style.cssText = `
        text-align: center;
        margin-bottom: 16px;
    `;
    header.innerHTML = `
        <div style="font-size: 1.3em; font-weight: 600;">
            ☕ <strong style="color: #FFD700;">Support This Plugin</strong>
        </div>
    `;

    // Message with paragraphs
    const messageEl = supportBox.createDiv();
    messageEl.style.cssText = `
        text-align: center;
        margin-bottom: 20px;
        line-height: 1.6;
    `;

    if (message) {
        // Custom message - split by \n\n for paragraphs
        const paragraphs = message.split('\n\n');
        messageEl.innerHTML = paragraphs.map(p => {
            // Check if paragraph contains stats (numbers) to make it bold
            const hasStats = /\d{1,3}[',]\d{3}|\$\d+/.test(p);
            if (hasStats) {
                return `<p style="margin: 8px 0; color: rgba(255, 255, 255, 0.95);"><strong style="color: #FFD700; font-size: 1.05em;">${p}</strong></p>`;
            }
            return `<p style="margin: 8px 0; color: rgba(255, 255, 255, 0.95);">${p}</p>`;
        }).join('');
    } else {
        // Default message
        messageEl.innerHTML = `
            <p style="margin: 8px 0; color: rgba(255, 255, 255, 0.95);">I'm working on Nexus projects full-time while unemployed and dealing with health issues.</p>
            <p style="margin: 8px 0; color: rgba(255, 255, 255, 0.95);"><strong style="color: #FFD700; font-size: 1.05em;">Over 4,300 downloads so far, yet I've received only $20 in donations in the last two months while paying about $200/month out of pocket in expenses.</strong></p>
            <p style="margin: 8px 0; color: rgba(255, 255, 255, 0.95);">If this plugin makes your life easier, a donation would mean the world to me and help keep them alive.</p>
        `;
    }

    // Ko-fi button (larger and more prominent)
    const buttonContainer = supportBox.createDiv();
    buttonContainer.style.cssText = `
        text-align: center;
        margin: 20px 0;
    `;
    buttonContainer.innerHTML = `
        <a href="https://ko-fi.com/nexusplugins" target="_blank" style="display: inline-block; transition: transform 0.2s ease;">
            <img src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" alt="Buy Me a Coffee at ko-fi.com" height="50" style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);">
        </a>
    `;

    // Add hover effect to button
    const kofiLink = buttonContainer.querySelector('a') as HTMLAnchorElement;
    if (kofiLink) {
        kofiLink.addEventListener('mouseenter', () => {
            kofiLink.style.transform = 'scale(1.05)';
        });
        kofiLink.addEventListener('mouseleave', () => {
            kofiLink.style.transform = 'scale(1)';
        });
    }

    // Suggested amounts
    const amounts = supportBox.createDiv();
    amounts.style.cssText = `
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.3);
    `;
    amounts.innerHTML = `
        <div style="text-align: center; font-size: 0.9em; margin-bottom: 12px; color: rgba(255, 255, 255, 0.9);">Suggested amounts:</div>
        <div style="display: flex; justify-content: center; gap: 16px; flex-wrap: wrap;">
            <span style="background: rgba(255, 255, 255, 0.2); padding: 8px 16px; border-radius: 20px; font-size: 0.9em; font-weight: 500; backdrop-filter: blur(10px);">☕ $5 - Coffee</span>
            <span style="background: rgba(255, 255, 255, 0.2); padding: 8px 16px; border-radius: 20px; font-size: 0.9em; font-weight: 500; backdrop-filter: blur(10px);">🤖 $25 - AI Tools</span>
            <span style="background: rgba(255, 255, 255, 0.2); padding: 8px 16px; border-radius: 20px; font-size: 0.9em; font-weight: 500; backdrop-filter: blur(10px);">🚀 $75 - Dev Toolkit</span>
        </div>
    `;

    // Reality check footer
    const footer = supportBox.createDiv();
    footer.style.cssText = `
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.3);
        text-align: center;
        font-size: 0.9em;
        color: rgba(255, 255, 255, 0.85);
    `;
    footer.innerHTML = `
        <em>Reality check: Over 4,300 downloads, but only $20 in donations over two months. If you use this plugin regularly, please consider contributing. Even $5 makes a real difference! 🙏</em>
    `;
}

