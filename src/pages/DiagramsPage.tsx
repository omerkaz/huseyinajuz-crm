import { Link } from "react-router";
import { Card } from "@/components/ui";
import { DIAGRAMS, type DiagramAccent } from "@/lib/diagrams";

const ACCENT_DOT_CLASSES: Record<DiagramAccent, string> = {
  teal: "bg-teal",
  coral: "bg-coral",
  ink: "bg-text",
  muted: "bg-text-secondary",
};

export default function DiagramsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="font-heading text-2xl text-text">Diagrams</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Platform architecture, email pipeline, milestone status, and the
          Phase 15 drip design — generated from the project's planning state.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {DIAGRAMS.map((diagram) => (
          <Link
            key={diagram.slug}
            to={`/diagrams/${diagram.slug}`}
            className="block rounded-[14px] focus-visible:outline-2 focus-visible:outline-teal"
          >
            <Card className="h-full !p-6">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-text-muted">
                {diagram.kind}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className={`h-[7px] w-[7px] shrink-0 rounded-full ${ACCENT_DOT_CLASSES[diagram.accent]}`}
                />
                <h2 className="text-[15px] font-semibold text-text">
                  {diagram.title}
                </h2>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">
                {diagram.description}
              </p>
              <p className="mt-3 text-[11px] tracking-wide text-text-muted">
                {diagram.meta}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
