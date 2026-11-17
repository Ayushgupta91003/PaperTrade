# Build PaperTrade with GitHub Copilot

Copy this entire folder to your company laptop, keeping the hidden .github folder. Give it the name PaperTrade and open that folder directly in VS Code. The supplied data/ folder is the same snapshot used by the reference build. Start with a folder containing this kit rather than an older application checkout.

## Run the phases

In Copilot Chat, select each named custom agent from the agent picker and paste the exact message below. If typing @ shows the named custom agent in your editor, select the suggestion and append the same message. If @ only shows built-in participants, use the agent picker. If discovery fails, open **Chat: Open Customizations** and confirm that the agent appears under Agents in the workspace.

| Phase | Select this agent | Paste this message |
|---|---|---|
| 1 | PaperTrade Requirements | Run your PaperTrade phase from the repository files. |
| 2 | PaperTrade Design | Run your PaperTrade phase from the repository files. |
| 3 | PaperTrade Tasks | Run your PaperTrade phase from the repository files. |
| 4 | PaperTrade Build Plan | Run your PaperTrade phase from the repository files. |
| 5 | PaperTrade Backend | Run your PaperTrade phase from the repository files. |
| 6 | PaperTrade UI | Run your PaperTrade phase from the repository files. |
| 7 | PaperTrade Tests | Run your PaperTrade phase from the repository files. |
| 8 | PaperTrade Security | Run your PaperTrade phase from the repository files. |
| 9 | PaperTrade PR Review | Run your PaperTrade phase from the repository files. |

Send one message per phase. Check the phase result before selecting the next agent. Keep context small by starting a fresh chat at phase boundaries when helpful. The agents read the shared spec and saved phase output. Do not paste CSV contents or ask for the whole codebase in chat.

## Run and verify

After backend and UI phases, open a PowerShell terminal in the project root.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000 in Edge and follow ACCEPTANCE.md. Package installation must work on the office laptop. The built app reads local files at runtime. UI styling may vary. The feature list, data and exact replay results define parity.

[VS Code custom agents](https://code.visualstudio.com/docs/agent-customization/custom-agents)
