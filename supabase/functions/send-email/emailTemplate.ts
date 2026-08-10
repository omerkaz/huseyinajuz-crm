// ─────────────────────────────────────────────────────────────────────────────
// Email design system (Phase 16 / MAIL-05)
//
// Branded HTML shell injected at the send-email chokepoint. Callers (src/lib/
// email.ts and the pg_cron SQL functions) send a plain content FRAGMENT — a few
// <p> tags — and this module wraps it in the practice's branded layout.
//
// Runtime: plain TypeScript, no Deno or Node APIs, no dependencies. It is
// imported by the Deno Edge Function and unit-tested by node:test.
//
// ── DESIGN TOKENS ────────────────────────────────────────────────────────────
// Email-safe approximations of the CRM design system (src/app.css @theme).
// Phase 22 drip templates should import EMAIL_TOKENS rather than re-typing hexes.
//
//   linen      #FAF6F1  page background (outside the card)
//   cream      #FFFDF9  card surface
//   charcoal   #2D2A26  body text
//   teal       #2A9D8F  accent bar, links, eyebrow
//   textSoft   #7A756E  footer text
//   textMuted  #A8A29E  sub-footer text
//   hairline   #EDE4D8  card border and footer rule
//
//   Dark-mode counterparts live in EMAIL_TOKENS.dark and are applied through a
//   prefers-color-scheme media query — clients that ignore it keep the light
//   palette, which is fully readable on its own.
//
//   Fonts: DM Serif Display and Inter do not load in email clients. The shell
//   uses Georgia (serif wordmark) and the system sans stack (body), both of
//   which resolve everywhere including Outlook's Word rendering engine.
//
// ── LAYOUT RULES ─────────────────────────────────────────────────────────────
//   * Table-based, role="presentation", fixed 600px card with a max-width
//     media query for phones — the Outlook-safe pattern.
//   * Every colour is set inline as well as in <style>; the <style> block only
//     adds responsive + dark-mode overrides, never load-bearing layout.
//   * NO images of any kind. The single decorative element is a 4px teal table
//     row. This keeps the text/image ratio spam-safe and the payload small.
// ─────────────────────────────────────────────────────────────────────────────

export const EMAIL_TOKENS = {
  linen: "#FAF6F1",
  cream: "#FFFDF9",
  charcoal: "#2D2A26",
  teal: "#2A9D8F",
  textSoft: "#7A756E",
  textMuted: "#A8A29E",
  hairline: "#EDE4D8",
  fontHeading: "Georgia, 'Times New Roman', Times, serif",
  fontBody: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  cardWidth: 600,
  dark: {
    page: "#1E1C1A",
    surface: "#26231F",
    text: "#F2EDE6",
    textSoft: "#B8B2A9",
    hairline: "#3A3531",
    teal: "#3DB3A4",
  },
} as const;

/** Practitioner identity used in the header and footer. */
export const PRACTITIONER = {
  name: "Hüseyin Ajuz",
  title: "Hair Loss Specialist",
  email: "mrhus@huseyinacuz.com",
} as const;

/**
 * Marks HTML that already carries the branded shell, so wrapping is idempotent
 * even if a caller pre-wraps its own content.
 */
export const WRAPPER_MARKER = "<!--ajuz-email-shell:v1-->";

/** Plain-text footer — unchanged from v3 so text parity is preserved. */
export const FOOTER_TEXT = `\n---\nWarm regards,\nHüseyin Ajuz · Hair Loss Specialist\nmrhus@huseyinacuz.com\n`;

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

const STYLE_BLOCK = `
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    body { margin:0 !important; padding:0 !important; width:100% !important; }
    a { color:${EMAIL_TOKENS.teal}; }
    .content p { margin:0 0 16px 0; }
    .content p:last-child { margin-bottom:0; }
    .content ul, .content ol { margin:0 0 16px 0; padding-left:20px; }
    @media screen and (max-width:620px) {
      .card-wrap { width:100% !important; }
      .pad { padding-left:20px !important; padding-right:20px !important; }
      .wordmark { font-size:22px !important; }
    }
    @media (prefers-color-scheme: dark) {
      .page-bg { background-color:${EMAIL_TOKENS.dark.page} !important; }
      .card { background-color:${EMAIL_TOKENS.dark.surface} !important; border-color:${EMAIL_TOKENS.dark.hairline} !important; }
      .t-ink, .t-ink p, .t-ink li, .t-ink strong, .wordmark { color:${EMAIL_TOKENS.dark.text} !important; }
      .t-soft, .t-soft strong { color:${EMAIL_TOKENS.dark.textSoft} !important; }
      .rule { border-color:${EMAIL_TOKENS.dark.hairline} !important; }
      a { color:${EMAIL_TOKENS.dark.teal} !important; }
    }
`;

/** Render the full branded document around a content fragment. */
function renderShell(contentHtml: string, title: string): string {
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
<title>${escapeHtml(title)}</title>
<style>${STYLE_BLOCK}</style>
</head>
<body class="page-bg" style="margin:0;padding:0;background-color:${t.linen};">
<table role="presentation" class="page-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${t.linen};width:100%;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" class="card-wrap card" width="${t.cardWidth}" cellpadding="0" cellspacing="0" border="0" style="width:${t.cardWidth}px;max-width:${t.cardWidth}px;background-color:${t.cream};border:1px solid ${t.hairline};border-radius:14px;">
        <tr>
          <td height="4" style="height:4px;line-height:4px;font-size:0;background-color:${t.teal};border-radius:14px 14px 0 0;">&nbsp;</td>
        </tr>
        <tr>
          <td class="pad" style="padding:28px 32px 4px 32px;">
            <div class="wordmark t-ink" style="font-family:${t.fontHeading};font-size:24px;line-height:30px;color:${t.charcoal};">${PRACTITIONER.name}</div>
            <div style="font-family:${t.fontBody};font-size:11px;line-height:16px;letter-spacing:1.5px;text-transform:uppercase;color:${t.teal};padding-top:4px;">${PRACTITIONER.title}</div>
          </td>
        </tr>
        <tr>
          <td class="pad content t-ink" style="padding:20px 32px 4px 32px;font-family:${t.fontBody};font-size:15px;line-height:24px;color:${t.charcoal};mso-line-height-rule:exactly;">
${contentHtml}
          </td>
        </tr>
        <tr>
          <td class="pad" style="padding:12px 32px 28px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="rule" height="1" style="height:1px;line-height:1px;font-size:0;border-top:1px solid ${t.hairline};">&nbsp;</td>
              </tr>
            </table>
            <p class="t-soft" style="margin:16px 0 0 0;font-family:${t.fontBody};font-size:13px;line-height:20px;color:${t.textSoft};">
              Warm regards,<br>
              <strong>${PRACTITIONER.name}</strong> · ${PRACTITIONER.title}<br>
              <a href="mailto:${PRACTITIONER.email}" style="color:${t.teal};text-decoration:none">${PRACTITIONER.email}</a>
            </p>
          </td>
        </tr>
      </table>
      <table role="presentation" class="card-wrap" width="${t.cardWidth}" cellpadding="0" cellspacing="0" border="0" style="width:${t.cardWidth}px;max-width:${t.cardWidth}px;">
        <tr>
          <td class="t-soft" style="padding:14px 20px 0 20px;text-align:center;font-family:${t.fontBody};font-size:11px;line-height:16px;color:${t.textMuted};">
            You are receiving this email because you contacted the practice about a hair loss consultation.
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
 * - Already-branded HTML is returned untouched (idempotent).
 * - A complete HTML document from a caller keeps its own layout and only gets
 *   the footer appended — the shell never nests a second <html> document.
 */
export function wrapEmailHtml(contentHtml: string, options: { title?: string } = {}): string {
  const content = contentHtml.trim();
  if (content.includes(WRAPPER_MARKER)) return content;
  if (/<html[\s>]/i.test(content)) return injectLegacyFooter(content);
  return renderShell(content, options.title?.trim() || `${PRACTITIONER.name} · ${PRACTITIONER.title}`);
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
