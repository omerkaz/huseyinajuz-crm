// Render every email template through the branded shell into standalone HTML
// files, so the design can be reviewed in a browser without sending anything.
//
// Run: node --experimental-strip-types scripts/render-email-previews.ts [outDir]
// Default outDir: /tmp/email-previews
//
// Two files per template: `<key>.html` (light) and `<key>.dark.html`, the latter
// with the prefers-color-scheme query forced on so the dark palette renders in a
// normal browser window. No network, no Supabase, no sending.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { EMAIL_TEMPLATES } from "../src/lib/emailTemplates.ts";
import { buildPlainText, wrapEmailHtml } from "../supabase/functions/send-email/emailTemplate.ts";

const outDir = process.argv[2] ?? "/tmp/email-previews";
const SAMPLE_NAME = "Ada";

/** Force the dark-mode rules on for a browser that is in light mode. */
function forceDark(html: string): string {
  return html.replace("@media (prefers-color-scheme: dark) {", "@media all {");
}

mkdirSync(outDir, { recursive: true });

const rows: string[] = [];

for (const template of EMAIL_TEMPLATES) {
  const fragment = template.buildHtml(SAMPLE_NAME);
  const light = wrapEmailHtml(fragment, { title: template.subject });
  const dark = forceDark(light);
  const text = buildPlainText(undefined, fragment);

  writeFileSync(join(outDir, `${template.key}.html`), light, "utf8");
  writeFileSync(join(outDir, `${template.key}.dark.html`), dark, "utf8");
  writeFileSync(join(outDir, `${template.key}.txt`), text, "utf8");

  rows.push(
    `<tr><td>${template.label}</td><td>${template.subject}</td>` +
      `<td><a href="./${template.key}.html">light</a></td>` +
      `<td><a href="./${template.key}.dark.html">dark</a></td>` +
      `<td><a href="./${template.key}.txt">text</a></td>` +
      `<td>${light.length.toLocaleString("en-US")} B</td></tr>`,
  );
  console.log(`${template.key}: ${light.length} bytes html, ${text.length} bytes text`);
}

writeFileSync(
  join(outDir, "index.html"),
  `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Email previews</title>
<style>body{font:15px/1.6 -apple-system,system-ui,sans-serif;background:#FAF6F1;color:#2D2A26;padding:40px}
h1{font-family:Georgia,serif;font-weight:400}table{border-collapse:collapse}td,th{padding:8px 14px;border-bottom:1px solid #EDE4D8;text-align:left}
a{color:#2A9D8F}</style></head><body>
<h1>Hüseyin Ajuz — email design system previews</h1>
<p>Rendered ${new Date().toISOString().slice(0, 10)} from the send-email branded shell.</p>
<table><tr><th>Template</th><th>Subject</th><th></th><th></th><th></th><th>Size</th></tr>
${rows.join("\n")}
</table></body></html>`,
  "utf8",
);

console.log(`\nWrote ${EMAIL_TEMPLATES.length * 3 + 1} files to ${outDir}`);
