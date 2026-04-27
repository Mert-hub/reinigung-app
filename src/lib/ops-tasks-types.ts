export type OpsTask = {
  id: string;
  title: string;
  description: string | null;
  hotel_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  deadline_at: string | null;
  all_day: boolean;
  status: "pending" | "in_progress" | "done" | "cancelled";
  /** Google-style calendar color key; optional until DB migrated. */
  calendar_color?: string | null;
  assignee_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskChatMessage = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export type TaskProposal = {
  id: string;
  title: string;
  description: string | null;
  hotel_id: string | null;
  suggested_starts_at: string | null;
  suggested_ends_at: string | null;
  suggested_deadline_at: string | null;
  proposed_by: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type ProfileOption = {
  id: string;
  role: string | null;
  hotel_id: string | null;
};
