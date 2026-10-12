# GitHub Markdown compatibility

MarkText uses Muya for editing and Markdown import, `marked` for HTML, and the same document styles for the editor, HTML, PDF and printing. A GitHub theme selects presentation; it is not a parser switch. GitHub extensions now work with every document theme.

## Supported features

| Feature | Editing and saved Markdown | HTML / PDF / print |
| --- | --- | --- |
| Headings, emphasis, nested lists, quotes, code, links, images, breaks | Supported | Supported |
| GFM tables, task lists, strikethrough and URL/email autolinks | Supported | Supported |
| NOTE, TIP, IMPORTANT, WARNING, CAUTION alerts | Colored border, icon and title; original marker appears at the caret | GitHub alert layout, including lists and reference links |
| Footnotes with repeated references and backlinks | Enabled by default | Numbered references and a footnote section |
| `$...$`, `$` + backtick math, `$$` and `math` fences | Enabled by default | KaTeX with embedded fonts |
| Mermaid fences | Existing diagram preview | Embedded diagram |
| GeoJSON / TopoJSON fences | Offline longitude/latitude geometry map, pan and zoom | Static SVG snapshot |
| ASCII STL fences | Rotate by dragging or arrow keys; double-click toggles wireframe | Static SVG model |
| `<details>` / `<summary>` with nested Markdown | One source block, clickable disclosure | Native HTML disclosure |
| Safe HTML, `<sub>`, `<sup>`, `<ins>`, `<kbd>`, `<picture>` and custom anchors | Preserved and previewed | Sanitized HTML |
| Emoji shortcodes and HTML comments | Emoji preview; source preserved | Emoji rendering; comments hidden |
| HEX / RGB / HSL code colors | Validated swatches | Validated swatches |
| `@user`, `@org/team`, `owner/repo#123` | Clickable GitHub links; source preserved | GitHub links |
| Relative links, images, heading links and outline | Existing local-file navigation and outline | Heading IDs and resolved file links |

The GFM specification and GitHub.com are different scopes. GitHub performs additional rendering and sanitization, and has features tied to repository/account data. MarkText preserves repository-local references such as `#123` and bare commit hashes as text because a standalone file has no unambiguous GitHub repository. Use explicit `owner/repo#123` or a full URL. Mentions link to profiles and teams; they do not send notifications. Issue states, closing keywords, uploaded assets, custom autolinks and code-snippet embeds remain GitHub platform operations.

Maps render the geometry from the document without fetching geographic tiles; they do not reproduce GitHub's online basemap. SVG exports preserve the current initial view, with no JavaScript or map interaction in saved HTML/PDF. STL supports ASCII models in Markdown, as documented by GitHub, rather than binary STL bytes. Geometry source is limited to 2 MB, 100,000 points and 32 levels of nesting to keep the editor responsive. Invalid source stays editable; HTML export shows the source as escaped text.

Existing explicit preferences remain respected. On a new profile, footnotes and GitHub math are enabled and soft newlines follow `.md` file semantics (a space). Older profiles can enable these in **Preferences → Markdown**. GitHub uses MathJax; MarkText retains its existing KaTeX engine, so MathJax-only macros are not guaranteed.

## Verification and build

`packages/muya/src/state/__tests__/githubMarkdown.spec.ts` covers alerts, source preservation, option defaults, sanitization, disclosures, geometry and references. `packages/desktop/test/e2e/github-markdown.spec.ts` exercises the real Electron editor and source-mode round trips. The existing CommonMark/GFM fixture suites guard against regressions; `test/spec/expected-failures.json` records pre-existing parser edge cases, so this is feature coverage, not a claim of 100% specification conformance.

The Windows preview workflow builds one `win32-x64` target with the NSIS installer and unpack-and-run ZIP. It records the source commit and SHA-256 checksums alongside the artifacts. It runs on a develop commit containing `[windows-build]` or manual dispatch; it does not publish a release.

## Official references

- [GitHub Flavored Markdown specification](https://github.github.com/gfm/)
- [Basic writing and formatting, footnotes and alerts](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)
- [Math syntax](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/writing-mathematical-expressions)
- [Mermaid, GeoJSON, TopoJSON and STL diagrams](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams)
- [Collapsed sections](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-collapsed-sections)
- [Autolinked references](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/autolinked-references-and-urls)
