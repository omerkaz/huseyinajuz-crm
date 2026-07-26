import { Link, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { getDiagram } from "@/lib/diagrams";

export default function DiagramViewPage() {
  const { slug } = useParams<{ slug: string }>();
  const diagram = slug ? getDiagram(slug) : null;

  if (!diagram) {
    return (
      <div className="mx-auto max-w-lg">
        <Card hover={false} className="text-center">
          <h1 className="font-heading text-xl text-text">Diagram not found</h1>
          <p className="mt-2 text-sm text-text-secondary">
            No diagram exists at this address — it may have been renamed or
            removed.
          </p>
          <Link to="/diagrams" className="mt-6 inline-block">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to diagrams
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <Link
            to="/diagrams"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-teal"
          >
            <ArrowLeft className="h-4 w-4" />
            Diagrams
          </Link>
          <h1 className="mt-1 font-heading text-2xl text-text">
            {diagram.title}
          </h1>
        </div>
        <p className="hidden pt-1 text-[11px] uppercase tracking-[0.18em] text-text-muted sm:block">
          {diagram.kind}
        </p>
      </div>

      {/*
        Sandboxed: the diagram documents carry their own interactive runtime
        (hover focus, animated edges, zoom/pan). allow-scripts keeps that
        working while isolating the document from the app's origin.
      */}
      <iframe
        srcDoc={diagram.html}
        title={diagram.title}
        sandbox="allow-scripts"
        className="h-[calc(100dvh-15rem)] min-h-[420px] w-full rounded-[14px] border border-divider bg-bg shadow-warm"
      />
    </div>
  );
}
