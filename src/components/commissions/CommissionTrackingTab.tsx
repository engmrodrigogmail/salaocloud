import { CommissionDetailsTable } from "./CommissionDetailsTable";

interface CommissionTrackingTabProps {
  establishmentId: string;
}

export function CommissionTrackingTab({ establishmentId }: CommissionTrackingTabProps) {
  return <CommissionDetailsTable establishmentId={establishmentId} />;
}
