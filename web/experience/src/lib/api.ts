const getApiBaseUrl = (defaultPort: string, envVar?: string) => {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        return `${protocol}//${hostname}:${defaultPort}`;
    }
    return envVar || `http://localhost:${defaultPort}`;
};

export const getLmsApiUrl = () => getApiBaseUrl("3002", process.env.NEXT_PUBLIC_LMS_API_URL);
export const getCmsApiUrl = () => getApiBaseUrl("3001", process.env.NEXT_PUBLIC_CMS_API_URL);

export const getImageUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/uploads') ? path.replace('/uploads', '/assets') : path;
    const finalPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
    return `${getCmsApiUrl()}${finalPath}`;
};

export interface Organization {
    id: string;
    name: string;
    logo_url?: string;
    favicon_url?: string;
    platform_name?: string;
    primary_color?: string;
    secondary_color?: string;
}
export interface Recommendation {
    title: string;
    description: string;
    lesson_id: string | null;
    priority: "high" | "medium" | "low";
    reason: string;
}

export interface RecommendationResponse {
    recommendations: Recommendation[];
}

export interface AudioGradingResponse {
    score: number;
    found_keywords: string[];
    feedback: string;
}

export interface Course {
    id: string;
    title: string;
    description?: string;
    instructor_id: string;
    passing_percentage: number;
    certificate_template?: string;
    pacing_mode: string;
    start_date?: string;
    end_date?: string;
    created_at: string;
}

export interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correct: number[];
    type?: 'multiple-choice' | 'true-false' | 'multiple-select';
}

export interface Block {
    id: string;
    type: 'description' | 'media' | 'quiz' | 'fill-in-the-blanks' | 'matching' | 'ordering' | 'short-answer' | 'code' | 'hotspot' | 'memory-match' | 'document' | 'audio-response' | 'video_marker';
    title: string;
    content?: string;
    url?: string;
    media_type?: 'video' | 'audio';
    config?: Record<string, unknown>;
    quiz_data?: {
        questions: QuizQuestion[];
    };
    pairs?: { left: string; right: string }[];
    items?: string[];
    prompt?: string;
    correctAnswers?: string[];
    instructions?: string;
    initialCode?: string;
    keywords?: string[];
    timeLimit?: number;
    description?: string;
    imageUrl?: string;
    hotspots?: {
        id: string;
        x: number;
        y: number;
        radius: number;
        label: string;
    }[];
    metadata?: any;
}

export interface Lesson {
    id: string;
    module_id: string;
    title: string;
    content_type: string;
    content_url?: string;
    summary?: string;
    transcription?: {
        en?: string;
        es?: string;
        cues?: { start: number; end: number; text: string }[];
    } | null;
    metadata?: {
        blocks: Block[];
    };
    is_graded: boolean;
    grading_category_id: string | null;
    max_attempts: number | null;
    allow_retry: boolean;
    position: number;
    due_date?: string;
    important_date_type?: 'exam' | 'assignment' | 'milestone' | 'live-session';
    created_at: string;
}

export interface GradingCategory {
    id: string;
    course_id: string;
    name: string;
    weight: number;
    drop_count: number;
}

export interface UserGrade {
    id: string;
    user_id: string;
    course_id: string;
    lesson_id: string;
    score: number;
    attempts_count: number;
    metadata: Record<string, unknown>;
    created_at: string;
}

export interface User {
    id: string;
    email: string;
    full_name: string;
    role: string;
    organization_id: string;
    xp?: number;
    level?: number;
    avatar_url?: string;
    bio?: string;
    language?: string;
}

export interface Notification {
    id: string;
    title: string;
    message: string;
    notification_type: string;
    is_read: boolean;
    link_url?: string;
    created_at: string;
}

export interface AuthResponse {
    user: User;
    token: string;
}

export interface AuthPayload {
    email: string;
    password?: string;
    full_name?: string;
    organization_name?: string;
}

export interface Enrollment {
    id: string;
    user_id: string;
    course_id: string;
    enrolled_at: string;
}

export interface Module {
    id: string;
    course_id: string;
    title: string;
    position: number;
    lessons: Lesson[];
}

// Discussion Forums Types
export interface DiscussionThread {
    id: string;
    organization_id: string;
    course_id: string;
    lesson_id?: string;
    author_id: string;
    title: string;
    content: string;
    is_pinned: boolean;
    is_locked: boolean;
    view_count: number;
    created_at: string;
    updated_at: string;
}

export interface ThreadWithAuthor {
    id: string;
    organization_id: string;
    course_id: string;
    lesson_id?: string;
    author_id: string;
    title: string;
    content: string;
    is_pinned: boolean;
    is_locked: boolean;
    view_count: number;
    created_at: string;
    updated_at: string;
    author_name: string;
    author_avatar?: string;
    post_count: number;
    has_endorsed_answer: boolean;
}

export interface DiscussionPost {
    id: string;
    organization_id: string;
    thread_id: string;
    parent_post_id?: string;
    author_id: string;
    content: string;
    upvotes: number;
    is_endorsed: boolean;
    created_at: string;
    updated_at: string;
}

export interface PostWithAuthor {
    id: string;
    organization_id: string;
    thread_id: string;
    parent_post_id?: string;
    author_id: string;
    content: string;
    upvotes: number;
    is_endorsed: boolean;
    created_at: string;
    updated_at: string;
    author_name: string;
    author_avatar?: string;
    user_vote?: 'upvote' | 'downvote';
    replies: PostWithAuthor[];
}

export interface CreateThreadPayload {
    title: string;
    content: string;
    lesson_id?: string;
}

export interface CreatePostPayload {
    content: string;
    parent_post_id?: string;
}

export interface VotePayload {
    vote_type: 'upvote' | 'downvote';
}

export interface CourseAnnouncement {
    id: string;
    organization_id: string;
    course_id: string;
    author_id: string;
    title: string;
    content: string;
    is_pinned: boolean;
    created_at: string;
    updated_at: string;
}

export interface AnnouncementWithAuthor extends CourseAnnouncement {
    author_name: string;
    author_avatar?: string;
}

export interface CreateAnnouncementPayload {
    title: string;
    content: string;
    is_pinned?: boolean;
}

export interface UpdateAnnouncementPayload {
    title?: string;
    content?: string;
    is_pinned?: boolean;
}



const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('experience_token') : null;

const apiFetch = async (url: string, options: RequestInit = {}, isCMS: boolean = false) => {
    const token = getToken();
    const baseUrl = isCMS ? getCmsApiUrl() : getLmsApiUrl();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    const response = await fetch(`${baseUrl}${url}`, { ...options, headers });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'An error occurred');
    }
    if (response.status === 204) return;
    return response.json();
};

export const lmsApi = {
    async getCatalog(orgId?: string, userId?: string): Promise<Course[]> {
        const params = new URLSearchParams();
        if (orgId) params.append('organization_id', orgId);
        if (userId) params.append('user_id', userId);
        const query = params.toString() ? `?${params.toString()}` : '';
        return apiFetch(`/catalog${query}`);
    },

    async getCourseOutline(courseId: string): Promise<{ course: Course, modules: Module[], grading_categories: GradingCategory[], organization: Organization }> {
        return apiFetch(`/courses/${courseId}/outline`);
    },

    async getLesson(id: string): Promise<Lesson> {
        return apiFetch(`/lessons/${id}`);
    },

    async register(payload: AuthPayload): Promise<AuthResponse> {
        return apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async login(payload: AuthPayload): Promise<AuthResponse> {
        return apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async getMe(): Promise<User> {
        return apiFetch('/auth/me', {}, true); // isCMS = true
    },

    initSSOLogin(orgId: string): void {
        window.location.href = `${getCmsApiUrl()}/auth/sso/login/${orgId}`;
    },

    async enroll(courseId: string, userId: string): Promise<void> {
        return apiFetch('/enroll', {
            method: 'POST',
            body: JSON.stringify({ course_id: courseId, user_id: userId })
        });
    },

    async getEnrollments(userId: string): Promise<Enrollment[]> {
        return apiFetch(`/enrollments/${userId}`);
    },

    async submitScore(userId: string, course_id: string, lessonId: string, score: number, metadata: Record<string, unknown> = {}): Promise<UserGrade> {
        return apiFetch('/grades', {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, course_id, lesson_id: lessonId, score, metadata })
        });
    },

    async getUserGrades(userId: string, courseId: string): Promise<UserGrade[]> {
        return apiFetch(`/users/${userId}/courses/${courseId}/grades`);
    },

    async getGamification(userId: string): Promise<{ points: number, level: number, badges: { id: string, name: string, description: string, earned_at: string }[] }> {
        return apiFetch(`/users/${userId}/gamification`);
    },

    async getLeaderboard(): Promise<User[]> {
        return apiFetch('/analytics/leaderboard');
    },

    async getBranding(orgId: string): Promise<Organization> {
        return apiFetch(`/organizations/${orgId}/branding`, {}, true);
    },

    async updateUser(userId: string, payload: { full_name?: string, avatar_url?: string, bio?: string, language?: string }): Promise<void> {
        return apiFetch(`/users/${userId}`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async uploadAsset(file: File): Promise<{ id: string, filename: string, url: string }> {
        const formData = new FormData();
        formData.append('file', file);
        const token = getToken();
        return fetch(`${getCmsApiUrl()}/assets/upload`, {
            method: 'POST',
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: formData
        }).then(res => res.json());
    },

    async recordInteraction(lessonId: string, payload: { video_timestamp?: number, event_type: string, metadata?: any }): Promise<void> {
        return apiFetch(`/lessons/${lessonId}/interactions`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async getHeatmap(lessonId: string): Promise<{ second: number, count: number }[]> {
        return apiFetch(`/lessons/${lessonId}/heatmap`);
    },

    async getNotifications(): Promise<Notification[]> {
        return apiFetch('/notifications');
    },

    async markNotificationAsRead(id: string): Promise<void> {
        return apiFetch(`/notifications/${id}/read`, {
            method: 'POST'
        });
    },
    async getRecommendations(courseId: string): Promise<RecommendationResponse> {
        return apiFetch(`/courses/${courseId}/recommendations`);
    },
    async evaluateAudio(transcript: string, prompt: string, keywords: string[]): Promise<AudioGradingResponse> {
        return apiFetch('/audio/evaluate', {
            method: 'POST',
            body: JSON.stringify({ transcript, prompt, keywords })
        });
    },
    async evaluateAudioFile(file: Blob, prompt: string, keywords: string[]): Promise<AudioGradingResponse> {
        const formData = new FormData();
        formData.append('file', file, 'recorded_audio.webm');
        formData.append('prompt', prompt);
        formData.append('keywords', JSON.stringify(keywords));

        const token = getToken();
        return fetch(`${getLmsApiUrl()}/audio/evaluate-file`, {
            method: 'POST',
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: formData
        }).then(async res => {
            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: 'Audio evaluation failed' }));
                throw new Error(err.message || 'Audio evaluation failed');
            }
            return res.json();
        });
    },
    async chatWithTutor(lessonId: string, message: string, sessionId?: string): Promise<{ response: string, session_id: string }> {
        return apiFetch(`/lessons/${lessonId}/chat`, {
            method: 'POST',
            body: JSON.stringify({ message, session_id: sessionId })
        });
    },
    async getLessonFeedback(lessonId: string): Promise<{ response: string, session_id: string }> {
        return apiFetch(`/lessons/${lessonId}/feedback`);
    },

    // Discussion Forums API
    async getDiscussions(courseId: string, filter?: string, lessonId?: string, page?: number): Promise<ThreadWithAuthor[]> {
        const params = new URLSearchParams();
        if (filter) params.append('filter', filter);
        if (lessonId) params.append('lesson_id', lessonId);
        if (page) params.append('page', page.toString());
        const query = params.toString() ? `?${params.toString()}` : '';
        return apiFetch(`/courses/${courseId}/discussions${query}`);
    },

    async createThread(courseId: string, payload: CreateThreadPayload): Promise<DiscussionThread> {
        return apiFetch(`/courses/${courseId}/discussions`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async getThreadDetail(threadId: string): Promise<{ thread: ThreadWithAuthor, posts: PostWithAuthor[] }> {
        return apiFetch(`/discussions/${threadId}`);
    },

    async createPost(threadId: string, payload: CreatePostPayload): Promise<DiscussionPost> {
        return apiFetch(`/discussions/${threadId}/posts`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async votePost(postId: string, voteType: 'upvote' | 'downvote'): Promise<void> {
        return apiFetch(`/posts/${postId}/vote`, {
            method: 'POST',
            body: JSON.stringify({ vote_type: voteType })
        });
    },

    async endorsePost(postId: string): Promise<void> {
        return apiFetch(`/posts/${postId}/endorse`, {
            method: 'POST'
        });
    },

    async pinThread(threadId: string): Promise<void> {
        return apiFetch(`/discussions/${threadId}/pin`, {
            method: 'POST'
        });
    },

    async lockThread(threadId: string): Promise<void> {
        return apiFetch(`/discussions/${threadId}/lock`, {
            method: 'POST'
        });
    },

    async subscribeThread(threadId: string): Promise<void> {
        return apiFetch(`/discussions/${threadId}/subscribe`, {
            method: 'POST'
        });
    },

    async unsubscribeThread(threadId: string): Promise<void> {
        return apiFetch(`/discussions/${threadId}/unsubscribe`, {
            method: 'POST'
        });
    },

    // Announcements API
    async getAnnouncements(courseId: string): Promise<AnnouncementWithAuthor[]> {
        return apiFetch(`/courses/${courseId}/announcements`);
    },

    async createAnnouncement(courseId: string, payload: CreateAnnouncementPayload): Promise<CourseAnnouncement> {
        return apiFetch(`/courses/${courseId}/announcements`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async updateAnnouncement(id: string, payload: UpdateAnnouncementPayload): Promise<CourseAnnouncement> {
        return apiFetch(`/announcements/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    },

    async deleteAnnouncement(id: string): Promise<void> {
        return apiFetch(`/announcements/${id}`, {
            method: 'DELETE'
        });
    }
};
