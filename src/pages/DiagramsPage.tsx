import { Link } from "react-router";
import { Card } from "@/components/ui";
import { DIAGRAMS, type DiagramAccent } from "@/lib/diagrams";

const ACCENT_DOT_CLASSES: Record<DiagramAccent, string> = {
  teal: "bg-olive",
  coral: "bg-red",
  ink: "bg-ink",
  muted: "bg-ink-muted",
};

export default function DiagramsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="display-condensed text-[1.3rem] text-ink">Diagrams</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Platform architecture, email pipeline, milestone status, and the
          Phase 15 drip design — generated from the project's planning state.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {DIAGRAMS.map((diagram) => (
          <Link
            key={diagram.slug}
            to={`/diagrams/${diagram.slug}`}
            className="block rounded-[8px] focus-visible:outline-2 focus-visible:outline-ink"
          >
            <Card className="h-full !p-6">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
                {diagram.kind}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className={`h-[7px] w-[7px] shrink-0 rounded-full ${ACCENT_DOT_CLASSES[diagram.accent]}`}
                />
                <h2 className="text-[15px] font-semibold text-ink">
                  {diagram.title}
                </h2>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
                {diagram.description}
              </p>
              <p className="mt-3 text-[11px] tracking-wide text-ink-muted">
                {diagram.meta}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
