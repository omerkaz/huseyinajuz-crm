import systemArchitectureHtml from "../../docs/diagrams/system-architecture.html?raw";
import emailPipelineHtml from "../../docs/diagrams/email-pipeline.html?raw";
import v12MilestoneStatusHtml from "../../docs/diagrams/v12-milestone-status.html?raw";
import phase15DripStatesHtml from "../../docs/diagrams/phase15-drip-states.html?raw";

/**
 * Registry for the self-contained diagram documents rendered at /diagrams.
 *
 * Each diagram is a standalone HTML file (SVG + interactive runtime) generated
 * from the project's planning state. They are bundled as raw strings and
 * rendered inside a sandboxed iframe so their scripts/styles stay isolated
 * from the app.
 */

export const DIAGRAM_ACCENTS = ["teal", "coral", "ink", "muted"] as const;
export type DiagramAccent = (typeof DIAGRAM_ACCENTS)[number];

export interface Diagram {
  slug: string;
  title: string;
  kind: string;
  description: string;
  meta: string;
  accent: DiagramAccent;
  html: string;
}

export const DIAGRAMS: readonly Diagram[] = [
  {
    slug: "system-architecture",
    title: "System Architecture",
    kind: "architecture",
    description:
      "How the SPA, ManyChat, and the landing page meet Supabase — and where email leaves the building.",
    meta: "9 nodes · 7 edges",
    accent: "teal",
    html: systemArchitectureHtml,
  },
  {
    slug: "email-pipeline",
    title: "Email Pipeline",
    kind: "flowchart",
    description:
      "The gates a reminder passes before Resend sends it: opt-in toggle first, send-log dedup second.",
    meta: "6 nodes · 7 edges",
    accent: "coral",
    html: emailPipelineHtml,
  },
  {
    slug: "v12-milestone-status",
    title: "v1.2 Milestone Status",
    kind: "timeline",
    description:
      "Twenty days of July: four phases shipped, two remaining beyond the axis break.",
    meta: "7 events",
    accent: "ink",
    html: v12MilestoneStatusHtml,
  },
  {
    slug: "phase15-drip-states",
    title: "Phase 15 Drip States",
    kind: "state machine",
    description:
      "The planned drip sequence, its exit rule, and the two open decisions blocking the build.",
    meta: "6 nodes · 7 edges",
    accent: "muted",
    html: phase15DripStatesHtml,
  },
];

export function getDiagram(slug: string): Diagram | null {
  return DIAGRAMS.find((d) => d.slug === slug) ?? null;
}
