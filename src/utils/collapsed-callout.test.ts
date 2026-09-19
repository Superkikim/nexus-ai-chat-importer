import { describe, expect, it } from "vitest";
import { renderCollapsedCallout } from "./collapsed-callout";

describe("renderCollapsedCallout", () => {
    it("quotes every line and keeps blank lines inside the callout", () => {
        expect(
            renderCollapsedCallout("nexus_canvas", "Doc", "# T\n\nbody")
        ).toBe(">[!nexus_canvas]- **Doc**\n> # T\n>\n> body");
    });

    it("wraps the content in a plain fence", () => {
        expect(
            renderCollapsedCallout("nexus_canvas", "Slides", "a", {
                fence: true,
            })
        ).toBe(">[!nexus_canvas]- **Slides**\n> ```\n> a\n> ```");
    });

    it("tags the fence with a language", () => {
        expect(
            renderCollapsedCallout("nexus_artifact", "x.py", "print(1)", {
                fence: "python",
            })
        ).toBe(">[!nexus_artifact]- **x.py**\n> ```python\n> print(1)\n> ```");
    });
});
