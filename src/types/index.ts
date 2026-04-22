// ─── Lawyer / Advocate ───────────────────────────────────────────────────────

export interface Lawyer {
    id: string;
    name: string;
    title: string;
    court: string;
    bciId: string;
    rating: number;
    reviewCount: number;
    winRate: number;
    casesHandled: number;
    yearsActive: number;
    courtLevels: string;
    specializations: string[];
    consultationFee: number;
    imageUrl: string;
    isVerified: boolean;
    bio: string;
    barMemberships: string[];
    transparencyChecklist: TransparencyItem[];
}

export interface TransparencyItem {
    title: string;
    description: string;
}

// ─── Case ────────────────────────────────────────────────────────────────────

export type CaseStatus = "IN_PROGRESS" | "HEARING_SET" | "VERDICT" | "CLOSED";

export interface Case {
    id: string;
    ref: string;
    title: string;
    description: string;
    status: CaseStatus;
    nextHearing?: string;
    outcome?: string;
    lawyer: {
        name: string;
        role: string;
        imageUrl: string;
    };
    documents?: CaseDocument[];
    timeline?: TimelineStep[];
    jurisdiction?: JudiciaryInfo;
}

export interface TimelineStep {
    label: string;
    date: string;
    status: "completed" | "active" | "pending";
}

export interface CaseDocument {
    id: string;
    name: string;
    date: string;
    size: string;
    hash: string;
    authStatus: "AUTHENTICATED" | "ENCRYPTING" | "PENDING";
}

export interface JudiciaryInfo {
    authority: string;
    court: string;
    jurisdiction: string;
    eToken: string;
    room: string;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface ClientRequest {
    id: string;
    category: string;
    categoryColor: string;
    title: string;
    description: string;
    timeAgo: string;
}

export interface ActiveFile {
    ref: string;
    title: string;
    nextAction: string;
}

export interface CalendarEvent {
    date: string;
    month: string;
    title: string;
    subtitle: string;
    time: string;
}

export interface DashboardStats {
    profileIntegrity: number;
    trustQuotient: number;
    monthlyEarnings: number;
    nextPayout: string;
}

// ─── Filter ──────────────────────────────────────────────────────────────────

export interface FilterState {
    categories: string[];
    courtLevel: string;
    location: string;
    feeRange: [number, number];
    minRating: number;
}

export type SortOption = "Rating" | "Experience" | "Consultation Fee";