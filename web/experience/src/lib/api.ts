export const API_BASE_URL = process.env.NEXT_PUBLIC_LMS_API_URL || "http://localhost:3002";
export const CMS_API_URL = process.env.NEXT_PUBLIC_CMS_API_URL || "http://localhost:3001";

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
    type: 'description' | 'media' | 'quiz' | 'fill-in-the-blanks' | 'matching' | 'ordering' | 'short-answer';
    title?: string;
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
    async getCatalog(orgId?: string): Promise<Course[]> {
        const query = orgId ? `?organization_id=${orgId}` : '';
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

    async enroll(courseId: string, userId: string): Promise<void> {
        return apiFetch('/enroll', {
            method: 'POST',
            body: JSON.stringify({ course_id: courseId, user_id: userId })
        });
    },

    async getEnrollments(userId: string): Promise<Enrollment[]> {
        return apiFetch(`/enrollments/${userId}`);
    },

    async submitScore(userId: string, courseId: string, lessonId: string, score: number): Promise<UserGrade> {
        return apiFetch('/grades', {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, course_id: courseId, lesson_id: lessonId, score })
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
    }
};
