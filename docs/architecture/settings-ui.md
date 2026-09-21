# Settings UI

How the settings tab is built, and how to add a setting. User-facing behaviour is
in [Settings](../user/settings.md).

## One description, two renderers

Obsidian 1.13 added a declarative settings API: a tab returns
`getSettingDefinitions()`, and Obsidian renders it and indexes it for the settings
search. Before 1.13 a tab renders itself imperatively in `display()`, which 1.13
deprecates and never calls once definitions exist. The plugin supports 1.6.6 and up,
so it has both, fed by a single description of each row:

| Piece | File |
|---|---|
| The tab: `getSettingDefinitions()` for 1.13+, `display()` for older versions | [`settings-tab.ts`](../../src/ui/settings-tab.ts) |
| `SectionRow`, and the two renderers built from it | [`base-settings-section.ts`](../../src/ui/settings/base-settings-section.ts) |
| Grouping sections into headed groups | [`setting-groups.ts`](../../src/ui/settings/setting-groups.ts) |
| Name and controls on one row, description full width | [`full-width-description.ts`](../../src/ui/settings/full-width-description.ts) |

A section extends `BaseSettingsSection` and returns its rows from `rows()`. A row
carries what Obsidian needs to show and find it (`name`, `desc`, `aliases`), an
optional `visible()` predicate, and `render(setting)`, which adds the controls. The
setting passed to `render` already has its name and description on both paths.

- **Before 1.13**, `render()` on the base class creates a `Setting` per visible row.
- **On 1.13+**, `getDefinitions()` turns each row into a render-type definition and
  the tab wraps them in groups.

Each section with a `title` becomes a headed group; a section without one (the
message timestamp settings) continues the group above it.

## Showing and hiding rows

A control that shows or hides another (the date prefix format, the timestamp format
row) calls `redraw()`. The tab then re-evaluates each row's `visible()` in place on
1.13+ (`refreshDomState()`), and re-renders on older versions with the scroll
position kept. Prefer hiding an element that stays in the row over re-rendering.

## Search

Obsidian searches each definition's `name`, `desc` and `aliases`. Give a row
`aliases` for the terms a user would type that its text does not contain (`uid`,
`yaml` and `frontmatter` for the custom ID property; `directory` for folders), and
`searchable: false` to a row that is not a setting, such as the support box.

## Constraints worth knowing

- `getSettingDefinitions()` is also called once when the tab is added, to build the
  search index: it must not depend on the DOM or have side effects.
- `refreshDomState()` only exists on 1.13+, so it is feature-detected rather than
  called directly. The lint rules forbid disabling `no-unsupported-api` and
  `no-deprecated`, and the code does not need to.
- `hide()` is still called when the tab closes on both paths; a section that commits
  input on blur uses it to commit what was typed before the field disappears.
