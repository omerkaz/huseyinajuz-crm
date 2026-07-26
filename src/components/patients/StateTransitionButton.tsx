import { useState } from "react";
import { Button, Select } from "@/components/ui";
import { transitionState } from "@/lib/patients";
import { LIFECYCLE_LABELS, VALID_TRANSITIONS } from "@/types/database";
import type { LifecycleState } from "@/types/database";

interface StateTransitionButtonProps {
  patientId: string;
  currentState: LifecycleState;
  onTransition: () => void;
}

export function StateTransitionButton({
  patientId,
  currentState,
  onTransition,
}: StateTransitionButtonProps) {
  const validNext = VALID_TRANSITIONS[currentState];
  const [targetState, setTargetState] = useState<LifecycleState | "">(
    validNext.length > 0 ? validNext[0] : "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (validNext.length === 0) {
    return (
      <p className="text-[0.8rem] text-ink-muted">
        End of scale — no further transitions.
      </p>
    );
  }

  async function handleTransition() {
    if (!targetState) return;
    setLoading(true);
    setError(null);

    const { error: transitionError } = await transitionState(
      patientId,
      currentState,
      targetState,
    );

    if (transitionError) {
      setError(transitionError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    onTransition();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Select
            label="Move to"
            value={targetState}
            onChange={(e) => setTargetState(e.target.value as LifecycleState)}
            disabled={loading}
          >
            {validNext.map((state) => (
              <option key={state} value={state}>
                {LIFECYCLE_LABELS[state]}
              </option>
            ))}
          </Select>
        </div>
        <Button
          size="sm"
          loading={loading}
          disabled={loading || !targetState}
          onClick={() => void handleTransition()}
        >
          Move
        </Button>
      </div>
      {error && (
        <p className="text-[0.8rem] font-medium text-red">{error}</p>
      )}
    </div>
  );
}
