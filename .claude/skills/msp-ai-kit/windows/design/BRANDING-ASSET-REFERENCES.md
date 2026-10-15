# DE Tech Tool background and branding references

Joe supplied eight visible image references after the main-window mockup on 2026-10-11. This catalog preserves their visual direction for the UI implementation. Read with `MAIN-WINDOW-REFERENCE.md`.

## Binary asset status

The images were visually inspected in chat. Original JPG/JFIF binaries are NOT committed: workspace offline; available GitHub file writing is UTF-8 text and cannot retrieve chat attachment bytes or Joe's C: files. This catalog must not be represented as a completed image import. Preserve originals unchanged when file access is restored, record their hashes/dimensions, and compare against the references before integrating them. Do not generate replacements.

Joe's supplied filenames: `image (7).jpg`, `image (6).jpg`, `image (5).jpg`, `image (4).jpg`, `image (3).jpg`, `image (2).jpg`, `image (1).jpg`, `image.jpg`, under `C:/Users/Joe/Downloads/DE Tech Tool/`.

Additional upload identifiers (not browser URLs or usable repository links):
- `144dffe0-18e4-4354-bcb3-c66533a296dd.jfif`: sediment://file_00000000addc81fdbb48450a0862216b
- `b149a24f-a02f-43df-878e-9bce2bb6dbfa.jfif`: sediment://file_00000000dac481fd847e202fd344b2ec
- `03b83b7e-f918-4570-9ef0-cdbfd14e62d5.jfif`: sediment://file_00000000f34881fdac3493c889b59c03
- `277ccd76-42c9-4771-bbbb-5aac6e488371.jfif`: sediment://file_000000009c2881fd98885db92ea8caba

Exact mapping between displayed images, JPG names and JFIF pointers is unverified. Use visual verification rather than assume correspondence.

## Visual catalog in displayed order

| Reference | Appearance | Intended candidate use | Suggested repository name after verified import |
| --- | --- | --- | --- |
| 01 | Angular layered black armor, cracked metal, carbon-fiber inserts and glowing red seams | Alternative shell/background texture | armor-red.jpg |
| 02 | Dense dark circuit-board traces, carbon-fiber panels, red nodes and thin illuminated paths | Preferred dashboard shell texture candidate | circuitry-red.jpg |
| 03 | Broad diagonal black panels, hex texture, carbon fiber and branching red cracks | Alternative background with larger visual shapes | fractured-carbon-red.jpg |
| 04 | Tall angular metallic DE monogram, red illuminated inner edges, black background | Alternative splash/branding mark | de-angular-monogram.jpg |
| 05 | Large dark DE wordmark over red circuitry and carbon texture | Splash or branding preview | de-circuit-wordmark.jpg |
| 06 | Wide DE TECH TOOL lettering in red and silver distressed metal over circuit texture | Splash/title artwork | de-tech-tool-wordmark.jpg |
| 07 | Tall metallic DE shield with fine red circuit traces on black | Shield logo candidate for splash/sidebar | de-circuit-shield.jpg |
| 08 | Tall silver/red angular DE emblem with TECH TOOL lettering over carbon/circuit background | Alternative splash artwork | de-tech-tool-emblem.jpg |

Suggested import folder: `design/assets/`. These suggested filenames are not claims that those files exist.

## Application guidance

Keep the operations-dashboard composition from the main-window mockup. Use these textures as restrained decoration behind opaque or nearly opaque panels so telemetry, forms and tables remain readable. Favor reference 02 for an initial shell trial; reference 01 and 03 are alternatives, not automatic rotating backgrounds. The supplied logo variants remain options; no final selection was stated.

Retain functional controls, text labels, keyboard focus, scaling and existing safety/evidence flows. Do not flatten live controls into artwork. Use large distressed wordmarks on splash/about surfaces; use a legible simplified mark at small sidebar/icon sizes only after a verified asset/derivative exists. JPG black backgrounds are not transparent cutouts. Cropping, transparency edits or newly generated derivatives require separate implementation and visual review; preserve originals.

Do not auto-apply these images as users' Windows wallpaper or lock screen: the current request is to place design references in the repository for the Tech Tool UI. Existing client branding policies remain authoritative.

Next steps: import original main-window PNG and this image set, verify filename mapping, select a logo/background with Joe or retain configurable candidates, build shared WPF theme resources, and inspect actual populated pages at multiple Windows scales. Documentation-only; no new runtime functionality or visual tests are claimed.
