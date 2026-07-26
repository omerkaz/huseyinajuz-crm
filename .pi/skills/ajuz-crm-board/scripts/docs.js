#!/usr/bin/env node
// Notion Document Hub CLI for the Hüseyin Ajuz CRM workspace.
// Reference docs (account info, credentials pointers, research, plans).
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

const DATABASE_ID = "39aeb459-1241-8062-afec-e7c923b5964c";
const KNOWN_CATEGORIES = ["Proposal", "Customer research", "Strategy doc", "Planning"];

const titleOf = makeTitleOf("Doc name");
const categoriesOf = (page) =>
  page.properties.Category.multi_select.map((c) => c.name);
const findDoc = (query) => findByTitle(DATABASE_ID, titleOf, query, "doc");

const parseCategories = (raw) =>
  (raw ?? "").split(",").map((c) => c.trim()).filter(Boolean);

async function cmdList(args) {
  const pages = await queryAll(DATABASE_ID);
  pages.sort((a, b) => (a.last_edited_time < b.last_edited_time ? 1 : -1));
  const filter = args.category?.toLowerCase();
  let shown = 0;
  for (const p of pages) {
    const cats = categoriesOf(p);
    if (filter && !cats.some((c) => c.toLowerCase().includes(filter))) continue;
    const date = p.last_edited_time.slice(0, 10);
    console.log(`  - ${titleOf(p)}  [${cats.join(", ") || "—"}]  (edited ${date})`);
    shown++;
  }
  console.log(`${shown} doc(s)${filter ? ` matching category "${args.category}"` : ""}`);
}

async function cmdShow(args) {
  const [query] = args._;
  if (!query) fail("usage: docs.js show <name-query>");
  const doc = await findDoc(query);
  console.log(`Title:     ${titleOf(doc)}`);
  console.log(`Category:  ${categoriesOf(doc).join(", ") || "—"}`);
  console.log(`Edited:    ${doc.last_edited_time.slice(0, 10)}`);
  console.log(`URL:       ${doc.url}`);
  console.log("--- body ---");
  await printBody(doc.id);
}

async function cmdAdd(args) {
  const [name] = args._;
  if (!name) fail('usage: docs.js add "Doc name" [--category a,b] [--body "text"]');
  const categories = parseCategories(args.category);
  const page = await api("POST", "/pages", {
    parent: { database_id: DATABASE_ID },
    properties: {
      "Doc name": { title: rt(name) },
      Category: { multi_select: categories.map((c) => ({ name: c })) },
    },
    children: args.body ? bodyToBlocks(args.body) : [],
  });
  console.log(`created: ${name}${categories.length ? ` [${categories.join(", ")}]` : ""}\n${page.url}`);
}

async function cmdAppend(args) {
  const [query] = args._;
  if (!query || !args.body) fail('usage: docs.js append <name-query> --body "text"');
  const doc = await findDoc(query);
  await api("PATCH", `/blocks/${doc.id}/children`, { children: bodyToBlocks(args.body) });
  console.log(`appended to: ${titleOf(doc)}`);
}

async function cmdTag(args) {
  const [query] = args._;
  if (!query || args.category === undefined)
    fail('usage: docs.js tag <name-query> --category a,b  (replaces categories; "" clears)');
  const doc = await findDoc(query);
  const categories = parseCategories(args.category);
  await api("PATCH", `/pages/${doc.id}`, {
    properties: { Category: { multi_select: categories.map((c) => ({ name: c })) } },
  });
  console.log(`tagged: ${titleOf(doc)} → [${categories.join(", ") || "—"}]`);
}

async function cmdArchive(args) {
  const [query] = args._;
  if (!query) fail("usage: docs.js archive <name-query>");
  const doc = await findDoc(query);
  await api("PATCH", `/pages/${doc.id}`, { archived: true });
  console.log(`archived: ${titleOf(doc)} (recoverable from Notion Trash)`);
}

const commands = { list: cmdList, show: cmdShow, add: cmdAdd, append: cmdAppend, tag: cmdTag, archive: cmdArchive };

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || !commands[cmd]) {
  console.log(`Notion Document Hub CLI — commands:
  list [--category Planning]                    List docs (newest first)
  show <name-query>                             Show one doc's props + body
  add "Doc name" [--category a,b]               Create a doc
      [--body "text"]
  append <name-query> --body "text"             Append text to a doc
  tag <name-query> --category a,b               Replace a doc's categories
  archive <name-query>                          Archive a doc (reversible)

Body text: one block per line — "## " heading, "- " bullet, "[ ] " to-do.
Known categories: ${KNOWN_CATEGORIES.join(" | ")} (new ones auto-created)`);
  process.exit(cmd ? 1 : 0);
}
await commands[cmd](parseArgs(rest));
