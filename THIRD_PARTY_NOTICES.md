# Third-Party Notices

This project is licensed under MIT for the project source code. Bundled binary
assets may have separate license terms and must be reviewed before a public
release.

## Bundled Assets

| Asset                        | Path                                                 | Current status                                                                                     | Required before public release                                                                                                |
| ---------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| CodeNexus app artwork        | `CodeNexus.png`, `build/icon.ico`                    | Project artwork; `build/icon.ico` is generated from `CodeNexus.png` by `scripts/gen-win-icon.mjs`. | Confirm the artwork is original or has redistribution rights.                                                                 |
| Source Han Sans SC fonts     | `src/renderer/assets/fonts/source-han-sans-sc/*.otf` | Bundled without upstream license text in this repository.                                          | Add the upstream font license file and attribution, or remove/replace the font files.                                         |
| Alibaba PuHuiTi fonts        | `src/renderer/assets/fonts/alibaba-puhuiti/*.otf`    | Bundled without upstream license text in this repository.                                          | Add the upstream font license file and attribution, or remove/replace the font files.                                         |
| Built-in notification sounds | `music/*.mp3`                                        | Bundled without source and redistribution documentation.                                           | Replace with clearly licensed audio assets, remove built-in sounds, or add written redistribution permission and attribution. |

## Release Rule

Do not publish a public source release or binary release until every bundled
asset above has a documented license source. If an asset cannot be verified,
remove it from the repository and from `electron-builder.yml` packaging.
