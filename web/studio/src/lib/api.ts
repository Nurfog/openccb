const getApiBaseUrl = (defaultPort: string, envVar?: string) => {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        // Detect if we are on a custom domain or IP
        const protocol = window.location.protocol;
        return `${protocol}//${hostname}:${defaultPort}`;
    }
    return envVar || `http://localhost:${defaultPort}`;
};

export const API_BASE_URL = getApiBaseUrl("3001", process.env.NEXT_PUBLIC_CMS_API_URL);
export const LMS_API_BASE_URL = getApiBaseUrl("3002", process.env.NEXT_PUBLIC_LMS_API_URL);

export const getImageUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    // Map uploads to assets if backend stores relative paths
    // The main.rs serves "uploads" dir at "/assets" route
    let cleanPath = path;
    if (cleanPath.startsWith('uploads/')) cleanPath = '/' + cleanPath.replace('uploads/', 'assets/');
    if (cleanPath.startsWith('/uploads/')) cleanPath = cleanPath.replace('/uploads/', '/assets/');

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
    price: number;
    currency: string;
    marketing_metadata?: {
        objectives?: string;
        requirements?: string;
        duration?: string;
        modules_summary?: string;
        certification_info?: string;
    };
    course_image_url?: string;
    generation_status?: 'idle' | 'queued' | 'processing' | 'completed' | 'error';
    generation_progress?: number;
    generation_error?: string;
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
    type: 'description' | 'media' | 'quiz' | 'fill-in-the-blanks' | 'matching' | 'ordering' | 'short-answer' | 'document' | 'video_marker' | 'audio-response' | 'memory-match' | 'hotspot' | 'peer-review';
    title?: string;
    content?: string;
    url?: string;
    description?: string; // For hotspot or general info
    media_type?: 'video' | 'audio';
    config?: Record<string, unknown>;
    quiz_data?: {
        questions: QuizQuestion[];
    };
    pairs?: { left: string; right: string; id?: string }[];
    items?: string[];
    prompt?: string;
    correctAnswers?: string[];
    keywords?: string[];
    timeLimit?: number;
    markers?: {
        timestamp: number;
        question: string;
        options: string[];
        correctIndex: number;
    }[];
    hotspots?: {
        id: string;
        x: number;
        y: number;
        radius: number;
        label: string;
    }[];
    imageUrl?: string;
    reviewCriteria?: string;
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
    is_previewable: boolean;
    created_at: string;
}

export interface Organization {
    id: string;
    name: string;
    domain?: string;
    logo_url?: string;
    favicon_url?: string;
    platform_name?: string;
    primary_color?: string;
    secondary_color?: string;
    certificate_template?: string;
    logo_variant?: string;
    created_at: string;
    updated_at: string;
}

export interface BrandingPayload {
    name?: string;
    primary_color?: string;
    secondary_color?: string;
    platform_name?: string;
    logo_variant?: string;
}

export interface BrandingResponse {
    logo_url?: string;
    favicon_url?: string;
    platform_name?: string;
    logo_variant?: string;
    primary_color: string;
    secondary_color: string;
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

export interface ProvisionPayload {
    org_name: string;
    org_domain?: string;
    admin_email: string;
    admin_password: string;
    admin_full_name: string;
}

export interface UserCreatePayload {
    email: string;
    password: string;
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
    mimetype?: string;
    size_bytes?: number;
    logo_url?: string;
    favicon_url?: string;
}

export interface GradingCategory {
    id: string;
    course_id: string;
    name: string;
    weight: number;
    drop_count: number;
}

// Content Libraries
export interface LibraryBlock {
    id: string;
    organization_id: string;
    created_by: string;
    name: string;
    description?: string;
    block_type: string;
    block_data: Block;
    tags?: string[];
    usage_count: number;
    created_at: string;
    updated_at: string;
}

export interface CreateLibraryBlockPayload {
    name: string;
    description?: string;
    block_type: string;
    block_data: Block;
    tags?: string[];
}

export interface UpdateLibraryBlockPayload {
    name?: string;
    description?: string;
    tags?: string[];
}

export interface LibraryBlockFilters {
    type?: string;
    tags?: string;
    search?: string;
}

// ==================== Advanced Grading / Rubrics ====================

export interface Rubric {
    id: string;
    organization_id: string;
    course_id: string | null;
    created_by: string;
    name: string;
    description: string | null;
    total_points: number;
    created_at: string;
    updated_at: string;
}

export interface RubricCriterion {
    id: string;
    rubric_id: string;
    name: string;
    description: string | null;
    max_points: number;
    position: number;
    created_at: string;
}

export interface RubricLevel {
    id: string;
    criterion_id: string;
    name: string;
    description: string | null;
    points: number;
    position: number;
    created_at: string;
}

export interface RubricWithDetails {
    id: string;
    organization_id: string;
    course_id: string | null;
    created_by: string;
    name: string;
    description: string | null;
    total_points: number;
    created_at: string;
    updated_at: string;
    criteria: CriterionWithLevels[];
}

export interface CriterionWithLevels {
    id: string;
    rubric_id: string;
    name: string;
    description: string | null;
    max_points: number;
    position: number;
    created_at: string;
    levels: RubricLevel[];
}

export interface CreateRubricPayload {
    name: string;
    description?: string;
    course_id?: string;
}

export interface UpdateRubricPayload {
    name?: string;
    description?: string;
}

export interface CreateCriterionPayload {
    name: string;
    description?: string;
    max_points: number;
    position?: number;
}

export interface UpdateCriterionPayload {
    name?: string;
    description?: string;
    max_points?: number;
    position?: number;
}

export interface CreateLevelPayload {
    name: string;
    description?: string;
    points: number;
    position?: number;
}

export interface UpdateLevelPayload {
    name?: string;
    description?: string;
    points?: number;
    position?: number;
}
// ==================== Learning Sequences / Dependencies ====================

export interface LessonDependency {
    id: string;
    organization_id: string;
    lesson_id: string;
    prerequisite_lesson_id: string;
    min_score_percentage: number | null;
    created_at: string;
}

export interface AssignDependencyPayload {
    prerequisite_lesson_id: string;
    min_score_percentage?: number;
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

export interface DropoutRisk {
    id: string;
    organization_id: string;
    course_id: string;
    user_id: string;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    reasons?: { metric: string, value: number, description: string }[];
    last_calculated_at: string;
    user_full_name?: string; // Optional for UI display
    user_email?: string;
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
    organization_id: string;
    uploaded_by: string | null;
    course_id: string | null;
    filename: string;
    storage_path: string;
    mimetype: string;
    size_bytes: number;
    created_at: string;
}

export interface AssetFilters {
    mimetype?: string;
    course_id?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export interface Cohort {
    id: string;
    organization_id: string;
    name: string;
    description?: string;
    created_at: string;
    updated_at: string;
}

export interface UserCohort {
    id: string;
    cohort_id: string;
    user_id: string;
    assigned_at: string;
}

export interface CreateCohortPayload {
    name: string;
    description?: string;
}

export interface AddMemberPayload {
    user_id: string;
}

export interface StudentGradeReport {
    user_id: string;
    full_name: string;
    email: string;
    progress: number;
    average_score: number | null;
    last_active_at: string | null;
}

export interface BulkEnrollResponse {
    successful_emails: string[];
    failed_emails: string[];
    already_enrolled_emails: string[];
}

export interface SubmissionWithReviews {
    id: string;
    user_id: string;
    full_name: string;
    email: string;
    submitted_at: string;
    review_count: number;
    average_score: number | null;
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
    cohort_ids?: string[];
}

export interface AnnouncementWithAuthor extends CourseAnnouncement {
    author_name: string;
    author_avatar?: string;
}

export interface CreateAnnouncementPayload {
    title: string;
    content: string;
    is_pinned?: boolean;
    cohort_ids?: string[];
}

export interface UpdateAnnouncementPayload {
    title?: string;
    content?: string;
    is_pinned?: boolean;
}

export interface CourseSubmission {
    id: string;
    user_id: string;
    course_id: string;
    lesson_id: string;
    content: string;
    submitted_at: string;
}

export interface PeerReview {
    id: string;
    submission_id: string;
    reviewer_id: string;
    score: number;
    feedback: string;
    created_at: string;
}

export interface CourseInstructor {
    id: string;
    course_id: string;
    user_id: string;
    role: 'primary' | 'instructor' | 'assistant';
    created_at: string;
    email: string;
    full_name: string;
}

const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('studio_token') : null;
const getSelectedOrgId = () => typeof window !== 'undefined' ? localStorage.getItem('studio_selected_org_id') : null;

const apiFetch = (url: string, options: RequestInit = {}, isLms: boolean = false) => {
    const token = getToken();
    const selectedOrgId = getSelectedOrgId();
    const baseUrl = isLms ? LMS_API_BASE_URL : API_BASE_URL;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(selectedOrgId ? { 'X-Organization-Id': selectedOrgId } : {})
    };

    return fetch(`${baseUrl}${url}`, { ...options, headers }).then(async res => {
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
    updateOrganization: (id: string, payload: { name?: string, domain?: string }): Promise<Organization> => apiFetch(`/organizations/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    provisionOrganization: (data: ProvisionPayload): Promise<Organization> => apiFetch('/admin/provision', { method: 'POST', body: JSON.stringify(data) }),

    // Auth
    register: (payload: AuthPayload): Promise<AuthResponse> => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
    login: (payload: AuthPayload): Promise<AuthResponse> => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
    getMe: (): Promise<User> => apiFetch('/auth/me'),

    // Organizations Search
    searchOrganizations: (query: string): Promise<{ id: string, name: string, domain?: string }[]> => apiFetch(`/organizations/search?q=${encodeURIComponent(query)}`),
    getBranding: (id: string): Promise<BrandingResponse> => apiFetch(`/organizations/${id}/branding`),

    // Courses
    getCourses: (): Promise<Course[]> => apiFetch('/courses'),
    createCourse: (title: string, organizationId?: string): Promise<Course> => apiFetch('/courses', { method: 'POST', body: JSON.stringify({ title, organization_id: organizationId }) }),
    getCourse: (id: string): Promise<Course> => apiFetch(`/courses/${id}`),
    getCourseWithFullOutline: (id: string): Promise<Course> => apiFetch(`/courses/${id}/outline`),
    updateCourse: (id: string, payload: Partial<Course>): Promise<Course> => apiFetch(`/courses/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    publishCourse: (id: string, targetOrganizationId?: string): Promise<void> => apiFetch(`/courses/${id}/publish`, { method: 'POST', body: JSON.stringify({ target_organization_id: targetOrganizationId }) }),
    getPreviewToken: (id: string): Promise<{ token: string }> => apiFetch(`/courses/${id}/preview-token`, { method: 'POST' }),

    // Team Management
    getCourseTeam: (courseId: string): Promise<CourseInstructor[]> => apiFetch(`/courses/${courseId}/team`),
    addTeamMember: (courseId: string, email: string, role: string): Promise<CourseInstructor> => apiFetch(`/courses/${courseId}/team`, { method: 'POST', body: JSON.stringify({ email, role }) }),
    removeTeamMember: (courseId: string, userId: string): Promise<void> => apiFetch(`/courses/${courseId}/team/${userId}`, { method: 'DELETE' }),
    getUsers: (): Promise<User[]> => apiFetch('/users'),

    // Modules & Lessons
    createModule: (course_id: string, title: string, position: number): Promise<Module> => apiFetch('/modules', { method: 'POST', body: JSON.stringify({ course_id, title, position }) }),
    updateModule: (id: string, payload: Partial<Module>): Promise<Module> => apiFetch(`/modules/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    createLesson: (module_id: string, title: string, content_type: string, position: number): Promise<Lesson> => apiFetch('/lessons', { method: 'POST', body: JSON.stringify({ module_id, title, content_type, position }) }),
    getLesson: (id: string): Promise<Lesson> => apiFetch(`/lessons/${id}`),
    updateLesson: (id: string, payload: Partial<Lesson>): Promise<Lesson> => apiFetch(`/lessons/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    summarizeLesson: (id: string): Promise<Lesson> => apiFetch(`/lessons/${id}/summarize`, { method: 'POST' }),
    generateQuiz: (id: string, payload: { context?: string, quiz_type?: string }): Promise<Block[]> => apiFetch(`/lessons/${id}/generate-quiz`, { method: 'POST', body: JSON.stringify(payload) }),
    reviewText: (text: string): Promise<{ suggestion: string, comments: string }> => apiFetch('/api/ai/review-text', { method: 'POST', body: JSON.stringify({ text }) }),
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
    getCourseAnalytics: (id: string, cohortId?: string): Promise<CourseAnalytics> => {
        const query = cohortId ? `?cohort_id=${cohortId}` : '';
        return apiFetch(`/courses/${id}/analytics${query}`, {}, true);
    },
    getAdvancedAnalytics: (id: string, cohortId?: string): Promise<AdvancedAnalytics> => {
        const query = cohortId ? `?cohort_id=${cohortId}` : '';
        return apiFetch(`/courses/${id}/analytics/advanced${query}`, {}, true);
    },
    getLessonHeatmap: (lessonId: string): Promise<{ second: number, count: number }[]> => apiFetch(`/lessons/${lessonId}/heatmap`),
    exportCourse: (id: string): Promise<Record<string, unknown>> => apiFetch(`/courses/${id}/export`),
    importCourse: (data: Record<string, unknown>): Promise<Course> => apiFetch(`/courses/import`, {
        method: 'POST',
        body: JSON.stringify(data)
    }),

    deleteCourse: (id: string): Promise<void> => apiFetch(`/courses/${id}`, { method: 'DELETE' }),

    async generateCourse(prompt: string, targetOrgId?: string): Promise<Course> {
        return apiFetch(`/courses/generate`, {
            method: 'POST',
            body: JSON.stringify({ prompt, target_organization_id: targetOrgId })
        });
    },

    // Users
    getAllUsers: (): Promise<User[]> => apiFetch('/users'),
    createUser: (data: UserCreatePayload): Promise<User> => apiFetch('/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (id: string, payload: { role?: string, organization_id?: string, full_name?: string, avatar_url?: string, bio?: string, language?: string }): Promise<void> => apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

    // Webhooks
    getWebhooks: (): Promise<Webhook[]> => apiFetch('/webhooks'),
    createWebhook: (payload: CreateWebhookPayload): Promise<Webhook> => apiFetch('/webhooks', { method: 'POST', body: JSON.stringify(payload) }),
    deleteWebhook: (id: string): Promise<void> => apiFetch(`/webhooks/${id}`, { method: 'DELETE' }),

    // Assets
    getAssets: (filters?: AssetFilters): Promise<Asset[]> => {
        const params = new URLSearchParams();
        if (filters) {
            if (filters.mimetype) params.append('mimetype', filters.mimetype);
            if (filters.course_id) params.append('course_id', filters.course_id);
            if (filters.search) params.append('search', filters.search);
            if (filters.page) params.append('page', filters.page.toString());
            if (filters.limit) params.append('limit', filters.limit.toString());
        }
        const query = params.toString();
        return apiFetch(`/api/assets${query ? `?${query}` : ''}`);
    },
    getCourseAssets: (courseId: string): Promise<Asset[]> => apiFetch(`/api/assets?course_id=${courseId}`),
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
    uploadOrganizationFavicon: (id: string, file: File): Promise<UploadResponse> => {
        const formData = new FormData();
        formData.append('file', file);
        const token = getToken();
        const selectedOrgId = getSelectedOrgId();
        const headers: Record<string, string> = {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(selectedOrgId ? { 'X-Organization-Id': selectedOrgId } : {})
        };
        return fetch(`${API_BASE_URL}/organizations/${id}/favicon`, {
            method: 'POST',
            headers,
            body: formData,
        }).then(res => {
            if (!res.ok) return res.json().then(err => Promise.reject(new Error(err.message || 'Favicon upload failed')));
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

    // Content Libraries
    createLibraryBlock: (payload: CreateLibraryBlockPayload): Promise<LibraryBlock> =>
        apiFetch('/library/blocks', { method: 'POST', body: JSON.stringify(payload) }),
    listLibraryBlocks: (filters?: LibraryBlockFilters): Promise<LibraryBlock[]> => {
        const params = new URLSearchParams();
        if (filters?.type) params.append('type', filters.type);
        if (filters?.tags) params.append('tags', filters.tags);
        if (filters?.search) params.append('search', filters.search);
        const query = params.toString() ? `?${params.toString()}` : '';
        return apiFetch(`/library/blocks${query}`);
    },
    getLibraryBlock: (id: string): Promise<LibraryBlock> =>
        apiFetch(`/library/blocks/${id}`),
    updateLibraryBlock: (id: string, payload: UpdateLibraryBlockPayload): Promise<LibraryBlock> =>
        apiFetch(`/library/blocks/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteLibraryBlock: (id: string): Promise<void> =>
        apiFetch(`/library/blocks/${id}`, { method: 'DELETE' }),
    incrementBlockUsage: (id: string): Promise<void> =>
        apiFetch(`/library/blocks/${id}/increment-usage`, { method: 'POST' }),

    // Advanced Grading / Rubrics
    createRubric: (courseId: string, payload: CreateRubricPayload): Promise<Rubric> =>
        apiFetch(`/courses/${courseId}/rubrics`, { method: 'POST', body: JSON.stringify(payload) }),
    listCourseRubrics: (courseId: string): Promise<Rubric[]> =>
        apiFetch(`/courses/${courseId}/rubrics`),
    getRubricWithDetails: (rubricId: string): Promise<RubricWithDetails> =>
        apiFetch(`/rubrics/${rubricId}`),
    updateRubric: (rubricId: string, payload: UpdateRubricPayload): Promise<Rubric> =>
        apiFetch(`/rubrics/${rubricId}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteRubric: (rubricId: string): Promise<void> =>
        apiFetch(`/rubrics/${rubricId}`, { method: 'DELETE' }),

    // Rubric Criteria
    createCriterion: (rubricId: string, payload: CreateCriterionPayload): Promise<RubricCriterion> =>
        apiFetch(`/rubrics/${rubricId}/criteria`, { method: 'POST', body: JSON.stringify(payload) }),
    updateCriterion: (criterionId: string, payload: UpdateCriterionPayload): Promise<RubricCriterion> =>
        apiFetch(`/criteria/${criterionId}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteCriterion: (criterionId: string): Promise<void> =>
        apiFetch(`/criteria/${criterionId}`, { method: 'DELETE' }),

    // Rubric Levels
    createLevel: (criterionId: string, payload: CreateLevelPayload): Promise<RubricLevel> =>
        apiFetch(`/criteria/${criterionId}/levels`, { method: 'POST', body: JSON.stringify(payload) }),
    updateLevel: (levelId: string, payload: UpdateLevelPayload): Promise<RubricLevel> =>
        apiFetch(`/levels/${levelId}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteLevel: (levelId: string): Promise<void> =>
        apiFetch(`/levels/${levelId}`, { method: 'DELETE' }),

    // Lesson-Rubric Association
    assignRubricToLesson: (lessonId: string, rubricId: string): Promise<void> =>
        apiFetch(`/lessons/${lessonId}/rubrics/${rubricId}`, { method: 'POST' }),
    unassignRubricFromLesson: (lessonId: string, rubricId: string): Promise<void> =>
        apiFetch(`/lessons/${lessonId}/rubrics/${rubricId}`, { method: 'DELETE' }),
    getLessonRubrics: (lessonId: string): Promise<Rubric[]> =>
        apiFetch(`/lessons/${lessonId}/rubrics`),

    // Learning Sequences (Dependencies)
    listLessonDependencies: (lessonId: string): Promise<LessonDependency[]> =>
        apiFetch(`/lessons/${lessonId}/dependencies`),
    assignDependency: (lessonId: string, payload: AssignDependencyPayload): Promise<LessonDependency> =>
        apiFetch(`/lessons/${lessonId}/dependencies`, { method: 'POST', body: JSON.stringify(payload) }),
    removeDependency: (lessonId: string, prerequisiteId: string): Promise<void> =>
        apiFetch(`/lessons/${lessonId}/dependencies/${prerequisiteId}`, { method: 'DELETE' }),
};

export const lmsApi = {
    getCohorts: (): Promise<Cohort[]> => apiFetch('/cohorts', {}, true),
    createCohort: (payload: CreateCohortPayload): Promise<Cohort> => apiFetch('/cohorts', { method: 'POST', body: JSON.stringify(payload) }, true),
    addMember: (cohortId: string, userId: string): Promise<UserCohort> => apiFetch(`/cohorts/${cohortId}/members`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }, true),
    removeMember: (cohortId: string, userId: string): Promise<void> => apiFetch(`/cohorts/${cohortId}/members/${userId}`, { method: 'DELETE' }, true),
    getMembers: (id: string): Promise<string[]> => apiFetch(`/cohorts/${id}/members`, {}, true),
    getCourseGrades: (id: string, cohortId?: string): Promise<StudentGradeReport[]> => {
        const query = cohortId ? `?cohort_id=${cohortId}` : '';
        return apiFetch(`/courses/${id}/grades${query}`, {}, true);
    },
    exportGradesUrl: (courseId: string): string => {
        // Since we are downloading via <a> tag...
        return `${LMS_API_BASE_URL}/courses/${courseId}/export-grades`;
    },
    bulkEnroll: (courseId: string, emails: string[]): Promise<BulkEnrollResponse> =>
        apiFetch('/bulk-enroll', { method: 'POST', body: JSON.stringify({ course_id: courseId, emails }) }, true),
    // Peer Assessment
    submitAssignment: (courseId: string, lessonId: string, content: string): Promise<CourseSubmission> =>
        apiFetch(`/courses/${courseId}/lessons/${lessonId}/submit`, { method: 'POST', body: JSON.stringify({ content }) }, true),
    getPeerReviewAssignment: (courseId: string, lessonId: string): Promise<CourseSubmission | null> =>
        apiFetch(`/courses/${courseId}/lessons/${lessonId}/peer-review`, {}, true),
    submitPeerReview: (courseId: string, lessonId: string, submissionId: string, score: number, feedback: string): Promise<PeerReview> =>
        apiFetch(`/courses/${courseId}/lessons/${lessonId}/peer-review`, { method: 'POST', body: JSON.stringify({ submission_id: submissionId, score, feedback }) }, true),
    getMySubmissionFeedback: (courseId: string, lessonId: string): Promise<PeerReview[]> =>
        apiFetch(`/courses/${courseId}/lessons/${lessonId}/feedback`, {}, true),
    listLessonSubmissions: (courseId: string, lessonId: string): Promise<SubmissionWithReviews[]> =>
        apiFetch(`/courses/${courseId}/lessons/${lessonId}/submissions`, {}, true),
    getSubmissionReviews: (submissionId: string): Promise<PeerReview[]> =>
        apiFetch(`/peer-reviews/submissions/${submissionId}/reviews`, {}, true),

    // Announcements
    listAnnouncements: (courseId: string): Promise<AnnouncementWithAuthor[]> =>
        apiFetch(`/courses/${courseId}/announcements`, {}, true),
    createAnnouncement: (courseId: string, payload: CreateAnnouncementPayload): Promise<CourseAnnouncement> =>
        apiFetch(`/courses/${courseId}/announcements`, { method: 'POST', body: JSON.stringify(payload) }, true),
    updateAnnouncement: (announcementId: string, payload: UpdateAnnouncementPayload): Promise<CourseAnnouncement> =>
        apiFetch(`/announcements/${announcementId}`, { method: 'PUT', body: JSON.stringify(payload) }, true),
    deleteAnnouncement: (announcementId: string): Promise<void> =>
        apiFetch(`/announcements/${announcementId}`, { method: 'DELETE' }, true),
    async getDeepLinkingResponse(payload: { dl_token: string, items: LtiDeepLinkingContentItem[] }): Promise<{ jwt: string, return_url: string }> {
        return apiFetch('/lti/deep-linking/response', { method: 'POST', body: JSON.stringify(payload) }, true);
    },
    getDropoutRisks: (courseId: string): Promise<DropoutRisk[]> =>
        apiFetch(`/courses/${courseId}/dropout-risks`, {}, true),

    // Live Learning
    getMeetings: (courseId: string): Promise<Meeting[]> =>
        apiFetch(`/courses/${courseId}/meetings`, {}, true),

    createMeeting: (courseId: string, payload: Partial<Meeting>): Promise<Meeting> =>
        apiFetch(`/courses/${courseId}/meetings`, { method: 'POST', body: JSON.stringify(payload) }, true),

    deleteMeeting: (courseId: string, meetingId: string): Promise<void> =>
        apiFetch(`/courses/${courseId}/meetings/${meetingId}`, { method: 'DELETE' }, true),

    // Portfolio & Badges
    getPublicProfile: (userId: string): Promise<PublicProfile> =>
        apiFetch(`/profile/${userId}`, {}, true),

    getMyBadges: (): Promise<Badge[]> =>
        apiFetch(`/my/badges`, {}, true),
};

export interface Meeting {
    id: string;
    course_id: string;
    title: string;
    description?: string;
    provider: string;
    meeting_id: string;
    start_at: string;
    duration_minutes: number;
    join_url?: string;
    is_active: boolean;
}

export interface Badge {
    id: string;
    name: string;
    description: string;
    icon_url: string;
    criteria: any;
    created_at: string;
}

export interface PublicProfile {
    user_id: string;
    full_name: string;
    avatar_url?: string;
    bio?: string;
    badges: Badge[];
    level: number;
    xp: number;
    completed_courses_count: number;
}

export interface LtiDeepLinkingContentItem {
    type: 'ltiResourceLink';
    title?: string;
    text?: string;
    url?: string;
    icon?: { url: string; width?: number; height?: number };
    thumbnail?: { url: string; width?: number; height?: number };
    [key: string]: string | number | boolean | object | undefined | null;
}

export interface BackgroundTask {
    id: string;
    title: string;
    course_title?: string;
    task_type: 'lesson_transcription' | 'lesson_image' | 'course_image';
    status: 'idle' | 'queued' | 'processing' | 'failed' | 'completed' | 'error';
    progress: number;
    updated_at: string;
}