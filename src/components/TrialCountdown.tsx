interface TrialCountdownProps {
  trialEndsAt: string | null;
  subscriptionPlan: string;
}

// Trial removed from product. Kept as no-op to avoid breaking imports.
export function TrialCountdown(_props: TrialCountdownProps) {
  return null;
}
