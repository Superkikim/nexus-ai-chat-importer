/**
 * Reusable support box component
 * Used in upgrade dialogs, installation dialog, etc.
 * All styles are defined in styles.css under "SUPPORT BOX" section
 */
import { t } from "../../i18n";
import { getLocalizedSupportUrl } from "../../utils/support-links";

/**
 * The one support message, shown the same way everywhere.
 * Returns the donate link so a dialog can close itself when it is followed.
 */
export function createSupportBox(container: HTMLElement): HTMLAnchorElement {
    const support = container.createDiv("nexus-support");

    support.createDiv({
        cls: "nexus-support-title",
        text: `💙 ${t("support_box.title")}`,
    });

    const box = support.createDiv("nexus-support-box");
    box.createEl("p", { text: t("support_box.message") });
    box.createEl("p", {
        cls: "nexus-support-reality-check",
        text: t("support_box.reality_check"),
    });
    box.createEl("p", { text: t("support_box.cta") });

    const supportLink = support.createEl("a", {
        cls: "nexus-support-button",
        text: t("support_box.button"),
        href: getLocalizedSupportUrl(),
    });
    supportLink.setAttr("target", "_blank");
    return supportLink;
}
