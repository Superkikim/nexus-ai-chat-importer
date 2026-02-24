/**
 * Reusable support box component
 * Used in upgrade dialogs, installation dialog, etc.
 * All styles are defined in styles.css under "SUPPORT BOX" section
 */
import { t } from '../../i18n';

/**
 * Create a support callout box
 * @param container - The HTML element to append the box to
 * @param message - Optional custom message (default: standard support message)
 */
export function createSupportBox(container: HTMLElement, message?: string): void {
    const supportBox = container.createDiv('nexus-support-box');

    // Header
    const header = supportBox.createDiv('nexus-support-header');
    header.innerHTML = `<span class="nexus-support-header-highlight">${t('support_box.header_highlight')}</span>`;

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
            <p><span class="nexus-support-message-emphasis">${t('support_box.default_message_emphasis')}</span></p>
            <p>${t('support_box.default_message')}</p>
        `;
    }

	    // Appreciation message (still honest about health situation, but more positive)
	    const realityCheck = supportBox.createDiv('nexus-support-reality-check');
	    realityCheck.innerHTML = t('support_box.reality_check');

    const locale = window.moment.locale();
    const supported = ['fr','de','es','it','ru','zh','ja','pt','ko'];
    const supportUrl = supported.includes(locale)
        ? `https://nexus-prod.dev/${locale}/nexus-ai-chat-importer/support`
        : 'https://nexus-prod.dev/nexus-ai-chat-importer/support';

    const buttonContainer = supportBox.createDiv('nexus-support-button-container');
    buttonContainer.innerHTML = `
        <a href="${supportUrl}" target="_blank" class="nexus-support-link">
            ${t('support_box.button_alt')}
        </a>
    `;
}


