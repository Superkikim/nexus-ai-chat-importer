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
        padding: 20px;
        margin: 20px 0;
        color: white;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    `;

    // Icon and title
    const header = supportBox.createDiv();
    header.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    `;

    const icon = header.createSpan();
    icon.innerHTML = '☕';
    icon.style.fontSize = '28px';

    const title = header.createSpan();
    title.textContent = 'Support Development';
    title.style.cssText = `
        font-size: 1.2em;
        font-weight: 600;
    `;

    // Message
    const messageEl = supportBox.createDiv();
    messageEl.style.cssText = `
        margin-bottom: 16px;
        line-height: 1.5;
        opacity: 0.95;
    `;
    messageEl.textContent = message || "I'm working on Nexus projects full-time while unemployed and dealing with health issues - over 1,000 users so far, but I've received just $10 in donations while paying $200/month out of pocket in expenses. If these plugins help you, even a small donation would mean the world and help keep them alive.";

    // Ko-fi button
    const buttonContainer = supportBox.createDiv();
    buttonContainer.style.textAlign = 'center';

    const kofiButton = buttonContainer.createEl('a', {
        text: '☕ Support on Ko-fi',
        href: 'https://ko-fi.com/superkikim'
    });
    kofiButton.style.cssText = `
        display: inline-block;
        background: white;
        color: #667eea;
        padding: 12px 24px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    `;

    // Hover effect
    kofiButton.addEventListener('mouseenter', () => {
        kofiButton.style.transform = 'translateY(-2px)';
        kofiButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    });

    kofiButton.addEventListener('mouseleave', () => {
        kofiButton.style.transform = 'translateY(0)';
        kofiButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
    });

    // Open in external browser
    kofiButton.addEventListener('click', (e) => {
        e.preventDefault();
        window.open('https://ko-fi.com/superkikim', '_blank');
    });
}

