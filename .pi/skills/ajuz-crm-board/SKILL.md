---
name: ajuz-crm-board
description: Manage the Hüseyin Ajuz CRM Notion workspace (this project only) — kanban board (list cards by column, create, move, append notes, archive) AND Document Hub (reference docs for accounts, research, plans). Use when asked to update the Notion board, sync planning state to Notion, track milestone/requirement cards, check the board, or create/read/update a doc in the Document Hub. Triggers - "notion", "kanban", "board", "move card", "add card", "document hub", "notion doc".
compatibility: Requires Node 18+ and NOTION_API_KEY (env or ~/.secrets). Project-specific — targets two hardcoded Notion databases.
---

# Notion Workspace (Hüseyin Ajuz CRM)

CLIs for the project's Notion workspace (**HuseyinAjuz-CRM**, integration **pi-agent**). Plain Notion REST API — no MCP. Two databases:

| Database | ID | CLI |
|---|---|---|
| Kanban board | `8b4eb459-1241-8394-8bba-81715aee14b6` | `scripts/board.js` |
| Document Hub | `39aeb459-1241-8062-afec-e7c923b5964c` | `scripts/docs.js` |

**Auth:** reads `NOTION_API_KEY` from env, falls back to `~/.secrets`. No setup needed if the token is saved there.

**Body text format** (both CLIs, `--body`): one block per line — `## ` heading (`#`/`###` also work), `- ` bullet, `[ ] ` / `[x] ` to-do, plain line = paragraph. Blank lines skipped.

## Kanban board

All commands run from the repo root:

```bash
node .pi/skills/ajuz-crm-board/scripts/board.js <command>
```

```bash
# List all cards grouped by column (or one column)
node .pi/skills/ajuz-crm-board/scripts/board.js list
node .pi/skills/ajuz-crm-board/scripts/board.js list --status "Not started"

# Show a card's properties + body (name matched by substring, must be unique)
node .pi/skills/ajuz-crm-board/scripts/board.js show "MAIL-01"

# Create a card
node .pi/skills/ajuz-crm-board/scripts/board.js add "MAIL-03: Bounce handling" \
  --status "Not started" --team Engineering --keywords "v1.2,Email" \
  --body "Handle Resend bounce webhooks."

# Move a card between columns
node .pi/skills/ajuz-crm-board/scripts/board.js move "MAIL-01" --status "In development"

# Append a progress note to a card body
node .pi/skills/ajuz-crm-board/scripts/board.js append "MAIL-01" --body "DNS records added, awaiting verification."

# Replace a card's keywords ("" clears)
node .pi/skills/ajuz-crm-board/scripts/board.js retag "MAIL-01" --keywords "v1.2,Email,Shipped"

# Archive a card (reversible via Notion Trash)
node .pi/skills/ajuz-crm-board/scripts/board.js archive "Chore: Wire ESLint"
```

### Board schema

| Property | Type | Values |
|---|---|---|
| Status (columns) | status | `Not started`, `In development`, `Testing`, `Reviewing`, `Done` |
| Team | select | `Engineering`, `Design` |
| AI keywords | multi_select | free-form tags: `v1.2`, `v1.3`, `Email`, `Chore`, `Shipped`, … |
| Deadline | date | unused so far |
| Assign | people | unused so far |

## Document Hub

Reference docs — account/service info (e.g. "Supabase account uses X email"), customer research, strategy, plans. Not for task tracking (that's the board).

```bash
node .pi/skills/ajuz-crm-board/scripts/docs.js <command>
```

```bash
# List docs, newest first (optionally filter by category substring)
node .pi/skills/ajuz-crm-board/scripts/docs.js list
node .pi/skills/ajuz-crm-board/scripts/docs.js list --category Planning

# Show a doc's properties + body
node .pi/skills/ajuz-crm-board/scripts/docs.js show "Supabase"

# Create a doc (multi-line body with headings/bullets)
node .pi/skills/ajuz-crm-board/scripts/docs.js add "Supabase" --body "## Account
The Supabase account was created with the trmn500@gmail.com email address."

# Append to a doc
node .pi/skills/ajuz-crm-board/scripts/docs.js append "Supabase" --body "- Project ref: hbhepcucokwlagqygwrz"

# Replace a doc's categories ("" clears)
node .pi/skills/ajuz-crm-board/scripts/docs.js tag "Supabase" --category "Strategy doc"

# Archive a doc (reversible via Notion Trash)
node .pi/skills/ajuz-crm-board/scripts/docs.js archive "Old notes"
```

### Document Hub schema

| Property | Type | Values |
|---|---|---|
| Doc name | title | — |
| Category | multi_select | `Proposal`, `Customer research`, `Strategy doc`, `Planning` (new ones auto-created) |

## Conventions

- **Card naming:** open work uses requirement IDs (`MAIL-01: …`, `CAL-01: …`); chores use `Chore: …`; shipped milestones are grouped cards (`v1.0 — …`) with requirement checklists in the body.
- **Board vs Hub:** tasks and milestones → board; durable reference info (accounts, services, research, decisions worth keeping outside the repo) → Document Hub.
- **Source of truth:** `.planning/` in-repo remains authoritative; the board mirrors it. When planning docs change milestone/requirement state, update the matching card (`move`, `append`).
- **Name matching:** `show`/`move`/`append`/`tag`/`archive` match by case-insensitive substring and fail loudly on ambiguity — use a unique fragment like the requirement ID.
- New multi_select values (keywords, categories) are auto-created by Notion; keep tags consistent with existing ones (run `list` first to see them).
- **Never store secrets/passwords in Notion docs** — account identifiers and pointers only.

## Architecture

```
scripts/
├── lib.js      # shared: auth, api(), pagination, title matching, body↔blocks
├── board.js    # kanban commands: list show add move append retag archive
└── docs.js     # Document Hub commands: list show add append tag archive
```
