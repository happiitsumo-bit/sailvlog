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
