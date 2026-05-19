import { CommissionDetailsTable } from "./CommissionDetailsTable";

interface CommissionTrackingTabProps {
  establishmentId: string;
  establishmentName?: string;
  defaultResponsibleName?: string;
}

export function CommissionTrackingTab({
  establishmentId,
  establishmentName,
  defaultResponsibleName,
}: CommissionTrackingTabProps) {
  return (
    <CommissionDetailsTable
      establishmentId={establishmentId}
      establishmentName={establishmentName}
      defaultResponsibleName={defaultResponsibleName}
    />
  );
}
