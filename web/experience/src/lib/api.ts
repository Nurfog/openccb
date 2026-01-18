export const API_BASE_URL = process.env.NEXT_PUBLIC_LMS_API_URL || "http://localhost:3002";
export const CMS_API_URL = process.env.NEXT_PUBLIC_CMS_API_URL || "http://localhost:3001";

export const getImageUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/uploads') ? path.replace('/uploads', '/assets') : path;
    const finalPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
    return `${CMS_API_URL}${finalPath}`;
};

export interface Organization {
    id: string;
    name: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
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
    type: 'description' | 'media' | 'quiz' | 'fill-in-the-blanks' | 'matching' | 'ordering' | 'short-answer' | 'code' | 'hotspot' | 'memory-match' | 'document';
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
    enroled_at: string;
}

export interface Module {
    id: string;
    course_id: string;
    title: string;
    position: number;
    lessons: Lesson[];
}

const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('experience_token') : null;

const apiFetch = async (url: string, options: RequestInit = {}, isCMS: boolean = false) => {
    const token = getToken();
    const baseUrl = isCMS ? CMS_API_URL : API_BASE_URL;
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

    async getCourseOutline(courseId: string): Promise<Course & { modules: Module[], grading_categories: GradingCategory[] }> {
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
        window.location.href = `${CMS_API_URL}/auth/sso/login/${orgId}`;
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
        return fetch(`${CMS_API_URL}/assets/upload`, {
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
    }
};
