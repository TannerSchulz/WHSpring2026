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

export type TeamMember = {
  membership_id: string;
  user_id: string;
  display_name: string;
  email: string;
  role: "owner" | "admin" | "loan_officer" | "reviewer";
  status: "invited" | "active" | "disabled";
  title: string | null;
  joined_at: string;
};

export type BrandingSettings = {
  company_display_name: string;
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  call_to_action_label: string | null;
  disclosure_text: string | null;
};

export type LoanOfficerSettings = {
  title: string | null;
  nmls_id: string | null;
  phone: string | null;
  branch_name: string | null;
  public_slug: string | null;
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
  team: TeamMember[];
  branding: BrandingSettings;
  profile: LoanOfficerSettings;
  permissions: {
    manage_team: boolean;
    manage_branding: boolean;
    manage_workspace: boolean;
  };
  top_link_id: string | null;
  current_user_id: string;
};
