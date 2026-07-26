// Shared Notion API helpers for the ajuz-crm-board skill CLIs (board.js, docs.js).
// Zero deps — uses global fetch (Node 18+). Token: NOTION_API_KEY env or ~/.secrets.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const API = "https://api.notion.com/v1";

export function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function getToken() {
  if (process.env.NOTION_API_KEY) return process.env.NOTION_API_KEY;
  try {
    const secrets = readFileSync(join(homedir(), ".secrets"), "utf8");
    const m = secrets.match(/NOTION_API_KEY="?([^"\n]+)"?/);
    if (m) return m[1];
  } catch {
    /* fall through */
  }
  fail("NOTION_API_KEY not found in env or ~/.secrets");
}

export async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) fail(`${res.status} ${json.code}: ${json.message}`);
  return json;
}

export const rt = (text) => [{ type: "text", text: { content: text } }];

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[++i] ?? "";
    else args._.push(argv[i]);
  }
  return args;
}

/** Fetch every page in a database, following pagination. */
export async function queryAll(databaseId) {
  const pages = [];
  let cursor;
  do {
    const res = await api("POST", `/databases/${databaseId}/query`, {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

/** Title extractor for a database whose title property is `prop`. */
export const makeTitleOf = (prop) => (page) =>
  page.properties[prop].title.map((t) => t.plain_text).join("") || "(untitled)";

/** Case-insensitive substring match on title; fails loudly on 0 or >1 matches. */
export async function findByTitle(databaseId, titleOf, query, noun) {
  const pages = await queryAll(databaseId);
  const q = query.toLowerCase();
  const matches = pages.filter((p) => titleOf(p).toLowerCase().includes(q));
  if (matches.length === 0) fail(`no ${noun} matches "${query}"`);
  if (matches.length > 1)
    fail(`ambiguous "${query}" — matches: ${matches.map(titleOf).join(" | ")}`);
  return matches[0];
}

/**
 * Convert plain text into Notion blocks, one block per line.
 * Line prefixes: "# " / "## " / "### " → headings, "- " or "• " → bullet,
 * "[ ] " / "[x] " → to-do. Blank lines are skipped. Everything else → paragraph.
 */
export function bodyToBlocks(body) {
  const block = (type, text, extra = {}) => ({
    object: "block",
    type,
    [type]: { rich_text: rt(text), ...extra },
  });
  return body
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      if (line.startsWith("### ")) return block("heading_3", line.slice(4));
      if (line.startsWith("## ")) return block("heading_2", line.slice(3));
      if (line.startsWith("# ")) return block("heading_1", line.slice(2));
      if (line.startsWith("- ")) return block("bulleted_list_item", line.slice(2));
      if (line.startsWith("• ")) return block("bulleted_list_item", line.slice(2));
      if (line.startsWith("[ ] ")) return block("to_do", line.slice(4), { checked: false });
      if (line.startsWith("[x] ")) return block("to_do", line.slice(4), { checked: true });
      return block("paragraph", line);
    });
}

/** Print a page's child blocks as readable plain text. */
export async function printBody(pageId) {
  const blocks = await api("GET", `/blocks/${pageId}/children?page_size=100`);
  for (const b of blocks.results) {
    const content = b[b.type]?.rich_text?.map((t) => t.plain_text).join("") ?? "";
    const prefix =
      b.type === "to_do" ? (b.to_do.checked ? "[x] " : "[ ] ") :
      b.type === "bulleted_list_item" ? "• " :
      b.type === "numbered_list_item" ? "1. " :
      b.type.startsWith("heading") ? "## " : "";
    if (content) console.log(prefix + content);
  }
}
