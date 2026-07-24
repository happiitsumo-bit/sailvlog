export interface BoatType {
  id: number;
  name: string;
  slug: string;
  description?: string;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

export interface Author {
  id: number;
  username: string;
  avatarUrl?: string;
}

export interface ArticleSummary {
  id: number;
  title: string;
  slug: string;
  createdAt: string;
  isPublished: boolean;
  viewCount: number;
  author: Author;
  boatType: BoatType;
  tags: { tag: Tag }[];
  _count: { likes: number; comments: number; bookmarks: number };
}

export interface Article extends ArticleSummary {
  contentMd: string;
  updatedAt: string;
}

export interface Comment {
  id: number;
  content: string;
  createdAt: string;
  author: { username: string; avatarUrl?: string };
}

export interface SailorProfile {
  id: number;
  username: string;
  bio?: string;
  avatarUrl?: string;
  specialty?: string;
  affiliation?: string;
  experienceYears?: number;
  boatType?: BoatType;
}

export interface Question {
  id: number;
  title: string;
  body: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  author: SailorProfile;
  boatType?: BoatType;
  tags: { tag: Tag }[];
  _count: { answers: number; votes: number };
  answers: { id: number; isAccepted: boolean }[];
}

export interface Answer {
  id: number;
  body: string;
  isAccepted: boolean;
  createdAt: string;
  author: SailorProfile;
  _count: { votes: number };
}

export interface QuestionDetail extends Question {
  answers: Answer[];
}

export interface Post {
  id: number;
  body: string;
  createdAt: string;
  author: SailorProfile & { boatType?: BoatType };
  _count: { likes: number };
}

export interface CourseLesson {
  id: number;
  position: number;
  title: string;
  minutes: number;
  articleId?: number;
}

export interface Course {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  level: string;
  estimatedHours: number;
  enrolledCount: number;
  accentColor: string;
  createdAt: string;
  boatType?: BoatType;
  courseArticles: CourseLesson[];
}

export type TeamRole = "member" | "ob" | "admin";
export type TeamCategory = "university" | "club" | "professional";

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  member: "現役",
  ob: "OB/OG",
  admin: "管理者",
};

export const TEAM_CATEGORY_LABEL: Record<TeamCategory, string> = {
  university: "大学",
  club: "クラブ",
  professional: "実業団",
};

export interface TeamMemberUser {
  id: number;
  username: string;
  avatarUrl?: string;
  specialty?: string;
  experienceYears?: number;
  boatType?: { name: string; slug: string };
}

export interface TeamMember {
  id: number;
  role: TeamRole;
  joinedAt: string;
  user: TeamMemberUser;
}

export interface TeamSummary {
  id: number;
  slug: string;
  name: string;
  university?: string;
  region?: string;
  bio?: string;
  category: TeamCategory;
  logoUrl?: string;
  createdAt: string;
  _count: { members: number; articles: number; questions: number };
}

export interface TeamDetail extends Omit<TeamSummary, "_count"> {
  members: TeamMember[];
  _count: { articles: number; questions: number };
}

export type SessionType = "practice" | "race";

export interface SessionSummary {
  id: number;
  title: string;
  type: SessionType;
  startedAt: string;
  durationSec: number;
  venue?: string;
  createdAt: string;
  teamId: number;
  uploaderId: number;
  _count: { tracks: number; annotations: number };
}

export interface Sailor {
  id: number;
  username: string;
  bio?: string;
  avatarUrl?: string;
  specialty?: string;
  affiliation?: string;
  experienceYears?: number;
  boatType?: BoatType;
  _count: { articles: number; questions: number; followers: number };
}
