# DE Tech Tool main-window visual reference

Joe supplied `main-window-mockup.png` on 2026-10-11 and requested that it be added to the repository as the visual basis for future UI work. Source on Joe's computer: `C:/Users/Joe/Downloads/DE Tech Tool/main-window-mockup.png`. Original dimensions reported by chat: 3200 x 1920; displayed preview: 2048 x 1229.

## Asset status

The image was visually inspected in chat. Its original binary is NOT committed: the execution workspace was offline and the available GitHub text-file connector cannot retrieve the chat image bytes or Joe's local Windows file. Next implementer must copy the original unchanged to `design/main-window-mockup.png` alongside this document. Do not substitute a regenerated image or claim the asset is present before verifying it.

## Visual direction

- Dark near-black operations console, subtle carbon/mesh texture, white high-contrast text, red primary accent and narrow red borders.
- Wide desktop layout, custom-looking title bar with DE shield and `DE TECH TOOL // OPS CONSOLE`; standard minimize, maximize and close controls.
- Persistent left rail about 15.5% of window width: DE TECH / INTERNAL OPS identity, module navigation and operator/session card at bottom.
- Navigation reference: Dashboard, Endpoints, Tickets, Scans, Patching, Alerts, Scripts, Reports, Settings. Selected item has red left border and subdued red background. Preserve access to existing modules including Storage & cleanup, identity, rescue, Microsoft administration and evidence; these mockup labels do not authorize removing capabilities.
- Top content row: endpoint/user/ticket search with Ctrl+K hint, status badge, Deploy Patch secondary action and Run Scan red primary action.
- Operations Dashboard title and a clearly labeled sample-data/last-sync subtitle.
- Four summary cards: endpoints managed, active alerts, patch compliance, open tickets. Each combines large number, small trend caption and compact bar sparkline.
- Middle row: wide threat/event chart on left, live event stream on right. Cyan event line/area, red threat line/area, restrained grid, labeled time axis and critical-spike callout.
- Bottom content panel: endpoint table with host, user, status, patch level, last seen, site and Open action.
- Panels have thin slate borders, clipped/chamfered corners and short red top-edge accents. Consistent spacing, uppercase tracked headings and compact monospace telemetry/table text.
- Status palette: green healthy, amber warning, red critical, cyan informational. Keep written status labels; color alone is insufficient.
- Footer: agent-link state left, sample-data/UI-preview indicator center and product/version context right.

Approximate palette inferred visually, not sampled from original pixels: background #090C12; panel #10141D; border #2B3342; primary #FF2046; information #00D8F0; healthy #00ED89; warning #F5AA10; primary text #F4F6FA; secondary text #929BAD.

## Implementation rules and next steps

1. Commit and verify the original PNG before pixel-level comparisons.
2. Map the visual shell onto the existing Windows WPF console; retain async jobs, licensing, integrity, client/technician context, evidence and destructive-action guards.
3. Create shared styles for navigation, panels, buttons, inputs, badges and tables; avoid replacing the working tool with a static screenshot.
4. Treat all mockup numbers, endpoint names, tickets, sync time, version 3.2.0 and agent-link/nominal statuses as sample content. Show real telemetry only when available; otherwise use explicit empty/disconnected/sample states.
5. Inventory integration dependencies before adding fleet search, ticketing, patch deployment or live agent activity. Visual controls do not establish working backend integrations.
6. Add Storage & cleanup to the resulting navigation and apply the same panel/typography language to drive recommendations, reviewed cleanup and verified relocation.
7. Validate keyboard navigation, visible focus, readable contrast, resizing, scrolling and Windows scaling at 100%, 125%, 150% and 200%. Inspect populated, loading, empty, error and disconnected states. Keep standard window behavior usable.
8. Capture actual WPF screenshots for comparison. Current storage CI results predate this future visual implementation; this documentation-only commit does not implement or validate the redesign.

Related work: draft PR #580; `../STORAGE.md` for complete inventory; `../STORAGE-HANDOFF.md` for storage implementation handoff.
