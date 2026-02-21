export interface User {
  id: string
  name: string
  avatar: string
  bio?: string
  /** 로그인 계정 이메일 (Admin 접근 판단 등에 사용) */
  email?: string
}

export interface Post {
  id: string
  type: "photo" | "update" | "english-tip"
  author: User
  title?: string
  content: string
  media?: string[]
  linkUrl?: string
  tags?: string[]
  likes: number
  comments: number
  liked: boolean
  createdAt: string
  isHotTopic?: boolean
}

export interface Comment {
  id: string
  author: User
  content: string
  createdAt: string
  likes: number
}

export interface ChatConversation {
  id: string
  type: "dm" | "group"
  name: string
  members: User[]
  lastMessage: string
  lastMessageTime: string
  unread: number
  avatar?: string
}

export interface ChatMessage {
  id: string
  sender: User
  content: string
  timestamp: string
  isOwn: boolean
}

export const currentUser: User = {
  id: "u1",
  name: "Alex Kim",
  avatar: "AK",
  bio: "Learning English, loving life.",
}

export const users: User[] = [
  currentUser,
  { id: "u2", name: "Sarah Chen", avatar: "SC", bio: "English teacher & traveler" },
  { id: "u3", name: "James Park", avatar: "JP", bio: "Tech enthusiast" },
  { id: "u4", name: "Min-ji Lee", avatar: "ML", bio: "Bookworm & coffee lover" },
  { id: "u5", name: "David Oh", avatar: "DO", bio: "Photographer" },
  { id: "u6", name: "Yuna Kang", avatar: "YK", bio: "Yoga & wellness" },
]

/** Not used for feed; posts come from API (Supabase). Kept for type/other refs. */
export const posts: Post[] = []

export const weeklyBest: Post[] = []

export const comments: Comment[] = [
  {
    id: "c1",
    author: users[1],
    content: "What a beautiful shot! Where exactly along the river is this?",
    createdAt: "1h ago",
    likes: 5,
  },
  {
    id: "c2",
    author: users[2],
    content: "I was there too! The sky was incredible last night.",
    createdAt: "45m ago",
    likes: 3,
  },
  {
    id: "c3",
    author: users[3],
    content: "This makes me want to go for a jog right now!",
    createdAt: "30m ago",
    likes: 2,
  },
]

export const conversations: ChatConversation[] = [
  {
    id: "ch1",
    type: "group",
    name: "English Study Group",
    members: [users[0], users[1], users[2], users[3]],
    lastMessage: "Sarah: Let's meet at 7pm tomorrow!",
    lastMessageTime: "10m ago",
    unread: 3,
  },
  {
    id: "ch2",
    type: "dm",
    name: "Sarah Chen",
    members: [users[0], users[1]],
    lastMessage: "Thanks for the tip! Really helpful.",
    lastMessageTime: "1h ago",
    unread: 0,
  },
  {
    id: "ch3",
    type: "group",
    name: "Weekend Hikers",
    members: [users[0], users[2], users[4], users[5]],
    lastMessage: "David: Trail photos attached!",
    lastMessageTime: "3h ago",
    unread: 5,
  },
  {
    id: "ch4",
    type: "dm",
    name: "James Park",
    members: [users[0], users[2]],
    lastMessage: "See you at the cafe!",
    lastMessageTime: "1d ago",
    unread: 0,
  },
]

export const chatMessages: ChatMessage[] = [
  { id: "m1", sender: users[1], content: "Hey everyone! Ready for tomorrow's study session?", timestamp: "6:30 PM", isOwn: false },
  { id: "m2", sender: users[0], content: "Yes! I've been reviewing phrasal verbs all week.", timestamp: "6:32 PM", isOwn: true },
  { id: "m3", sender: users[2], content: "Same here. Should we focus on listening practice this time?", timestamp: "6:35 PM", isOwn: false },
  { id: "m4", sender: users[1], content: "Great idea! I'll bring some podcast clips we can work through together.", timestamp: "6:38 PM", isOwn: false },
  { id: "m5", sender: users[0], content: "Perfect. What time works for everyone?", timestamp: "6:40 PM", isOwn: true },
  { id: "m6", sender: users[3], content: "How about 7pm at the usual spot?", timestamp: "6:42 PM", isOwn: false },
  { id: "m7", sender: users[1], content: "Let's meet at 7pm tomorrow!", timestamp: "6:45 PM", isOwn: false },
]
