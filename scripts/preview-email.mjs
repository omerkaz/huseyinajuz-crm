#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// preview-email.mjs — Render the Phase 16 branded email shell locally
//
// Writes one HTML file per email feature (plus an index) so the layout can be
// eyeballed in a browser and pasted into a real-client render check (Gmail,
// Apple Mail, Outlook) BEFORE deploying send-email.
//
// Usage:
//   node --experimental-strip-types scripts/preview-email.mjs [outDir]
//
// Default outDir: /tmp/ajuz-email-preview
// ──────────────────────────────────────────────────────────────────────────────

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildPlainText, wrapEmailHtml } from "../supabase/functions/send-email/emailTemplate.ts";

// Same copy the 7 producers send (src/lib/email.ts + pg_cron functions in schema.sql).
const FEATURES = [
  {
    key: "welcome_email",
    subject: "Welcome — Hüseyin Ajuz Hair Loss Consultation",
    html: "<p>Dear Ada,</p><p>Thank you for registering with Hüseyin Ajuz. We will be in touch shortly to guide you through your personalised hair loss treatment journey.</p>",
  },
  {
    key: "blood_test_reminder",
    subject: "Blood Test Reminder",
    html: "<p>Dear Ada,</p><p>Please arrange your blood test at your earliest convenience. Your results are an important part of your personalised treatment plan.</p>",
  },
  {
    key: "week_6_checkin",
    subject: "Week 6 Check-in",
    html: "<p>Dear Ada,</p><p>Your 6-week check-in is due. Please reach out so we can review your progress and adjust your treatment plan if needed.</p>",
  },
  {
    key: "end_review",
    subject: "End Review",
    html: "<p>Dear Ada,</p><p>Your treatment end review is approaching. Please get in touch to schedule your final consultation and discuss next steps.</p>",
  },
  {
    key: "lead_day3",
    subject: "Following up on your hair loss enquiry",
    html: "<p>Hi Ada,</p><p>I wanted to follow up on your interest in our hair loss consultation programme. I'd love to help you understand what's causing your hair loss and put together a personalised plan for you.</p><p>Feel free to reply to this email or reach out via WhatsApp to book a slot.</p>",
  },
  {
    key: "lead_day7",
    subject: "Still thinking it over?",
    html: "<p>Hi Ada,</p><p>A week has passed since you first reached out. Hair loss can be tricky to address without the right guidance — that's exactly what we specialise in.</p><p>If you have any questions before booking, just hit reply. I'm happy to chat.</p>",
  },
  {
    key: "lead_day12",
    subject: "One last note from me",
    html: "<p>Hi Ada,</p><p>This is my final follow-up. I don't want to overwhelm your inbox — but I did want to make sure you hadn't missed us.</p><p>If you're still interested in understanding and tackling your hair loss, I'd love to help. Just reply and we'll take it from there.</p>",
  },
];

const outDir = resolve(process.argv[2] ?? "/tmp/ajuz-email-preview");
await mkdir(outDir, { recursive: true });

const rows = [];

for (const feature of FEATURES) {
  const html = wrapEmailHtml(feature.html, { title: feature.subject });
  const text = buildPlainText(undefined, feature.html);

  await writeFile(resolve(outDir, `${feature.key}.html`), html, "utf8");
  await writeFile(resolve(outDir, `${feature.key}.txt`), text, "utf8");

  rows.push(
    `<li><a href="./${feature.key}.html">${feature.key}</a> — ${feature.subject} ` +
      `(<a href="./${feature.key}.txt">text</a>, ${html.length} bytes)</li>`,
  );
  console.log(`${feature.key.padEnd(22)} html ${String(html.length).padStart(6)} B   text ${String(text.length).padStart(4)} B`);
}

await writeFile(
  resolve(outDir, "index.html"),
  `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Ajuz email previews</title>
<style>body{font:15px/1.6 -apple-system,system-ui,sans-serif;background:#FAF6F1;color:#2D2A26;padding:2rem}
a{color:#2A9D8F}li{margin:.4rem 0}</style></head>
<body><h1>Email previews — Phase 16 shell</h1><ul>${rows.join("")}</ul></body></html>`,
  "utf8",
);

console.log(`\nPreviews written to ${outDir}\nOpen: ${resolve(outDir, "index.html")}`);
