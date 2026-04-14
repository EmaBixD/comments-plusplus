# Changelog

All notable changes to the "Comments++" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - The Web Compatibility & Precision Update

### Added
- **Full Web Compatibility (`vscode.dev`, GitHub Codespaces):** Completely reworked the core engine to drop Node.js native dependencies (`path`, `fs`, `Buffer`), making the extension a 100% Universal Web Extension.
- **Support for 80+ Programming Languages:** Expanded the comment parser to support almost every language syntax available (e.g., `--` SQL/Haskell, `;;` Lisp, `<!--` HTML, `{-` Haskell, `REM` Batch, and more).
- **Click-to-Reveal in Sidebar:** Clicking directly on the tag icon of a comment in the editor instantly highlights the line and reveals that exact comment inside the Sidebar Tree View.

### Fixed
- **Regex Hardening (Zero False Positives):** Refined the parsing engine to completely ignore language operators and strings like `!`, `'`, `%`, `>`, preventing false matches.

## [0.0.1] - Initial Release

### Added
- **Customizable Highlighting:** Highlight `TODO`, `FIXME`, `NOTE`, `BUG`, `HACK`, `XXX` out of the box, or create custom tags via settings.
- **Dedicated Sidebar Explorer:** View and manage all your comments across the current file, open files, or the entire workspace.
- **Rich Metadata inside Brackets:** Assign multiple authors (`[@username]`), priorities (`[CRITICAL]`, `[HIGH]`, etc.), and multiple due dates (`[YYYY-MM-DD]`) effortlessly.
- **Image Previews on Hover:** Link local image paths or external URLs directly inside a comment to see the image natively scaled in a tooltip.
- **Advanced Filtering:** Filter workspace comments by Tags, Author, Date Range, Image presence, or search text.
- **Export Capabilities:** Generate Markdown (`.md`) or JSON reports of your filtered task lists to share with your team.
- **Universal Language Support:** Seamlessly works across virtually ALL programming languages that use block or line-level comments.
