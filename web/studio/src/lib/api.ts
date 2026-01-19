export const API_BASE_URL = process.env.NEXT_PUBLIC_CMS_API_URL || "http://localhost:3001";

export const getImageUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    // Map /uploads to /assets if backend stores relative paths
    // The main.rs serves "uploads" dir at "/assets" route
    const cleanPath = path.startsWith('/uploads') ? path.replace('/uploads', '/assets') : path;
    const finalPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
    return `${API_BASE_URL}${finalPath}`;
};

export interface Course {
    id: string;
    title: string;
    description?: string;
    instructor_id: string;
    pacing_mode: 'self_paced' | 'instructor_led';
    organization_id: string;
    start_date?: string;
    end_date?: string;
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

export interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correct: number[];
    type?: 'multiple-choice' | 'true-false' | 'multiple-select';
}

export interface Block {
    id: string;
    type: 'description' | 'media' | 'quiz' | 'fill-in-the-blanks' | 'matching' | 'ordering' | 'short-answer' | 'document' | 'video_marker';
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
    markers?: {
        timestamp: number;
        question: string;
        options: string[];
        correctIndex: number;
    }[];
}

export interface Lesson {
    id: string;
    module_id: string;
    title: string;
    content_type: string;
    content_url?: string;
    metadata?: {
        blocks: Block[];
    };
    is_graded: boolean;
    grading_category_id: string | null;
    max_attempts: number | null;
    allow_retry: boolean;
    due_date?: string;
    important_date_type?: 'exam' | 'assignment' | 'milestone' | 'live-session';
    summary?: string;
    transcription?: {
        en?: string;
        es?: string;
        cues?: { start: number; end: number; text: string }[];
    } | null;
    transcription_status?: 'idle' | 'queued' | 'processing' | 'completed' | 'failed';
    created_at: string;
}

export interface Organization {
    id: string;
    name: string;
    domain?: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    certificate_template?: string;
    created_at: string;
    updated_at: string;
}

export interface BrandingPayload {
    primary_color?: string;
    secondary_color?: string;
}

export interface User {
    id: string;
    email: string;
    full_name: string;
    role: string;
    organization_id?: string;
    avatar_url?: string;
    bio?: string;
    language?: string;
}

export interface OrganizationSSOConfig {
    organization_id: string;
    issuer_url: string;
    client_id: string;
    client_secret: string;
    enabled: boolean;
    created_at: string;
    updated_at: string;
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
    changes: Record<string, unknown>;
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

export interface CohortData {
    period: string;
    count: number;
    completion_rate: number;
}

export interface RetentionData {
    lesson_id: string;
    lesson_title: string;
    student_count: number;
}

export interface AdvancedAnalytics {
    cohorts: CohortData[];
    retention: RetentionData[];
}

export interface Webhook {
    id: string;
    organization_id: string;
    url: string;
    events: string[];
    secret?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateWebhookPayload {
    url: string;
    events: string[];
    secret?: string;
}

export interface Asset {
    id: string;
    course_id: string | null;
    filename: string;
    storage_path: string;
    mimetype: string;
    size_bytes: number;
    created_at: string;
}

const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('studio_token') : null;
const getSelectedOrgId = () => typeof window !== 'undefined' ? localStorage.getItem('studio_selected_org_id') : null;

const apiFetch = (url: string, options: RequestInit = {}) => {
    const token = getToken();
    const selectedOrgId = getSelectedOrgId();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(selectedOrgId ? { 'X-Organization-Id': selectedOrgId } : {})
    };

    return fetch(`${API_BASE_URL}${url}`, { ...options, headers }).then(async res => {
        if (!res.ok) {
            const text = await res.text();
            try {
                const json = JSON.parse(text);
                return Promise.reject(new Error(json.message || 'An error occurred'));
            } catch {
                return Promise.reject(new Error(text || res.statusText));
            }
        }
        // Handle no-content responses
        if (res.status === 204) return;
        return res.json();
    });
};

export const cmsApi = {
    // Organization
    getOrganization: (): Promise<Organization> => apiFetch('/organization'),
    getOrganizations: (): Promise<Organization[]> => apiFetch('/organizations'),
    createOrganization: (name: string, domain?: string): Promise<Organization> => apiFetch('/organizations', { method: 'POST', body: JSON.stringify({ name, domain }) }),

    // Auth
    register: (payload: AuthPayload): Promise<AuthResponse> => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
    login: (payload: AuthPayload): Promise<AuthResponse> => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
    getMe: (): Promise<User> => apiFetch('/auth/me'),

    // Courses
    getCourses: (): Promise<Course[]> => apiFetch('/courses'),
    createCourse: (title: string, organizationId?: string): Promise<Course> => apiFetch('/courses', { method: 'POST', body: JSON.stringify({ title, organization_id: organizationId }) }),
    getCourse: (id: string): Promise<Course> => apiFetch(`/courses/${id}`),
    getCourseWithFullOutline: (id: string): Promise<Course> => apiFetch(`/courses/${id}/outline`),
    updateCourse: (id: string, payload: Partial<Course>): Promise<Course> => apiFetch(`/courses/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    publishCourse: (id: string, targetOrganizationId?: string): Promise<void> => apiFetch(`/courses/${id}/publish`, { method: 'POST', body: JSON.stringify({ target_organization_id: targetOrganizationId }) }),

    // Modules & Lessons
    createModule: (course_id: string, title: string, position: number): Promise<Module> => apiFetch('/modules', { method: 'POST', body: JSON.stringify({ course_id, title, position }) }),
    updateModule: (id: string, payload: Partial<Module>): Promise<Module> => apiFetch(`/modules/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    createLesson: (module_id: string, title: string, content_type: string, position: number): Promise<Lesson> => apiFetch('/lessons', { method: 'POST', body: JSON.stringify({ module_id, title, content_type, position }) }),
    getLesson: (id: string): Promise<Lesson> => apiFetch(`/lessons/${id}`),
    updateLesson: (id: string, payload: Partial<Lesson>): Promise<Lesson> => apiFetch(`/lessons/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    summarizeLesson: (id: string): Promise<Lesson> => apiFetch(`/lessons/${id}/summarize`, { method: 'POST' }),
    generateQuiz: (id: string): Promise<Block[]> => apiFetch(`/lessons/${id}/generate-quiz`, { method: 'POST' }),
    deleteModule: (id: string): Promise<void> => apiFetch(`/modules/${id}`, { method: 'DELETE' }),
    deleteLesson: (id: string): Promise<void> => apiFetch(`/lessons/${id}`, { method: 'DELETE' }),
    reorderModules: (payload: { items: { id: string, position: number }[] }): Promise<void> => apiFetch('/modules/reorder', { method: 'POST', body: JSON.stringify(payload) }),
    reorderLessons: (payload: { items: { id: string, position: number }[] }): Promise<void> => apiFetch('/lessons/reorder', { method: 'POST', body: JSON.stringify(payload) }),

    // Grading
    getGradingCategories: (courseId: string): Promise<GradingCategory[]> => apiFetch(`/courses/${courseId}/grading`),
    createGradingCategory: (course_id: string, name: string, weight: number): Promise<GradingCategory> => apiFetch('/grading', { method: 'POST', body: JSON.stringify({ course_id, name, weight, drop_count: 0 }) }),
    deleteGradingCategory: (id: string): Promise<void> => apiFetch(`/grading/${id}`, { method: 'DELETE' }),

    // Admin & Analytics
    getAuditLogs: (): Promise<AuditLog[]> => apiFetch('/audit-logs'),
    getCourseAnalytics: (id: string): Promise<CourseAnalytics> => apiFetch(`/courses/${id}/analytics`),
    getAdvancedAnalytics: (id: string): Promise<AdvancedAnalytics> => apiFetch(`/courses/${id}/analytics/advanced`),
    getLessonHeatmap: (lessonId: string): Promise<{ second: number, count: number }[]> => apiFetch(`/lessons/${lessonId}/heatmap`),
    exportCourse: (id: string): Promise<Record<string, unknown>> => apiFetch(`/courses/${id}/export`),
    importCourse: (data: Record<string, unknown>): Promise<Course> => apiFetch(`/courses/import`, {
        method: 'POST',
        body: JSON.stringify(data)
    }),

    async generateCourse(prompt: string, targetOrgId?: string): Promise<Course> {
        return apiFetch(`/courses/generate`, {
            method: 'POST',
            body: JSON.stringify({ prompt, target_organization_id: targetOrgId })
        });
    },

    // Users
    getAllUsers: (): Promise<User[]> => apiFetch('/users'),
    updateUser: (id: string, payload: { role?: string, organization_id?: string, full_name?: string, avatar_url?: string, bio?: string, language?: string }): Promise<void> => apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

    // Webhooks
    getWebhooks: (): Promise<Webhook[]> => apiFetch('/webhooks'),
    createWebhook: (payload: CreateWebhookPayload): Promise<Webhook> => apiFetch('/webhooks', { method: 'POST', body: JSON.stringify(payload) }),
    deleteWebhook: (id: string): Promise<void> => apiFetch(`/webhooks/${id}`, { method: 'DELETE' }),

    // Assets
    getCourseAssets: (courseId: string): Promise<Asset[]> => apiFetch(`/courses/${courseId}/assets`),
    deleteAsset: (id: string): Promise<void> => apiFetch(`/api/assets/${id}`, { method: 'DELETE' }),
    uploadAsset: (file: File, onProgress?: (pct: number) => void, courseId?: string): Promise<UploadResponse> => {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            if (courseId) formData.append('course_id', courseId);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${API_BASE_URL}/api/assets/upload`);

            const token = getToken();
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            const selectedOrgId = getSelectedOrgId();
            if (selectedOrgId) xhr.setRequestHeader('X-Organization-Id', selectedOrgId);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && onProgress) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    onProgress(percentComplete);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    let msg = 'Upload failed';
                    try {
                        msg = JSON.parse(xhr.responseText).message || msg;
                    } catch { }
                    reject(new Error(msg));
                }
            };

            xhr.onerror = () => reject(new Error('Network error'));
            xhr.send(formData);
        });
    },
    // Organizations Branding
    getOrganizationBranding: (id: string): Promise<Organization> => apiFetch(`/organizations/${id}/branding`),
    updateOrganizationBranding: (id: string, payload: BrandingPayload): Promise<void> => apiFetch(`/organizations/${id}/branding`, { method: 'PUT', body: JSON.stringify(payload) }),
    uploadOrganizationLogo: (id: string, file: File): Promise<UploadResponse> => {
        const formData = new FormData();
        formData.append('file', file);
        const token = getToken();
        const selectedOrgId = getSelectedOrgId();
        const headers: Record<string, string> = {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(selectedOrgId ? { 'X-Organization-Id': selectedOrgId } : {})
        };
        return fetch(`${API_BASE_URL}/organizations/${id}/logo`, {
            method: 'POST',
            headers,
            body: formData,
        }).then(res => {
            if (!res.ok) return res.json().then(err => Promise.reject(new Error(err.message || 'Logo upload failed')));
            return res.json();
        });
    },

    // SSO
    getSSOConfig: (): Promise<OrganizationSSOConfig | null> => apiFetch('/organization/sso'),
    updateSSOConfig: (payload: Partial<OrganizationSSOConfig>): Promise<OrganizationSSOConfig> => apiFetch('/organization/sso', { method: 'PUT', body: JSON.stringify(payload) }),
    initSSOLogin: (orgId: string): void => {
        window.location.href = `${API_BASE_URL}/auth/sso/login/${orgId}`;
    },

    // Background Tasks
    getBackgroundTasks: (): Promise<BackgroundTask[]> => apiFetch('/tasks'),
    retryTask: (id: string): Promise<void> => apiFetch(`/tasks/${id}/retry`, { method: 'POST' }),
    cancelTask: (id: string): Promise<void> => apiFetch(`/tasks/${id}`, { method: 'DELETE' }),
};

export interface BackgroundTask {
    id: string;
    title: string;
    course_title?: string;
    transcription_status?: 'idle' | 'queued' | 'processing' | 'failed' | 'completed';
    updated_at: string;
}