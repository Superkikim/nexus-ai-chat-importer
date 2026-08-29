/**
 * Reusable support box component
 * Used in upgrade dialogs, installation dialog, etc.
 * All styles are defined in styles.css under "SUPPORT BOX" section
 */
import { t } from "../../i18n";
import { getLocalizedSupportUrl } from "../../utils/support-links";

/**
 * Create a support callout box
 * @param container - The HTML element to append the box to
 * @param message - Optional custom message (default: standard support message)
 */
export function createSupportBox(
    container: HTMLElement,
    message?: string
): void {
    const supportBox = container.createDiv("nexus-support-box");

    // Header
    const header = supportBox.createDiv("nexus-support-header");
    header.createSpan({
        cls: "nexus-support-header-highlight",
        text: t("support_box.header_highlight"),
    });

    // Message with emphasis on active project maintenance
    const messageEl = supportBox.createDiv("nexus-support-message");

    if (message) {
        // Custom message - split by \n\n for paragraphs
        const paragraphs = message.split("\n\n");
        paragraphs.forEach((pText) => {
            const hasStats = /\d{1,3}[',]\d{3}|\$\d+/.test(pText);
            const p = messageEl.createEl("p");
            if (hasStats) {
                p.createSpan({
                    cls: "nexus-support-message-emphasis",
                    text: pText,
                });
            } else {
                p.setText(pText);
            }
        });
    } else {
        // Two sentences: what the money is for, then why it matters right now.
        // The counting of who does and does not donate read as a reproach to
        // the many thousands who simply use the plugin.
        messageEl.createEl("p").createSpan({
            cls: "nexus-support-message-emphasis",
            text: t("support_box.default_message_emphasis"),
        });
        messageEl.createEl("p", { text: t("support_box.default_message") });
    }

    const supportUrl = getLocalizedSupportUrl();

    const buttonContainer = supportBox.createDiv(
        "nexus-support-button-container"
    );
    const supportLink = buttonContainer.createEl("a", {
        cls: "nexus-support-link",
        text: t("support_box.button_alt"),
        href: supportUrl,
    });
    supportLink.setAttr("target", "_blank");
}
