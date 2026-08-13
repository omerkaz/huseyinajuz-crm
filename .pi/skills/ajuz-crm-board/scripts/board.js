#!/usr/bin/env node
// Notion kanban board CLI for the Hüseyin Ajuz CRM project board.
// Shared helpers live in lib.js. Token: NOTION_API_KEY env or ~/.secrets.

import {
  api,
  bodyToBlocks,
  fail,
  findByTitle,
  makeTitleOf,
  parseArgs,
  printBody,
  queryAll,
  rt,
} from "./lib.js";

const DATABASE_ID = "8b4eb459-1241-8394-8bba-81715aee14b6";
const STATUSES = ["Not started", "In development", "Testing", "Reviewing", "Done"];
const TEAMS = ["Engineering", "Design"];

const titleOf = makeTitleOf("Name");
const statusOf = (page) => page.properties.Status.status?.name ?? "?";
const findCard = (query) => findByTitle(DATABASE_ID, titleOf, query, "card");

function validateStatus(status) {
  if (!STATUSES.includes(status))
    fail(`invalid status "${status}" — use one of: ${STATUSES.join(" | ")}`);
}

async function cmdList(args) {
  const pages = await queryAll(DATABASE_ID);
  const byStatus = new Map(STATUSES.map((s) => [s, []]));
  for (const p of pages) {
    const s = statusOf(p);
    if (!byStatus.has(s)) byStatus.set(s, []);
    byStatus.get(s).push(p);
  }
  for (const [status, cards] of byStatus) {
    if (args.status && args.status !== status) continue;
    console.log(`== ${status} (${cards.length}) ==`);
    for (const c of cards) {
      const kw = c.properties["AI keywords"].multi_select.map((k) => k.name).join(", ");
      console.log(`  - ${titleOf(c)}${kw ? `  [${kw}]` : ""}`);
    }
  }
}

async function cmdShow(args) {
  const [query] = args._;
  if (!query) fail("usage: board.js show <name-query>");
  const card = await findCard(query);
  const props = card.properties;
  console.log(`Title:    ${titleOf(card)}`);
  console.log(`Status:   ${statusOf(card)}`);
  console.log(`Team:     ${props.Team.select?.name ?? "—"}`);
  console.log(`Keywords: ${props["AI keywords"].multi_select.map((k) => k.name).join(", ") || "—"}`);
  console.log(`URL:      ${card.url}`);
  console.log("--- body ---");
  await printBody(card.id);
}

async function cmdAdd(args) {
  const [name] = args._;
  if (!name) fail('usage: board.js add "Card name" [--status S] [--team T] [--keywords a,b] [--body "text"]');
  const status = args.status ?? "Not started";
  validateStatus(status);
  const team = args.team ?? "Engineering";
  if (!TEAMS.includes(team)) fail(`invalid team "${team}" — use: ${TEAMS.join(" | ")}`);
  const keywords = (args.keywords ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  const page = await api("POST", "/pages", {
    parent: { database_id: DATABASE_ID },
    properties: {
      Name: { title: rt(name) },
      Status: { status: { name: status } },
      Team: { select: { name: team } },
      "AI keywords": { multi_select: keywords.map((k) => ({ name: k })) },
    },
    children: args.body ? bodyToBlocks(args.body) : [],
  });
  console.log(`created: ${name} (${status})\n${page.url}`);
}

async function cmdMove(args) {
  const [query] = args._;
  if (!query || !args.status) fail('usage: board.js move <name-query> --status "In development"');
  validateStatus(args.status);
  const card = await findCard(query);
  await api("PATCH", `/pages/${card.id}`, {
    properties: { Status: { status: { name: args.status } } },
  });
  console.log(`moved: ${titleOf(card)} → ${args.status}`);
}

async function cmdAppend(args) {
  const [query] = args._;
  if (!query || !args.body) fail('usage: board.js append <name-query> --body "text"');
  const card = await findCard(query);
  await api("PATCH", `/blocks/${card.id}/children`, { children: bodyToBlocks(args.body) });
  console.log(`appended to: ${titleOf(card)}`);
}

async function cmdRetag(args) {
  const [query] = args._;
  if (!query || args.keywords === undefined)
    fail('usage: board.js retag <name-query> --keywords "a,b" ("" clears)');
  const card = await findCard(query);
  const keywords = args.keywords.split(",").map((k) => k.trim()).filter(Boolean);
  await api("PATCH", `/pages/${card.id}`, {
    properties: { "AI keywords": { multi_select: keywords.map((k) => ({ name: k })) } },
  });
  console.log(`retagged: ${titleOf(card)} [${keywords.join(", ") || "—"}]`);
}

async function cmdRename(args) {
  const [query] = args._;
  if (!query || !args.name) fail('usage: board.js rename <name-query> --name "New title"');
  const card = await findCard(query);
  const oldName = titleOf(card);
  await api("PATCH", `/pages/${card.id}`, {
    properties: { Name: { title: rt(args.name) } },
  });
  console.log(`renamed: ${oldName} → ${args.name}`);
}

async function cmdArchive(args) {
  const [query] = args._;
  if (!query) fail("usage: board.js archive <name-query>");
  const card = await findCard(query);
  await api("PATCH", `/pages/${card.id}`, { archived: true });
  console.log(`archived: ${titleOf(card)} (recoverable from Notion Trash)`);
}

const commands = { list: cmdList, show: cmdShow, add: cmdAdd, move: cmdMove, append: cmdAppend, retag: cmdRetag, rename: cmdRename, archive: cmdArchive };

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || !commands[cmd]) {
  console.log(`Notion board CLI — commands:
  list [--status "Not started"]                 List cards grouped by column
  show <name-query>                             Show one card's props + body
  add "Name" [--status S] [--team T]            Create a card
      [--keywords a,b] [--body "text"]
  move <name-query> --status "Done"             Move a card to a column
  append <name-query> --body "text"             Append text to a card
  retag <name-query> --keywords "a,b"           Replace a card's keywords ("" clears)
  rename <name-query> --name "New title"        Replace a card's title
  archive <name-query>                          Archive a card (reversible)

Body text: one block per line — "## " heading, "- " bullet, "[ ] " to-do.
Statuses: ${STATUSES.join(" | ")}
Teams: ${TEAMS.join(" | ")}`);
  process.exit(cmd ? 1 : 0);
}
await commands[cmd](parseArgs(rest));
