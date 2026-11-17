# Copilot build guide

Copy .github/, docs/SPEC.md, this guide and the complete data/ directory into an empty PaperTrade repository. Open that repository in VS Code. Select each matching custom agent in Copilot Chat and send the single prompt shown below. Review each result before starting the next phase. Keep chat output brief and reference existing files instead of pasting them. Use a fresh conversation between phases if context grows.

| Agent | Prompt |
|---|---|
| Requirements | Read docs/SPEC.md and write docs/REQUIREMENTS.md. |
| Plan and design | Read docs/SPEC.md and docs/REQUIREMENTS.md. Write docs/DESIGN.md. |
| Epics and tasks | Use docs/DESIGN.md and write docs/TASKS.md with owners and checks. |
| Build orchestration | Read docs/TASKS.md, check prerequisites and write docs/HANDOFF.md. |
| Backend development | Implement the backend from docs/SPEC.md and docs/DESIGN.md. Run a local API smoke check. |
| UI development | Implement the dashboard in web/ from docs/SPEC.md and the backend responses. |
| Automation testing | Test the cases in docs/SPEC.md and report observed results. |
| Security review | Review the app against the local-use scope and summarize verified findings. |
| PR review | Review the final diff and test evidence. Write a short merge-readiness summary. |

Use the same ten CSVs in both builds. Treat them as input files and read only headers plus a few rows when needed to conserve context. Verify the same replay dates, exact trade fills and cash totals, challenge finish, and dashboard structure. For appearance, provide a screenshot of this prototype to the UI agent if needed. Independent builds can differ in code and styling.

If updating an existing PaperTrade build, copy the replacement data/ and the current spec first. Use one UI phase prompt:

> From docs/SPEC.md, add the bounded calendar picker, wheel/button zoom, pan, and price/date lines with undo. Reuse the existing canvas and trading API. Run the focused replay and chart checks. Report only results and blockers.

