export type PortalSession = {
  user: {
    id: string;
    email: string;
    display_name: string;
    status: string;
  };
  membership: Membership | null;
  onboarding_required: boolean;
};

export type Membership = {
  id: string;
  role: "owner" | "admin" | "loan_officer" | "reviewer";
  organization: {
    id: string;
    name: string;
    slug: string;
  };
};

export type BorrowerStatus = "new" | "contacted" | "reviewing" | "closed" | "archived";

export type BorrowerNote = {
  id: string;
  body: string;
  author: string;
  created_at: string;
};

export type Borrower = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  market: string;
  home_price: number | null;
  payment: number | null;
  scenario: "low" | "average" | "stretch" | null;
  status: BorrowerStatus;
  submitted_at: string;
  source: string;
  credit_range: string;
  income: number | null;
  available_funds: number | null;
  employment_path: "employment" | "specialized_schooling";
  notes: BorrowerNote[];
};

export type BorrowerLink = {
  id: string;
  name: string;
  slug: string;
  source: string | null;
  visits: number;
  submissions: number;
  conversion_rate: number;
  is_active: boolean;
};

export type DashboardData = {
  membership: Membership;
  metrics: {
    new_borrowers: number;
    completion_rate: number;
    active_links: number;
    follow_ups_due: number;
  };
  activity: Array<{ date: string; count: number }>;
  borrowers: Borrower[];
  links: BorrowerLink[];
  top_link_id: string | null;
  current_user_id: string;
};
