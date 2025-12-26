export const API_BASE_URL = process.env.NEXT_PUBLIC_CMS_API_URL || "http://localhost:3001";

export interface Course {
    id: string;
    title: string;
    description?: string;
    instructor_id: string;
    passing_percentage: number;
    certificate_template?: string;
    created_at: string;
    updated_at: string;
    modules?: Module[];
}

export interface Module {
    id: string;
    course_id: string;
    title: string;
    position: number;
    lessons: Lesson[];
}

export interface Block {
    id: string;
    type: 'description' | 'media' | 'quiz' | 'fill-in-the-blanks' | 'matching' | 'ordering' | 'short-answer';
    title?: string;
    content?: string;
    url?: string;
    media_type?: 'video' | 'audio';
    config?: any;
    quiz_data?: {
        questions: any[];
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
    metadata?: {
        blocks: Block[];
    };
    is_graded: boolean;
    grading_category_id: string | null;
    max_attempts: number | null;
    allow_retry: boolean;
    transcription?: any;
}

export interface User {
    id: string;
    email: string;
    full_name: string;
    role: string;
}

export interface AuthResponse {
    user: User;
    token: string;
}

export interface AuthPayload {
    email: string;
    password?: string;
    full_name?: string;
    role?: 'instructor' | 'admin';
    organization_name?: string;
}

export interface UploadResponse {
    id: string;
    filename: string;
    url: string;
}

export interface GradingCategory {
    id: string;
    course_id: string;
    name: string;
    weight: number;
    drop_count: number;
}

export interface AuditLog {
    id: string;
    user_id: string;
    user_full_name: string | null;
    action: string;
    entity_type: string;
    entity_id: string;
    changes: any;
    created_at: string;
}

export interface CourseAnalytics {
    course_id: string;
    total_enrollments: number;
    average_score: number;
    lessons: {
        lesson_id: string;
        lesson_title: string;
        average_score: number;
        submission_count: number;
    }[];
}

const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('studio_token') : null;

const apiFetch = (url: string, options: RequestInit = {}) => {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    return fetch(`${API_BASE_URL}${url}`, { ...options, headers }).then(res => {
        if (!res.ok) {
            return res.json().then(err => Promise.reject(err.message || 'An error occurred'));
        }
        // Handle no-content responses
        if (res.status === 204) return;
        return res.json();
    });
};

export const cmsApi = {
    // Auth
    register: (payload: AuthPayload): Promise<AuthResponse> => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
    login: (payload: AuthPayload): Promise<AuthResponse> => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),

    // Courses
    getCourses: (): Promise<Course[]> => apiFetch('/courses'),
    createCourse: (title: string): Promise<Course> => apiFetch('/courses', { method: 'POST', body: JSON.stringify({ title }) }),
    getCourse: (id: string): Promise<Course> => apiFetch(`/courses/${id}`),
    getCourseWithFullOutline: (id: string): Promise<Course> => apiFetch(`/courses/${id}/outline`),
    updateCourse: (id: string, payload: Partial<Course>): Promise<Course> => apiFetch(`/courses/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    publishCourse: (id: string): Promise<void> => apiFetch(`/courses/${id}/publish`, { method: 'POST' }),

    // Modules & Lessons
    createModule: (course_id: string, title: string, position: number): Promise<Module> => apiFetch('/modules', { method: 'POST', body: JSON.stringify({ course_id, title, position }) }),
    createLesson: (module_id: string, title: string, content_type: string, position: number): Promise<Lesson> => apiFetch('/lessons', { method: 'POST', body: JSON.stringify({ module_id, title, content_type, position }) }),
    getLesson: (id: string): Promise<Lesson> => apiFetch(`/lessons/${id}`),
    updateLesson: (id: string, payload: Partial<Lesson>): Promise<Lesson> => apiFetch(`/lessons/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

    // Grading
    getGradingCategories: (courseId: string): Promise<GradingCategory[]> => apiFetch(`/courses/${courseId}/grading`),
    createGradingCategory: (course_id: string, name: string, weight: number): Promise<GradingCategory> => apiFetch('/grading', { method: 'POST', body: JSON.stringify({ course_id, name, weight, drop_count: 0 }) }),
    deleteGradingCategory: (id: string): Promise<void> => apiFetch(`/grading/${id}`, { method: 'DELETE' }),

    // Admin & Analytics
    getAuditLogs: (): Promise<AuditLog[]> => apiFetch('/audit-logs'),
    getCourseAnalytics: (id: string): Promise<CourseAnalytics> => apiFetch(`/courses/${id}/analytics`),

    // Assets
    uploadAsset: (file: File): Promise<UploadResponse> => {
        const formData = new FormData();
        formData.append('file', file);

        const token = getToken();
        const headers: Record<string, string> = {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };

        // Note: We don't set 'Content-Type' for multipart/form-data.
        // The browser will set it automatically with the correct boundary.
        return fetch(`${API_BASE_URL}/assets/upload`, {
            method: 'POST',
            headers,
            body: formData,
        }).then(res => {
            if (!res.ok) return res.json().then(err => Promise.reject(new Error(err.message || 'Upload failed')));
            return res.json();
        });
    },
};