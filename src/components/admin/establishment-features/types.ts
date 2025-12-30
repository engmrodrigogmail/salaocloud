export type BlockStatus = "idle" | "running" | "ok" | "warn" | "error";

export type SummaryItem = {
  label: string;
  value: string | number;
};

export type IssueItem = {
  label: string;
  count: number;
  hint?: string;
};

export type BlockResult = {
  status: Exclude<BlockStatus, "idle" | "running">;
  summary?: SummaryItem[];
  issues?: IssueItem[];
  details?: string[];
};
