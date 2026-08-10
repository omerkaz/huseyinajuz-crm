// Unit tests for the Phase 16 email design system (MAIL-05).
// Run: node --experimental-strip-types --test (wired into `npm test`)

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EMAIL_TOKENS,
  FOOTER_TEXT,
  PRACTITIONER,
  WRAPPER_MARKER,
  appendTextFooter,
  buildPlainText,
  escapeHtml,
  htmlToPlainText,
  wrapEmailHtml,
} from "./emailTemplate.ts";

const FRAGMENT = "<p>Dear Ada,</p><p>Please arrange your blood test.</p>";

test("wrapEmailHtml produces a complete branded document", () => {
  const html = wrapEmailHtml(FRAGMENT);

  assert.ok(html.startsWith("<!DOCTYPE html>"), "starts with a doctype");
  assert.ok(html.includes(WRAPPER_MARKER), "carries the idempotency marker");
  assert.ok(html.includes(FRAGMENT), "content fragment survives verbatim");
  assert.ok(html.includes(PRACTITIONER.name), "header wordmark present");
  assert.ok(html.includes(`mailto:${PRACTITIONER.email}`), "footer contact link present");
  assert.ok(html.trimEnd().endsWith("</html>"), "document is closed");
});

test("wrapEmailHtml uses the email-safe design tokens", () => {
  const html = wrapEmailHtml(FRAGMENT);

  for (const token of [
    EMAIL_TOKENS.linen,
    EMAIL_TOKENS.cream,
    EMAIL_TOKENS.charcoal,
    EMAIL_TOKENS.teal,
    EMAIL_TOKENS.hairline,
  ]) {
    assert.ok(html.includes(token), `token ${token} applied`);
  }

  assert.ok(html.includes("Georgia"), "serif wordmark falls back to Georgia");
  assert.ok(html.includes("Arial"), "body copy falls back to Arial");
  assert.ok(!/DM Serif Display|Inter'/.test(html), "no webfonts that email clients cannot load");
});

test("wrapEmailHtml is Outlook-safe and mobile-responsive", () => {
  const html = wrapEmailHtml(FRAGMENT);

  assert.ok(html.includes('role="presentation"'), "layout tables are presentational");
  assert.ok(html.includes(`width="${EMAIL_TOKENS.cardWidth}"`), "fixed 600px card width attribute");
  assert.ok(html.includes("mso-table-lspace"), "Outlook table spacing reset");
  assert.ok(html.includes("mso-line-height-rule:exactly"), "Outlook line-height rule");
  assert.ok(html.includes("@media screen and (max-width:620px)"), "mobile media query");
  assert.ok(html.includes('name="viewport"'), "viewport meta present");
  assert.ok(!/<div[^>]*display:\s*flex/i.test(html), "no flex layout");
});

test("wrapEmailHtml declares dark mode without losing readable colours", () => {
  const html = wrapEmailHtml(FRAGMENT);

  assert.ok(html.includes('name="color-scheme" content="light dark"'), "color-scheme meta");
  assert.ok(html.includes('name="supported-color-schemes"'), "supported-color-schemes meta");
  assert.ok(html.includes("@media (prefers-color-scheme: dark)"), "dark-mode media query");
  assert.ok(html.includes(EMAIL_TOKENS.dark.surface), "dark surface override");
  assert.ok(html.includes(EMAIL_TOKENS.dark.text), "dark text override");
  // Light values stay inline so clients that ignore the query still render correctly.
  assert.ok(
    html.includes(`background-color:${EMAIL_TOKENS.cream}`),
    "light card colour stays inline as the default",
  );
});

test("wrapEmailHtml stays spam-safe: no images, modest payload", () => {
  const html = wrapEmailHtml(FRAGMENT);

  assert.ok(!/<img/i.test(html), "no image tags");
  assert.ok(!/background-image/i.test(html), "no CSS background images");
  assert.ok(!/<script/i.test(html), "no scripts");
  assert.ok(!/https?:\/\//.test(html.replace(/mailto:[^"']+/g, "")), "no external resource URLs");
  assert.ok(html.length < 12000, `shell stays small (was ${html.length} bytes)`);
});

test("wrapEmailHtml is idempotent", () => {
  const once = wrapEmailHtml(FRAGMENT);
  const twice = wrapEmailHtml(once);

  assert.equal(twice, once, "re-wrapping branded HTML is a no-op");
  assert.equal(once.split(WRAPPER_MARKER).length - 1, 1, "exactly one marker");
  assert.equal(once.split("<!DOCTYPE html>").length - 1, 1, "exactly one doctype");
});

test("wrapEmailHtml never nests a second document around a full HTML page", () => {
  const doc = "<html><body><p>Custom layout</p></body></html>";
  const wrapped = wrapEmailHtml(doc);

  assert.equal(wrapped.split("<html").length - 1, 1, "caller's <html> is not nested");
  assert.ok(wrapped.includes("Custom layout"), "caller content preserved");
  assert.ok(wrapped.includes(PRACTITIONER.email), "footer still appended");
  assert.ok(
    wrapped.indexOf(PRACTITIONER.email) < wrapped.indexOf("</body>"),
    "footer sits inside the body",
  );
});

test("wrapEmailHtml escapes the subject used as the document title", () => {
  const html = wrapEmailHtml(FRAGMENT, { title: 'Blood test <b>"now"</b> & later' });

  assert.ok(
    html.includes("<title>Blood test &lt;b&gt;&quot;now&quot;&lt;/b&gt; &amp; later</title>"),
    "title is escaped",
  );
});

test("wrapEmailHtml falls back to a practice title when no subject is given", () => {
  assert.ok(wrapEmailHtml(FRAGMENT).includes(`<title>${PRACTITIONER.name} · ${PRACTITIONER.title}</title>`));
  assert.ok(wrapEmailHtml(FRAGMENT, { title: "   " }).includes(`<title>${PRACTITIONER.name}`));
});

test("escapeHtml covers the five dangerous characters", () => {
  assert.equal(escapeHtml(`<a href="x">A & B</a>`), "&lt;a href=&quot;x&quot;&gt;A &amp; B&lt;/a&gt;");
});

test("htmlToPlainText renders a readable text version", () => {
  const text = htmlToPlainText("<p>Dear Ada,</p><p>Line one<br>Line two &amp; three</p>");

  assert.equal(text, "Dear Ada,\n\nLine one\nLine two & three");
  assert.ok(!/[<>]/.test(text), "no markup survives");
});

test("htmlToPlainText handles lists, entities, and stray whitespace", () => {
  const text = htmlToPlainText("<ul><li>First</li><li>Second&nbsp;item</li></ul>");

  assert.equal(text, "• First\n\n• Second item");
});

test("appendTextFooter preserves v3 plain-text parity", () => {
  const text = appendTextFooter("  Dear Ada,\n\nPlease arrange your blood test.  ");

  assert.ok(text.startsWith("Dear Ada,"), "leading whitespace trimmed");
  assert.ok(text.endsWith(FOOTER_TEXT), "exact v3 footer appended");
  assert.ok(text.includes("Hüseyin Ajuz · Hair Loss Specialist"), "signature intact");
});

test("buildPlainText prefers the caller's text and derives one otherwise", () => {
  assert.equal(buildPlainText("Hand-written body", FRAGMENT), "Hand-written body" + FOOTER_TEXT);
  assert.equal(buildPlainText(undefined, FRAGMENT), "Dear Ada,\n\nPlease arrange your blood test." + FOOTER_TEXT);
  assert.equal(buildPlainText("   ", FRAGMENT), "Dear Ada,\n\nPlease arrange your blood test." + FOOTER_TEXT);
  assert.equal(buildPlainText(42, FRAGMENT), "Dear Ada,\n\nPlease arrange your blood test." + FOOTER_TEXT);
});

test("all 7 producer fragments wrap without losing their copy", () => {
  const producerFragments = [
    "<p>Dear Ada,</p><p>Thank you for registering with Hüseyin Ajuz.</p>",
    "<p>Dear Ada,</p><p>Please arrange your blood test at your earliest convenience.</p>",
    "<p>Dear Ada,</p><p>Your 6-week check-in is due.</p>",
    "<p>Dear Ada,</p><p>Your treatment end review is approaching.</p>",
    "<p>Hi Ada,</p><p>I wanted to follow up on your interest in our hair loss consultation programme.</p>",
    "<p>Hi Ada,</p><p>A week has passed since you first reached out.</p>",
    "<p>Hi Ada,</p><p>This is my final follow-up.</p>",
  ];

  for (const fragment of producerFragments) {
    const html = wrapEmailHtml(fragment, { title: "Subject" });
    assert.ok(html.includes(fragment), "fragment preserved verbatim");
    assert.ok(html.includes(WRAPPER_MARKER), "fragment is branded");
    assert.ok(buildPlainText(undefined, fragment).length > FOOTER_TEXT.length, "text part is non-empty");
  }
});
