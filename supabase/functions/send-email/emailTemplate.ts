// ─────────────────────────────────────────────────────────────────────────────
// Email design system (Phase 16 / MAIL-05) — elegance pass
//
// Branded HTML shell injected at the send-email chokepoint. Callers (src/lib/
// email.ts and the pg_cron SQL functions) send a plain content FRAGMENT — a few
// <p> tags — and this module wraps it in the practice's branded layout.
//
// Runtime: plain TypeScript, no Deno or Node APIs, no dependencies. It is
// imported by the Deno Edge Function and unit-tested by node:test.
//
// ── DESIGN TOKENS ────────────────────────────────────────────────────────────
// Email-safe approximations of the CRM's warm editorial palette.
// Phase 22 drip templates should import EMAIL_TOKENS and the body primitives
// (emailHeading / emailCallout / emailButton / emailSignoff) rather than
// re-typing hexes or hand-rolling markup.
//
//   linen      #FAF6F1  page background (outside the card)
//   cream      #FFFDF9  card surface
//   charcoal   #2D2A26  body text
//   teal       #2A9D8F  accent rule, links, eyebrow
//   coral      #E76F51  reserved for urgency / alert callouts only
//   textSoft   #7A756E  signature and secondary text
//   textMuted  #A8A29E  sub-footer text
//   hairline   #EDE4D8  card border and rules
//   wash       #F4EFE8  quiet fill for callouts
//
//   Dark-mode counterparts live in EMAIL_TOKENS.dark and are applied through a
//   prefers-color-scheme media query — clients that ignore it keep the light
//   palette, which is fully readable on its own.
//
//   Fonts: DM Serif Display and Inter do not load in email clients. The shell
//   uses Georgia (serif wordmark and section headings) and the system sans
//   stack (body), both of which resolve everywhere including Outlook's Word
//   rendering engine. Elegance comes from size, weight, line-height and
//   letter-spacing rather than from a webfont that will not arrive.
//
// ── VERTICAL RHYTHM ──────────────────────────────────────────────────────────
//   Body copy is 16px/28px (a 1.75 ratio) with 18px between paragraphs, set on
//   a 4px scale: 4 accent · 36 header top · 28 header-to-rule · 32 rule-to-copy
//   · 32 copy-to-signature. Side padding is 44px on desktop, 24px on phones,
//   which keeps the measure near 60 characters — the editorial sweet spot.
//
// ── LAYOUT RULES ─────────────────────────────────────────────────────────────
//   * Table-based, role="presentation", fixed 600px card with a max-width
//     media query for phones — the Outlook-safe pattern.
//   * Every colour is set inline as well as in <style>; the <style> block only
//     adds responsive + dark-mode overrides, never load-bearing layout.
//   * NO images of any kind. The only decorative elements are a 4px teal table
//     row and 1px hairline rules. This keeps the text/image ratio spam-safe and
//     the payload small (< 12 KB before content).
// ─────────────────────────────────────────────────────────────────────────────

export const EMAIL_TOKENS = {
  linen: "#FAF6F1",
  cream: "#FFFDF9",
  charcoal: "#2D2A26",
  teal: "#2A9D8F",
  coral: "#E76F51",
  textSoft: "#7A756E",
  textMuted: "#A8A29E",
  hairline: "#EDE4D8",
  wash: "#F4EFE8",
  fontHeading: "Georgia, 'Times New Roman', Times, serif",
  fontBody: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  cardWidth: 600,
  dark: {
    page: "#1E1C1A",
    surface: "#26231F",
    text: "#F2EDE6",
    textSoft: "#B8B2A9",
    hairline: "#3A3531",
    wash: "#2F2B27",
    teal: "#3DB3A4",
    coral: "#F08A6E",
  },
} as const;

/** Practitioner identity used in the header and footer. */
export const PRACTITIONER = {
  name: "Hüseyin Ajuz",
  title: "Hair Loss Specialist",
  email: "mrhus@huseyinacuz.com",
} as const;

/**
 * Marks HTML that already carries the branded shell, so wrapping is idempotent.
 * The version suffix moves with the design; detection matches on MARKER_PREFIX
 * so HTML rendered by an older shell is still recognised as already-branded.
 */
const MARKER_PREFIX = "<!--ajuz-email-shell:";
export const WRAPPER_MARKER = `${MARKER_PREFIX}v2-->`;

/** Plain-text footer — unchanged from v3 so text parity is preserved. */
export const FOOTER_TEXT = `\n---\nWarm regards,\nHüseyin Ajuz · Hair Loss Specialist\nmrhus@huseyinacuz.com\n`;

/** Line under the card. Explains why the message arrived — a trust signal. */
const CONSENT_LINE =
  "You are receiving this email because you contacted the practice about a hair loss consultation.";

/** Minimal footer for HTML that arrives as a complete document (legacy path). */
const LEGACY_FOOTER_HTML = `
<hr style="border:none;border-top:1px solid ${EMAIL_TOKENS.hairline};margin:24px 0 16px">
<p style="font-size:13px;color:${EMAIL_TOKENS.textSoft};margin:0">
  Warm regards,<br>
  <strong>${PRACTITIONER.name}</strong> · ${PRACTITIONER.title}<br>
  <a href="mailto:${PRACTITIONER.email}" style="color:${EMAIL_TOKENS.teal};text-decoration:none">${PRACTITIONER.email}</a>
</p>
`;

/** Escape text destined for HTML element content or a quoted attribute. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Body primitives ──────────────────────────────────────────────────────────
// Fragments that templates can compose. Each one is fully inline-styled so it
// survives Outlook, and each one is dark-mode aware through a class hook.

/** Section heading inside the body — serif, sized just above the copy. */
export function emailHeading(text: string): string {
  const t = EMAIL_TOKENS;
  return `<p class="h-sub t-ink" style="margin:28px 0 12px 0;font-family:${t.fontHeading};font-size:19px;line-height:26px;font-weight:normal;color:${t.charcoal};">${escapeHtml(text)}</p>`;
}

/**
 * Quiet emphasis block: a left-ruled panel for one important idea.
 * `tone: "urgent"` switches the rule and text to coral — the only sanctioned
 * use of coral in email, reserved for deadlines and last-chance messages.
 */
export function emailCallout(html: string, tone: "calm" | "urgent" = "calm"): string {
  const t = EMAIL_TOKENS;
  const accent = tone === "urgent" ? t.coral : t.teal;
  const cls = tone === "urgent" ? "callout callout-urgent" : "callout";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;"><tr>
  <td class="${cls}" style="padding:16px 20px;background-color:${t.wash};border-left:3px solid ${accent};border-radius:0 10px 10px 0;font-family:${t.fontBody};font-size:15px;line-height:25px;color:${t.charcoal};mso-line-height-rule:exactly;">${html}</td>
</tr></table>`;
}

/** Bulletproof-ish CTA: a padded table cell, no images, no VML needed. */
export function emailButton(href: string, label: string): string {
  const t = EMAIL_TOKENS;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr>
  <td class="btn" style="background-color:${t.teal};border-radius:10px;">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 26px;font-family:${t.fontBody};font-size:15px;line-height:20px;font-weight:bold;letter-spacing:0.2px;color:#FFFDF9;text-decoration:none;">${escapeHtml(label)}</a>
  </td>
</tr></table>`;
}

/** Divider for templates that need to separate two ideas inside the body. */
export function emailDivider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr>
  <td class="rule" height="1" style="height:1px;line-height:1px;font-size:0;border-top:1px solid ${EMAIL_TOKENS.hairline};">&nbsp;</td>
</tr></table>`;
}

const STYLE_BLOCK = `
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    body { margin:0 !important; padding:0 !important; width:100% !important; }
    a { color:${EMAIL_TOKENS.teal}; }
    .content p { margin:0 0 18px 0; }
    .content p:last-child { margin-bottom:0; }
    .content ul, .content ol { margin:0 0 18px 0; padding-left:22px; }
    .content li { margin:0 0 8px 0; }
    .content a { color:${EMAIL_TOKENS.teal}; text-decoration:underline; }
    .btn a { color:#FFFDF9 !important; text-decoration:none !important; }
    @media screen and (max-width:620px) {
      .card-wrap { width:100% !important; }
      .pad { padding-left:24px !important; padding-right:24px !important; }
      .wordmark { font-size:24px !important; }
      .content { font-size:16px !important; line-height:27px !important; }
    }
    @media (prefers-color-scheme: dark) {
      .page-bg { background-color:${EMAIL_TOKENS.dark.page} !important; }
      .card { background-color:${EMAIL_TOKENS.dark.surface} !important; border-color:${EMAIL_TOKENS.dark.hairline} !important; }
      .t-ink, .t-ink p, .t-ink li, .t-ink strong, .wordmark, .h-sub { color:${EMAIL_TOKENS.dark.text} !important; }
      .t-soft, .t-soft strong { color:${EMAIL_TOKENS.dark.textSoft} !important; }
      .rule { border-color:${EMAIL_TOKENS.dark.hairline} !important; }
      .callout { background-color:${EMAIL_TOKENS.dark.wash} !important; border-left-color:${EMAIL_TOKENS.dark.teal} !important; color:${EMAIL_TOKENS.dark.text} !important; }
      .callout-urgent { border-left-color:${EMAIL_TOKENS.dark.coral} !important; }
      .eyebrow { color:${EMAIL_TOKENS.dark.teal} !important; }
      a { color:${EMAIL_TOKENS.dark.teal} !important; }
    }
`;

/** Length of the hidden inbox preview line. Gmail shows roughly this much. */
const PREHEADER_MAX = 110;

/**
 * Derive the hidden preview line shown next to the subject in the inbox.
 * The greeting ("Dear Ada,") carries no information there, so it is skipped in
 * favour of the first real sentence of the message.
 */
export function derivePreheader(contentHtml: string): string {
  const lines = htmlToPlainText(contentHtml)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const body = lines.length > 1 && /[,:]$/.test(lines[0]) ? lines.slice(1) : lines;
  const text = body.join(" ").replace(/\s+/g, " ").trim();
  if (text.length <= PREHEADER_MAX) return text;
  const clipped = text.slice(0, PREHEADER_MAX);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).replace(/[\s.,;:—-]+$/, "")}…`;
}

/**
 * Hidden preview text plus enough zero-width filler that the client does not
 * pull the header wordmark into the inbox preview after it.
 */
function renderPreheader(text: string): string {
  if (!text) return "";
  const filler = "&#847;&zwnj;&nbsp;".repeat(60);
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${EMAIL_TOKENS.cream};opacity:0;">${escapeHtml(text)}${filler}</div>`;
}

/** Render the full branded document around a content fragment. */
function renderShell(contentHtml: string, title: string, preheader: string): string {
  const t = EMAIL_TOKENS;
  return `<!DOCTYPE html>
<html lang="en">
<head>
${WRAPPER_MARKER}
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(title)}</title>
<style>${STYLE_BLOCK}</style>
</head>
<body class="page-bg" style="margin:0;padding:0;background-color:${t.linen};">
${renderPreheader(preheader)}
<table role="presentation" class="page-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${t.linen};width:100%;">
  <tr>
    <td align="center" style="padding:32px 12px 40px 12px;">
      <table role="presentation" class="card-wrap card" width="${t.cardWidth}" cellpadding="0" cellspacing="0" border="0" style="width:${t.cardWidth}px;max-width:${t.cardWidth}px;background-color:${t.cream};border:1px solid ${t.hairline};border-radius:14px;">
        <tr>
          <td height="4" style="height:4px;line-height:4px;font-size:0;background-color:${t.teal};border-radius:14px 14px 0 0;">&nbsp;</td>
        </tr>
        <tr>
          <td class="pad" style="padding:36px 44px 0 44px;">
            <div class="wordmark t-ink" style="font-family:${t.fontHeading};font-size:27px;line-height:34px;letter-spacing:0.2px;color:${t.charcoal};">${PRACTITIONER.name}</div>
            <div class="eyebrow" style="font-family:${t.fontBody};font-size:10px;line-height:16px;letter-spacing:2.2px;text-transform:uppercase;color:${t.teal};padding-top:6px;">${PRACTITIONER.title}</div>
          </td>
        </tr>
        <tr>
          <td class="pad" style="padding:28px 44px 0 44px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="rule" height="1" style="height:1px;line-height:1px;font-size:0;border-top:1px solid ${t.hairline};">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="pad content t-ink" style="padding:32px 44px 0 44px;font-family:${t.fontBody};font-size:16px;line-height:28px;color:${t.charcoal};mso-line-height-rule:exactly;">
${contentHtml}
          </td>
        </tr>
        <tr>
          <td class="pad" style="padding:32px 44px 36px 44px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="rule" height="1" style="height:1px;line-height:1px;font-size:0;border-top:1px solid ${t.hairline};">&nbsp;</td>
              </tr>
            </table>
            <p class="t-soft" style="margin:24px 0 0 0;font-family:${t.fontBody};font-size:14px;line-height:22px;color:${t.textSoft};">Warm regards,</p>
            <p class="t-ink" style="margin:6px 0 0 0;font-family:${t.fontHeading};font-size:19px;line-height:26px;color:${t.charcoal};">${PRACTITIONER.name}</p>
            <p class="eyebrow" style="margin:4px 0 0 0;font-family:${t.fontBody};font-size:10px;line-height:16px;letter-spacing:2.2px;text-transform:uppercase;color:${t.teal};">${PRACTITIONER.title}</p>
            <p class="t-soft" style="margin:12px 0 0 0;font-family:${t.fontBody};font-size:14px;line-height:22px;color:${t.textSoft};">
              <a href="mailto:${PRACTITIONER.email}" style="color:${t.teal};text-decoration:none">${PRACTITIONER.email}</a>
            </p>
          </td>
        </tr>
      </table>
      <table role="presentation" class="card-wrap" width="${t.cardWidth}" cellpadding="0" cellspacing="0" border="0" style="width:${t.cardWidth}px;max-width:${t.cardWidth}px;">
        <tr>
          <td class="pad" style="padding:20px 44px 0 44px;text-align:center;font-family:${t.fontBody};font-size:11px;line-height:18px;letter-spacing:0.2px;color:${t.textMuted};">
            ${CONSENT_LINE}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Append the legacy footer to a complete HTML document — before </body> if present. */
function injectLegacyFooter(html: string): string {
  const bodyCloseIdx = html.toLowerCase().lastIndexOf("</body>");
  if (bodyCloseIdx !== -1) {
    return html.slice(0, bodyCloseIdx) + LEGACY_FOOTER_HTML + html.slice(bodyCloseIdx);
  }
  return html + LEGACY_FOOTER_HTML;
}

/**
 * Wrap a content fragment in the branded email shell.
 *
 * - Already-branded HTML is returned untouched (idempotent, across shell
 *   versions).
 * - A complete HTML document from a caller keeps its own layout and only gets
 *   the footer appended — the shell never nests a second <html> document.
 * - `preheader` overrides the inbox preview line; pass "" to omit it.
 */
export function wrapEmailHtml(
  contentHtml: string,
  options: { title?: string; preheader?: string } = {},
): string {
  const content = contentHtml.trim();
  if (content.includes(MARKER_PREFIX)) return content;
  if (/<html[\s>]/i.test(content)) return injectLegacyFooter(content);
  const preheader =
    typeof options.preheader === "string" ? options.preheader.trim() : derivePreheader(content);
  return renderShell(
    content,
    options.title?.trim() || `${PRACTITIONER.name} · ${PRACTITIONER.title}`,
    preheader,
  );
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/**
 * Derive a readable plain-text body from a content fragment.
 * Used when a caller sends HTML only — an HTML-only email is a spam signal,
 * and the shell markup makes the text/markup ratio worse without this.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#?\w+;/g, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Append the plain-text footer (unchanged from v3). */
export function appendTextFooter(text: string): string {
  return text.trim() + FOOTER_TEXT;
}

/**
 * Build the plain-text part for an outbound email: the caller's text when
 * supplied, otherwise one derived from the HTML content — always footered.
 */
export function buildPlainText(text: unknown, contentHtml: string): string {
  const provided = typeof text === "string" ? text.trim() : "";
  return appendTextFooter(provided || htmlToPlainText(contentHtml));
}
