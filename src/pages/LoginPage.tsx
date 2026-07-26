import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { Button, Card, Input } from "@/components/ui";
import { useAuth } from "@/context/auth";

/** Calibrated lens mark — the brand's circular badge, drawn as an instrument. */
function LensMark() {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 * Math.PI) / 180;
    const isCardinal = i % 3 === 0;
    const r1 = isCardinal ? 26.5 : 28;
    const cx = 32;
    const cy = 32;
    return (
      <line
        key={i}
        x1={cx + r1 * Math.sin(angle)}
        y1={cy - r1 * Math.cos(angle)}
        x2={cx + 30 * Math.sin(angle)}
        y2={cy - 30 * Math.cos(angle)}
        stroke="currentColor"
        strokeWidth={isCardinal ? 1.5 : 1}
      />
    );
  });

  return (
    <svg viewBox="0 0 64 64" className="mx-auto mb-5 h-16 w-16 text-ink" aria-hidden="true">
      <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {ticks}
      <text
        x="32"
        y="33"
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        style={{
          fontFamily: "var(--font-heading)",
          fontStretch: "75%",
          fontWeight: 700,
          fontSize: "17px",
          letterSpacing: "0.02em",
        }}
      >
        HA
      </text>
    </svg>
  );
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await signIn(email, password);

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      navigate("/", { replace: true });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Instrument power-on */}
        <LensMark />
        <h1 className="display-condensed text-center text-[1.6rem] text-ink">
          Hüseyin Ajuz
        </h1>
        <p className="scale-label mb-8 mt-1 text-center text-ink-secondary">
          Patient Instrument
        </p>

        <Card hover={false}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email"
              type="email"
              placeholder="huseyinajuz@clinic.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            {error && (
              <p
                role="alert"
                className="rounded-[6px] bg-red-soft px-3 py-2 text-[0.8rem] font-medium text-red"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              loading={loading}
              className="w-full"
            >
              Sign In
            </Button>
          </form>
        </Card>

        <p className="scale-label mt-6 text-center text-ink-muted">
          Hüseyin Ajuz — Trichology
        </p>
      </div>
    </div>
  );
}
