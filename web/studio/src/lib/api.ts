const STUDIO_DOMAIN = process.env.NEXT_PUBLIC_STUDIO_DOMAIN || 'studio.norteamericano.com';
const LEARNING_DOMAIN = process.env.NEXT_PUBLIC_LEARNING_DOMAIN || 'learning.norteamericano.com';

const getApiBaseUrl = (defaultPort: string, envVar?: string) => {
    // Prefer explicit environment configuration when available. This allows production
    // deployments to use a dedicated API prefix like `/cms-api` and avoids collisions
    // between Next.js pages (e.g. `/courses`) and backend endpoints with the same path.
    if (envVar && envVar.trim() !== '') {
        return envVar;
    }

    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;

        // Producción - usar prefijo explícito para evitar colisiones con rutas de Next.js.
        // Ejemplo: /question-bank (página) vs /question-bank/mysql-plans (API).
        if (hostname === STUDIO_DOMAIN) {
            return `${protocol}//${STUDIO_DOMAIN}/cms-api`;
        }
        if (hostname === LEARNING_DOMAIN) {
            return `${protocol}//${LEARNING_DOMAIN}/cms-api`;
        }

        // Desarrollo local
        return `${protocol}//${hostname}:${defaultPort}`;
    }

    return `http://localhost:${defaultPort}`;
};

export const API_BASE_URL = getApiBaseUrl("3001", process.env.NEXT_PUBLIC_CMS_API_URL);
const getLmsBaseUrl = (envVar?: string) => {
    if (typeof window !== 'undefined' && window.location.hostname === STUDIO_DOMAIN) {
        return `${window.location.protocol}//${STUDIO_DOMAIN}/lms-api`;
    }
    return getApiBaseUrl("3002", envVar);
};

export const LMS_API_BASE_URL = getLmsBaseUrl(process.env.NEXT_PUBLIC_LMS_API_URL);

// Polyfill for crypto.randomUUID() for non-HTTPS contexts
export function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for non-secure contexts
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export const getImageUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('http')) {
        // If backend persisted direct S3 public URL but bucket is private,
        // proxy it through CMS to avoid AccessDenied.
        try {
            const parsed = new URL(path);
            const host = parsed.hostname;
            const isAwsS3 = host.includes('.s3.') || host.endsWith('.amazonaws.com');
            if (isAwsS3) {
                const key = parsed.pathname.replace(/^\//, '');
                let bucket = '';

                // virtual-host style: <bucket>.s3.<region>.amazonaws.com
                if (host.includes('.s3.')) {
                    bucket = host.split('.s3.')[0];
                } else {
                    // path-style: s3.<region>.amazonaws.com/<bucket>/<key>
                    const [first, ...rest] = key.split('/');
                    if (first && rest.length) {
                        bucket = first;
                        const normalizedKey = rest.join('/');
                        return `${API_BASE_URL}/api/assets/s3-proxy/${encodeURIComponent(bucket)}/${normalizedKey}`;
                    }
                }

                if (bucket && key) {
                    return `${API_BASE_URL}/api/assets/s3-proxy/${encodeURIComponent(bucket)}/${key}`;
                }
            }
        } catch {
            // If URL parsing fails, fallback to original path behavior below.
        }

        return path;
    }

    // Handle S3 storage URIs persisted in DB: s3://bucket/key -> https://bucket.s3.amazonaws.com/key
    if (path.startsWith('s3://')) {
        const withoutScheme = path.slice(5);
        const firstSlash = withoutScheme.indexOf('/');
        if (firstSlash > 0) {
            const bucket = withoutScheme.slice(0, firstSlash);
            const key = withoutScheme.slice(firstSlash + 1);
            if (bucket && key) {
                return `${API_BASE_URL}/api/assets/s3-proxy/${encodeURIComponent(bucket)}/${key}`;
            }
        }
    }

    // Handle plain object keys (e.g. org/<org-id>/shared/assets/file.ext)
    // when a CDN/base URL is configured for public object access.
    const s3PublicBase = process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL;
    if (s3PublicBase && /^org\/.+/.test(path)) {
        return `${s3PublicBase.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    }

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
    type: 'description' | 'media' | 'quiz' | 'fill-in-the-blanks' | 'matching' | 'ordering' | 'short-answer' | 'document' | 'video_marker' | 'audio-response' | 'memory-match' | 'hotspot' | 'peer-review' | 'role-playing' | 'mermaid' | 'code-lab' | 'lti-tool';
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
    // Role-playing fields
    scenario?: string;
    ai_persona?: string;
    user_role?: string;
    objectives?: string;
    initial_message?: string;
    // Mermaid fields
    mermaid_code?: string;
    // Code Lab fields
    language?: string;
    instructions?: string;
    initial_code?: string;
    solution?: string;
    test_cases?: { description: string; expected: string }[];
    // LTI Tool fields
    lti_tool_id?: string;
    launch_url?: string;
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
    content_blocks?: Block[];
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

export interface OrganizationExerciseSettings {
    organization_id: string;
    audio_response_enabled: boolean;
    hotspot_enabled: boolean;
    memory_match_enabled: boolean;
    peer_review_enabled: boolean;
    role_playing_enabled: boolean;
    mermaid_enabled: boolean;
    code_lab_enabled: boolean;
    certificates_enabled: boolean;
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

export interface OrganizationEmailService {
    id: string;
    organization_id: string;
    service_type: string;
    provider_key: string;
    display_name: string;
    is_enabled: boolean;
    is_default: boolean;
    smtp_host?: string;
    smtp_port: number;
    smtp_from?: string;
    smtp_username?: string;
    smtp_starttls: boolean;
    has_password: boolean;
}

export interface UpsertOrganizationEmailServicePayload {
    service_type: string;
    provider_key: string;
    display_name: string;
    is_enabled: boolean;
    is_default: boolean;
    smtp_host?: string;
    smtp_port: number;
    smtp_from?: string;
    smtp_username?: string;
    smtp_password?: string;
    smtp_starttls: boolean;
}

export interface OrganizationEmailTemplate {
    id: string;
    organization_id: string;
    template_key: string;
    display_name: string;
    subject_template: string;
    body_template: string;
    is_html: boolean;
    is_enabled: boolean;
    created_at: string;
    updated_at: string;
}

export interface UpsertOrganizationEmailTemplatePayload {
    template_key: string;
    display_name: string;
    subject_template: string;
    body_template: string;
    is_html: boolean;
    is_enabled: boolean;
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

// ==================== AI Usage Global ====================

export interface GlobalAiSummary {
    total_tokens: number;
    total_input: number;
    total_output: number;
    total_requests: number;
    total_cost_usd: number;
    savings_vs_openai_usd: number;
    savings_percentage: number;
    openai_equivalent_cost_usd: number;
    total_organizations: number;
    total_active_users: number;
}

export interface StudentChatSummary {
    total_tokens: number;
    total_requests: number;
    total_cost_usd: number;
    active_students: number;
}

export interface DailyUsage {
    date: string;
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    requests: number;
}

export interface UsageByEndpoint {
    endpoint: string;
    request_type: string;
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    requests: number;
}

export interface UsageByOrganization {
    org_id: string;
    org_name: string;
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    requests: number;
    active_users: number;
}

export interface UsageByRequestType {
    request_type: string;
    total_tokens: number;
    cost_usd: number;
    requests: number;
}

export interface TopUserUsage {
    user_id: string;
    email: string;
    full_name: string;
    role: string;
    org_name: string;
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    requests: number;
}

export interface StudentChatUsage {
    user_id: string;
    email: string;
    full_name: string;
    org_name: string;
    total_tokens: number;
    cost_usd: number;
    chat_requests: number;
    last_chat: string;
}

export interface GlobalAiUsageResponse {
    summary: GlobalAiSummary;
    student_chat_summary: StudentChatSummary | null;
    daily_usage: DailyUsage[];
    by_endpoint: UsageByEndpoint[];
    by_organization: UsageByOrganization[];
    by_request_type: UsageByRequestType[];
    top_users: TopUserUsage[];
    student_chat_usage: StudentChatUsage[];
}

export interface SamSyncResponse {
    students_synced: number;
    assignments_synced: number;
    errors: string[];
}

// ==================== Grading ====================

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

// Análisis Pedagógico Profundo (Fase 34)
export interface LessonQualityMetric {
    lesson_id: string;
    lesson_title: string;
    position: number;
    completion_rate: number;
    avg_attempts: number;
    avg_score: number;
    failure_rate: number;
    abandonment_count: number;
}
export interface CourseQualityMetrics {
    course_id: string;
    enrolled: number;
    lessons: LessonQualityMetric[];
}
export interface QuizDiscriminationItem {
    lesson_id: string;
    lesson_title: string;
    block_id: string;
    discrimination_index: number;
    facility_index: number;
    sample_size: number;
}
export interface CourseDiscriminationReport {
    course_id: string;
    items: QuizDiscriminationItem[];
}
export interface CurricularSuggestion {
    lesson_id: string;
    lesson_title: string;
    kind: string;
    message: string;
    severity: string;
}
export interface CurricularSuggestionsReport {
    course_id: string;
    suggestions: CurricularSuggestion[];
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
    english_level?: string | null;
    zip_batch_id?: string | null;
    source_zip_name?: string | null;
    filename: string;
    storage_path: string;
    mimetype: string;
    size_bytes: number;
    created_at: string;
}

export interface AssetImportHistoryItem {
    zip_batch_id: string;
    source_zip_name: string;
    english_level?: string | null;
    sam_plan_id?: number | null;
    sam_course_id?: number | null;
    asset_count: number;
    created_at: string;
}

export interface AssetFilters {
    mimetype?: string;
    course_id?: string;
    english_level?: string;
    sam_plan_id?: number;
    sam_course_id?: number;
    search?: string;
    page?: number;
    limit?: number;
}

export interface AssetRagIngestResult {
    asset_id: string;
    source: string;
    chunks_ingested: number;
    chars_ingested: number;
}

export interface AssetZipImportResult {
    imported_assets: number;
    rag_ingested_assets: number;
    rag_chunks_ingested: number;
    failed_entries: string[];
    rag_background_started?: boolean;
    rag_background_items?: number;
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

interface ApiFetchOptions extends RequestInit {
    query?: Record<string, string | number | boolean | undefined | null>;
}

export const apiFetch = (url: string, options: ApiFetchOptions = {}, isLms: boolean = false) => {
    const token = getToken();
    const selectedOrgId = getSelectedOrgId();
    const baseUrl = isLms ? LMS_API_BASE_URL : API_BASE_URL;
    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...Object.fromEntries(Object.entries(options.headers || {}).map(([k, v]) => [k, String(v)])),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(selectedOrgId ? { 'X-Organization-Id': selectedOrgId } : {})
    };

    // Build query string
    const queryParams = options.query;
    let finalUrl = `${baseUrl}${url}`;
    if (queryParams) {
        const searchParams = new URLSearchParams();
        Object.entries(queryParams).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                searchParams.append(key, String(value));
            }
        });
        const queryString = searchParams.toString();
        if (queryString) {
            finalUrl += `${url.includes('?') ? '&' : '?'}${queryString}`;
        }
    }

    return fetch(finalUrl, { ...options, headers }).then(async res => {
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
        if (res.status === 204 || res.status === 202) return;
        return res.json();
    });
};

export const cmsApi = {
    // Organization
    getOrganization: (): Promise<Organization> => apiFetch('/organization'),
    updateOrganizationBranding: (payload: BrandingPayload): Promise<Organization> => apiFetch('/organization/branding', { method: 'PUT', body: JSON.stringify(payload) }),
    uploadOrganizationLogo: (file: File): Promise<{ logo_url: string }> => {
        const formData = new FormData();
        formData.append('file', file);
        return apiFetch('/organization/logo', { method: 'POST', body: formData });
    },
    uploadOrganizationFavicon: (file: File): Promise<{ favicon_url: string }> => {
        const formData = new FormData();
        formData.append('file', file);
        return apiFetch('/organization/favicon', { method: 'POST', body: formData });
    },
    getSSOConfig: (): Promise<OrganizationSSOConfig> => apiFetch('/organization/sso'),
    updateSSOConfig: (payload: Partial<OrganizationSSOConfig>): Promise<void> => apiFetch('/organization/sso', { method: 'PUT', body: JSON.stringify(payload) }),
    getOrganizationEmailSettings: (): Promise<OrganizationEmailService> => apiFetch('/organization/email-settings'),
    updateOrganizationEmailSettings: (payload: UpsertOrganizationEmailServicePayload): Promise<OrganizationEmailService> =>
        apiFetch('/organization/email-settings', { method: 'PUT', body: JSON.stringify(payload) }),
    listOrganizationEmailServices: (): Promise<OrganizationEmailService[]> => apiFetch('/organization/email-services'),
    createOrganizationEmailService: (payload: UpsertOrganizationEmailServicePayload): Promise<OrganizationEmailService> =>
        apiFetch('/organization/email-services', { method: 'POST', body: JSON.stringify(payload) }),
    updateOrganizationEmailService: (id: string, payload: UpsertOrganizationEmailServicePayload): Promise<OrganizationEmailService> =>
        apiFetch(`/organization/email-services/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteOrganizationEmailService: (id: string): Promise<void> =>
        apiFetch(`/organization/email-services/${id}`, { method: 'DELETE' }),
    selectOrganizationEmailService: (id: string): Promise<void> =>
        apiFetch(`/organization/email-services/${id}/select`, { method: 'POST' }),
    listOrganizationEmailTemplates: (): Promise<OrganizationEmailTemplate[]> => apiFetch('/organization/email-templates'),
    createOrganizationEmailTemplate: (payload: UpsertOrganizationEmailTemplatePayload): Promise<OrganizationEmailTemplate> =>
        apiFetch('/organization/email-templates', { method: 'POST', body: JSON.stringify(payload) }),
    updateOrganizationEmailTemplate: (id: string, payload: UpsertOrganizationEmailTemplatePayload): Promise<OrganizationEmailTemplate> =>
        apiFetch(`/organization/email-templates/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteOrganizationEmailTemplate: (id: string): Promise<void> =>
        apiFetch(`/organization/email-templates/${id}`, { method: 'DELETE' }),
    getOrganizationExerciseSettings: (): Promise<OrganizationExerciseSettings> => apiFetch('/organization/exercise-settings'),
    updateOrganizationExerciseSettings: (payload: Omit<OrganizationExerciseSettings, 'organization_id'>): Promise<OrganizationExerciseSettings> =>
        apiFetch('/organization/exercise-settings', { method: 'PUT', body: JSON.stringify(payload) }),

    // Auth
    register: (payload: AuthPayload): Promise<AuthResponse> => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
    login: (payload: AuthPayload): Promise<AuthResponse> => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
    getMe: (): Promise<User> => apiFetch('/auth/me'),

    // Branding (Public)
    getBranding: (): Promise<BrandingResponse> => apiFetch('/branding'),

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

    // SAM Integration
    syncSamStudents: (): Promise<SamSyncResponse> => apiFetch('/sam/sync-students', { method: 'POST' }),
    syncSamAssignments: (): Promise<SamSyncResponse> => apiFetch('/sam/sync-assignments', { method: 'POST' }),
    syncSamAll: (): Promise<SamSyncResponse> => apiFetch('/sam/sync-all', { method: 'POST' }),
    getUsers: (): Promise<User[]> => apiFetch('/users'),

    // Modules & Lessons
    createModule: (course_id: string, title: string, position: number): Promise<Module> => apiFetch('/modules', { method: 'POST', body: JSON.stringify({ course_id, title, position }) }),
    updateModule: (id: string, payload: Partial<Module>): Promise<Module> => apiFetch(`/modules/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    createLesson: (module_id: string, title: string, content_type: string, position: number): Promise<Lesson> => apiFetch('/lessons', { method: 'POST', body: JSON.stringify({ module_id, title, content_type, position }) }),
    getLesson: (id: string): Promise<Lesson> => apiFetch(`/lessons/${id}`),
    updateLesson: (id: string, payload: Partial<Lesson>): Promise<Lesson> => apiFetch(`/lessons/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    summarizeLesson: (id: string): Promise<Lesson> => apiFetch(`/lessons/${id}/summarize`, { method: 'POST' }),
    async generateQuiz(lessonId: string, payload: { prompt_hint?: string, quiz_type?: string }): Promise<{ questions: QuizQuestion[] }> {
        return apiFetch(`/lessons/${lessonId}/generate-quiz`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },
    async generateRolePlay(lessonId: string, payload: { prompt_hint?: string }): Promise<{
        title: string;
        scenario: string;
        ai_persona: string;
        user_role: string;
        objectives: string;
        initial_message: string;
    }> {
        return apiFetch(`/lessons/${lessonId}/generate-role-play`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },
    async generateMermaidDiagram(lessonId: string, payload: { prompt_hint?: string }): Promise<{ mermaid_code: string }> {
        return apiFetch(`/lessons/${lessonId}/generate-mermaid`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },
    async generateCodeLab(lessonId: string, payload: { language?: string; prompt_hint?: string }): Promise<{
        language: string; title: string; instructions: string; initial_code: string; solution: string;
        test_cases: { description: string; expected: string }[];
    }> {
        return apiFetch(`/lessons/${lessonId}/generate-code-lab`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },
    async generateHotspots(lessonId: string, payload: { image_url: string, prompt_hint?: string }): Promise<{
        label: string;
        description: string;
        x: number;
        y: number;
    }[]> {
        return apiFetch(`/lessons/${lessonId}/generate-hotspots`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },
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

    // Course Templates
    listCourseTemplates: (): Promise<CourseTemplateSummary[]> => apiFetch('/course-templates'),
    createCourseTemplateFromCourse: (courseId: string, name: string, description?: string): Promise<CourseTemplateSummary> =>
        apiFetch(`/course-templates/from-course/${courseId}`, {
            method: 'POST',
            body: JSON.stringify({ name, description })
        }),
    applyCourseTemplate: (templateId: string, title?: string): Promise<Course> =>
        apiFetch(`/course-templates/${templateId}/apply`, {
            method: 'POST',
            body: JSON.stringify({ title })
        }),
    deleteCourseTemplate: (templateId: string): Promise<void> =>
        apiFetch(`/course-templates/${templateId}`, { method: 'DELETE' }),

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
    deleteUser: (id: string): Promise<void> => apiFetch(`/users/${id}`, { method: 'DELETE' }),

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
            if (filters.english_level) params.append('english_level', filters.english_level);
            if (filters.sam_plan_id) params.append('sam_plan_id', String(filters.sam_plan_id));
            if (filters.sam_course_id) params.append('sam_course_id', String(filters.sam_course_id));
            if (filters.search) params.append('search', filters.search);
            if (filters.page) params.append('page', filters.page.toString());
            if (filters.limit) params.append('limit', filters.limit.toString());
        }
        const query = params.toString();
        return apiFetch(`/api/assets${query ? `?${query}` : ''}`);
    },
    getAssetImportHistory: (): Promise<AssetImportHistoryItem[]> => apiFetch('/api/assets/import-history'),
    getCourseAssets: (courseId: string): Promise<Asset[]> => apiFetch(`/api/assets?course_id=${courseId}`),
    deleteAsset: (id: string): Promise<void> => apiFetch(`/api/assets/${id}`, { method: 'DELETE' }),
    ingestAssetForRag: (id: string): Promise<AssetRagIngestResult> =>
        apiFetch(`/api/assets/${id}/ingest-rag`, { method: 'POST' }),
    importAssetsZip: (
        file: File,
        ingestRag = false,
        courseId?: string,
        englishLevel?: string,
        samPlanId?: number,
        samCourseId?: number,
        onProgress?: (pct: number) => void,
        splitToRegular = false,
        samCourseIdR1?: number,
        samCourseIdR2?: number,
        useDevProcessing = false,
    ): Promise<AssetZipImportResult> => {
        return new Promise((resolve, reject) => {
            const maxNetworkRetries = 2;

            const startAttempt = (attempt: number) => {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('ingest_rag', ingestRag ? 'true' : 'false');
                if (courseId) formData.append('course_id', courseId);
                if (englishLevel) formData.append('english_level', englishLevel);
                if (samPlanId) formData.append('sam_plan_id', String(samPlanId));
                if (samCourseId) formData.append('sam_course_id', String(samCourseId));
                if (splitToRegular) {
                    formData.append('split_to_regular', 'true');
                    if (samCourseIdR1) formData.append('sam_course_id_r1', String(samCourseIdR1));
                    if (samCourseIdR2) formData.append('sam_course_id_r2', String(samCourseIdR2));
                }
                if (useDevProcessing) {
                    formData.append('use_dev_processing', 'true');
                }

                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${API_BASE_URL}/api/assets/import-zip`);

                const token = getToken();
                if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                const selectedOrgId = getSelectedOrgId();
                if (selectedOrgId) xhr.setRequestHeader('X-Organization-Id', selectedOrgId);

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        let msg = `ZIP import failed (HTTP ${xhr.status})`;
                        try {
                            const parsed = JSON.parse(xhr.responseText);
                            msg = parsed.message || parsed.error || msg;
                        } catch {
                            const raw = (xhr.responseText || '').trim();
                            if (raw) {
                                const compact = raw.replace(/\s+/g, ' ').slice(0, 240);
                                msg = `${msg}: ${compact}`;
                            }
                        }
                        reject(new Error(msg));
                    }
                };

                xhr.onerror = () => {
                    if (attempt < maxNetworkRetries) {
                        const delayMs = 1200 * (attempt + 1);
                        setTimeout(() => startAttempt(attempt + 1), delayMs);
                        return;
                    }
                    reject(new Error('Network error'));
                };

                if (onProgress) {
                    xhr.upload.onprogress = (event) => {
                        if (!event.lengthComputable) return;
                        const pct = Math.round((event.loaded / event.total) * 100);
                        onProgress(Math.max(0, Math.min(100, pct)));
                    };
                }

                xhr.send(formData);
            };

            startAttempt(0);
        });
    },
    uploadAsset: (
        file: File,
        onProgress?: (pct: number) => void,
        courseId?: string,
        englishLevel?: string,
        samPlanId?: number,
        samCourseId?: number,
    ): Promise<UploadResponse> => {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            if (courseId) formData.append('course_id', courseId);
            if (englishLevel) formData.append('english_level', englishLevel);
            if (samPlanId) formData.append('sam_plan_id', String(samPlanId));
            if (samCourseId) formData.append('sam_course_id', String(samCourseId));

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

    // Test Templates
    listTestTemplates: (filters?: TestTemplateFilters): Promise<TestTemplate[]> =>
        apiFetch('/test-templates', { method: 'GET', query: filters as Record<string, string | number | boolean | undefined | null> }, false),
    getTestTemplate: (templateId: string): Promise<TestTemplateWithQuestions> =>
        apiFetch(`/test-templates/${templateId}`, {}, false),
    createTestTemplate: (payload: CreateTestTemplatePayload): Promise<TestTemplate> =>
        apiFetch('/test-templates', { method: 'POST', body: JSON.stringify(payload) }, false),
    updateTestTemplate: (templateId: string, payload: UpdateTestTemplatePayload): Promise<TestTemplate> =>
        apiFetch(`/test-templates/${templateId}`, { method: 'PUT', body: JSON.stringify(payload) }, false),
    deleteTestTemplate: (templateId: string): Promise<void> =>
        apiFetch(`/test-templates/${templateId}`, { method: 'DELETE' }, false),
    createTemplateQuestion: (templateId: string, payload: CreateQuestionPayload): Promise<TestTemplateQuestion> =>
        apiFetch(`/test-templates/${templateId}/questions`, { method: 'POST', body: JSON.stringify(payload) }, false),
    deleteTemplateQuestion: (templateId: string, questionId: string): Promise<void> =>
        apiFetch(`/test-templates/${templateId}/questions/${questionId}`, { method: 'DELETE' }, false),
    createTemplateSection: (templateId: string, payload: CreateSectionPayload): Promise<TestTemplateSection> =>
        apiFetch(`/test-templates/${templateId}/sections`, { method: 'POST', body: JSON.stringify(payload) }, false),
    deleteTemplateSection: (templateId: string, sectionId: string): Promise<void> =>
        apiFetch(`/test-templates/${templateId}/sections/${sectionId}`, { method: 'DELETE' }, false),
    applyTemplateToLesson: (templateId: string, lessonId: string, gradingCategoryId?: string): Promise<void> =>
        apiFetch(`/test-templates/${templateId}/apply`, { method: 'POST', body: JSON.stringify({ lesson_id: lessonId, grading_category_id: gradingCategoryId }) }, false),
    generateQuestionsWithRAG: (courseId?: number, topic?: string, numQuestions?: number, questionType?: QuestionType): Promise<TestTemplateQuestion[]> =>
        apiFetch('/test-templates/generate-with-rag', { method: 'POST', body: JSON.stringify({ course_id: courseId, topic, num_questions: numQuestions, question_type: questionType }) }, false),

    // Admin - AI Usage Global
    getGlobalAiUsage: (startDate?: string, endDate?: string): Promise<GlobalAiUsageResponse> =>
        apiFetch('/admin/ai-usage/global', { query: { start_date: startDate, end_date: endDate } }, false),
};

// ==================== Question Bank ====================

export type QuestionBankType = 'multiple-choice' | 'true-false' | 'short-answer' | 'essay' | 'matching' | 'ordering' | 'fill-in-the-blanks' | 'audio-response' | 'hotspot' | 'code-lab';

export interface QuestionBank {
    id: string;
    organization_id: string;
    question_text: string;
    question_type: QuestionBankType;
    options?: unknown;
    correct_answer?: unknown;
    explanation?: string;
    audio_url?: string;
    audio_text?: string;
    audio_status?: 'pending' | 'generating' | 'ready' | 'failed';
    audio_metadata?: unknown;
    media_url?: string;
    media_type?: string;
    points: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    tags?: string[];
    skill_assessed?: 'reading' | 'listening' | 'speaking' | 'writing';
    source?: 'manual' | 'ai-generated' | 'rag-ai' | 'imported-mysql' | 'imported-material' | 'imported-csv' | 'sam-diagnostico';
    source_metadata?: unknown;
    usage_count?: number;
    last_used_at?: string;
    is_active: boolean;
    is_archived: boolean;
    created_by?: string;
    created_at: string;
    updated_at: string;
}

export interface QuestionBankFilters {
    question_type?: QuestionBankType;
    difficulty?: string;
    tags?: string;
    source?: string;
    search?: string;
    has_audio?: boolean;
}

export interface CreateQuestionBankPayload {
    question_text: string;
    question_type: QuestionBankType;
    options?: unknown;
    correct_answer?: unknown;
    explanation?: string;
    points?: number;
    difficulty?: string;
    tags?: string[];
    media_url?: string;
    media_type?: string;
    skill_assessed?: string;
    audio_url?: string;
    audio_text?: string;
}

export interface UpdateQuestionBankPayload {
    question_text?: string;
    question_type?: QuestionBankType;
    options?: unknown;
    correct_answer?: unknown;
    explanation?: string;
    points?: number;
    difficulty?: string;
    tags?: string[];
    is_active?: boolean;
    is_archived?: boolean;
    skill_assessed?: string;
    audio_url?: string;
    audio_text?: string;
}

const toSafeQuestionBankText = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (Array.isArray(value)) {
        return value.map((v) => toSafeQuestionBankText(v)).filter(Boolean).join(', ');
    }
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        if (typeof obj.answer === 'string') return obj.answer;
        if (typeof obj.text === 'string') return obj.text;
        if (typeof obj.label === 'string') return obj.label;
        try {
            return JSON.stringify(obj);
        } catch {
            return '';
        }
    }
    return '';
};

const normalizeQuestionBank = (q: QuestionBank): QuestionBank => {
    const safeTags = Array.isArray(q.tags)
        ? q.tags.map((tag) => toSafeQuestionBankText(tag)).filter(Boolean)
        : [];

    const safeOptions = Array.isArray(q.options)
        ? q.options.map((opt) => toSafeQuestionBankText(opt))
        : q.options;

    const safeCorrectAnswer = (() => {
        const raw = q.correct_answer;
        if (Array.isArray(raw)) {
            return raw.map((item) => toSafeQuestionBankText(item));
        }
        if (raw && typeof raw === 'object') {
            const obj = raw as Record<string, unknown>;
            if (Array.isArray(obj.pairs)) {
                return obj.pairs.map((pair) => {
                    if (pair && typeof pair === 'object') {
                        const pairObj = pair as Record<string, unknown>;
                        return {
                            left: toSafeQuestionBankText(pairObj.left ?? pairObj[0]),
                            right: toSafeQuestionBankText(pairObj.right ?? pairObj[1]),
                        };
                    }
                    return {
                        left: toSafeQuestionBankText(pair),
                        right: '',
                    };
                });
            }
            if ('answer' in obj || 'keywords' in obj || 'text' in obj || 'label' in obj) {
                return toSafeQuestionBankText(obj);
            }
        }
        return raw;
    })();

    return {
        ...q,
        question_text: toSafeQuestionBankText(q.question_text),
        tags: safeTags,
        options: safeOptions,
        correct_answer: safeCorrectAnswer,
    };
};

export const questionBankApi = {
    list: async (filters?: QuestionBankFilters): Promise<QuestionBank[]> => {
        const questions = await apiFetch('/question-bank', { method: 'GET', query: filters as Record<string, string | number | boolean | undefined | null> }, false);
        return (questions as QuestionBank[]).map(normalizeQuestionBank);
    },
    get: async (id: string): Promise<QuestionBank> => {
        const question = await apiFetch(`/question-bank/${id}`, {}, false);
        return normalizeQuestionBank(question as QuestionBank);
    },
    create: async (payload: CreateQuestionBankPayload): Promise<QuestionBank> => {
        const question = await apiFetch('/question-bank', { method: 'POST', body: JSON.stringify(payload) }, false);
        return normalizeQuestionBank(question as QuestionBank);
    },
    update: async (id: string, payload: UpdateQuestionBankPayload): Promise<QuestionBank> => {
        const question = await apiFetch(`/question-bank/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, false);
        return normalizeQuestionBank(question as QuestionBank);
    },
    delete: (id: string): Promise<void> =>
        apiFetch(`/question-bank/${id}`, { method: 'DELETE' }, false),
    importFromMySQL: async (courseId?: number, questionIds?: number[], importAll?: boolean): Promise<QuestionBank[]> => {
        const questions = await apiFetch('/question-bank/import-mysql', { method: 'POST', body: JSON.stringify({ mysql_course_id: courseId, question_ids: questionIds, import_all: importAll }) }, false);
        return (questions as QuestionBank[]).map(normalizeQuestionBank);
    },
    getMySQLPlans: async (): Promise<MySqlPlan[]> => {
        const plans = (await apiFetch('/question-bank/mysql-plans', {}, false)) as MySqlPlanRaw[];
        return plans.reduce((acc: MySqlPlan[], p: MySqlPlanRaw) => {
            const idPlanDeEstudios = p.idPlanDeEstudios ?? p.id_plan_de_estudios;
            const nombrePlan = p.NombrePlan ?? p.nombre_plan;
            if (typeof idPlanDeEstudios === 'number' && typeof nombrePlan === 'string' && nombrePlan.trim()) {
                acc.push({ idPlanDeEstudios, NombrePlan: nombrePlan });
            }
            return acc;
        }, []);
    },
    getMySQLCoursesByPlan: async (planId: number): Promise<MySqlCourse[]> => {
        const courses = (await apiFetch(`/question-bank/mysql-courses?plan_id=${planId}`, {}, false)) as MySqlCourseRaw[];
        return courses.reduce((acc: MySqlCourse[], c: MySqlCourseRaw) => {
            const idCursos = c.idCursos ?? c.id_cursos;
            const nombreCurso = c.NombreCurso ?? c.nombre_curso;
            const idPlanDeEstudios = c.idPlanDeEstudios ?? c.id_plan_de_estudios;
            const nombrePlan = c.NombrePlan ?? c.nombre_plan;
            if (
                typeof idCursos === 'number' &&
                typeof nombreCurso === 'string' &&
                nombreCurso.trim() &&
                typeof idPlanDeEstudios === 'number' &&
                typeof nombrePlan === 'string' &&
                nombrePlan.trim()
            ) {
                acc.push({
                    idCursos,
                    NombreCurso: nombreCurso,
                    NivelCurso: c.NivelCurso ?? c.nivel_curso,
                    idPlanDeEstudios,
                    NombrePlan: nombrePlan,
                    Duracion: c.Duracion ?? c.duracion,
                });
            }
            return acc;
        }, []);
    },
};

interface MySqlPlanRaw {
    idPlanDeEstudios?: number;
    NombrePlan?: string;
    id_plan_de_estudios?: number;
    nombre_plan?: string;
}

export interface MySqlPlan {
    idPlanDeEstudios: number;
    NombrePlan: string;
}

interface MySqlCourseRaw {
    idCursos?: number;
    NombreCurso?: string;
    NivelCurso?: number;
    idPlanDeEstudios?: number;
    NombrePlan?: string;
    Duracion?: number;
    id_cursos?: number;
    nombre_curso?: string;
    nivel_curso?: number;
    id_plan_de_estudios?: number;
    nombre_plan?: string;
    duracion?: number;
}

export interface MySqlCourse {
    idCursos: number;
    NombreCurso: string;
    NivelCurso?: number;
    idPlanDeEstudios: number;
    NombrePlan: string;
    Duracion?: number;  // Duration in hours (40=regular, 80=intensive)
}

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

    // Audio Responses
    getAudioResponses: (filters?: AudioResponseFilters): Promise<AudioResponse[]> => {
        const query: Record<string, string> = {};
        if (filters?.course_id) query.course_id = filters.course_id;
        if (filters?.lesson_id) query.lesson_id = filters.lesson_id;
        if (filters?.status) query.status = filters.status;
        if (filters?.user_id) query.user_id = filters.user_id;
        return apiFetch('/audio-responses', { method: 'GET', query }, true);
    },
    getAudioResponseDetail: (id: string): Promise<AudioResponse> =>
        apiFetch(`/audio-responses/${id}`, { method: 'GET' }, true),
    getAudioResponseAudio: (id: string): Promise<Blob> => {
        const token = getToken();
        return fetch(`${LMS_API_BASE_URL}/audio-responses/${id}/audio`, {
            method: 'GET',
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        }).then(async res => {
            if (!res.ok) throw new Error('Failed to fetch audio');
            return res.blob();
        });
    },
    evaluateAudioResponse: (id: string, teacherScore: number, teacherFeedback?: string): Promise<{ success: boolean; message: string }> =>
        apiFetch(`/audio-responses/${id}/evaluate`, {
            method: 'POST',
            body: JSON.stringify({ teacher_score: teacherScore, teacher_feedback: teacherFeedback })
        }, true),
    getCourseAudioResponseStats: (courseId: string): Promise<AudioResponseStats> =>
        apiFetch(`/courses/${courseId}/audio-responses/stats`, { method: 'GET' }, true),

    // FAQ moderation from student AI chats
    importFaqCandidates: (limit = 50): Promise<{ imported: number; skipped: number }> =>
        apiFetch('/faq/review/import-candidates', {
            method: 'POST',
            body: JSON.stringify({ limit })
        }, true),
    getFaqReviewQueue: (
        status?: 'pending' | 'answered' | 'published' | 'dismissed',
        limit = 50,
        offset = 0
    ): Promise<FaqReviewQueueResponse> =>
        apiFetch('/faq/review-queue', {
            method: 'GET',
            query: { status, limit, offset }
        }, true),
    answerFaqReviewItem: (
        itemId: string,
        payload: {
            human_answer: string;
            reviewer_note?: string;
            publish_to_faq?: boolean;
            tags?: string[];
        }
    ): Promise<void> =>
        apiFetch(`/faq/review-queue/${itemId}/answer`, {
            method: 'POST',
            body: JSON.stringify(payload)
        }, true),
    dismissFaqReviewItem: (itemId: string, reviewer_note?: string): Promise<void> =>
        apiFetch(`/faq/review-queue/${itemId}/dismiss`, {
            method: 'POST',
            body: JSON.stringify({ reviewer_note })
        }, true),
    listFaqEntries: (search?: string, limit = 100, offset = 0): Promise<FaqEntry[]> =>
        apiFetch('/faq/entries', {
            method: 'GET',
            query: { search, limit, offset }
        }, true),
    getAiAuditLogs: (
        reviewed?: boolean,
        limit = 50,
        offset = 0
    ): Promise<AiAuditListResponse> =>
        apiFetch('/ai/audit/logs', {
            method: 'GET',
            query: { reviewed, limit, offset }
        }, true),
    reviewAiAuditLog: (
        logId: string,
        payload: { reviewed: boolean; reviewer_note?: string }
    ): Promise<{ id: string; reviewed: boolean }> =>
        apiFetch(`/ai/audit/logs/${logId}/review`, {
            method: 'POST',
            body: JSON.stringify(payload)
        }, true),
    getAiAuditMetrics: (days = 30): Promise<AiAuditMetrics> =>
        apiFetch('/ai/audit/metrics', {
            method: 'GET',
            query: { days }
        }, true),
    getAiDataEthicsSummary: (
        days = 30,
        limit = 40
    ): Promise<AiDataEthicsSummaryResponse> =>
        apiFetch('/ai/data-ethics/summary', {
            method: 'GET',
            query: { days, limit }
        }, true),

    // Análisis Pedagógico Profundo (Fase 34)
    getCourseQualityMetrics: (courseId: string): Promise<CourseQualityMetrics> =>
        apiFetch(`/courses/${courseId}/pedagogical/quality-metrics`, {}, true),
    getCourseDiscriminationIndex: (courseId: string): Promise<CourseDiscriminationReport> =>
        apiFetch(`/courses/${courseId}/pedagogical/discrimination-index`, {}, true),
    getCourseSuggestions: (courseId: string): Promise<CurricularSuggestionsReport> =>
        apiFetch(`/courses/${courseId}/pedagogical/suggestions`, {}, true),

    // Fase 35: Ecosistema de Plugins
    listPlugins: (): Promise<OrgPlugin[]> =>
        apiFetch('/plugins', {}, true),
    createPlugin: (payload: CreatePluginPayload): Promise<OrgPlugin> =>
        apiFetch('/plugins', { method: 'POST', body: JSON.stringify(payload) }, true),
    updatePlugin: (id: string, payload: UpdatePluginPayload): Promise<OrgPlugin> =>
        apiFetch(`/plugins/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, true),
    deletePlugin: (id: string): Promise<void> =>
        apiFetch(`/plugins/${id}`, { method: 'DELETE' }, true),

    // Fase 36: LTI 1.3 Tool Consumer
    listCourseLtiTools: (courseId: string): Promise<LtiExternalTool[]> =>
        apiFetch(`/courses/${courseId}/lti-tools`, {}, true),
    createCourseLtiTool: (courseId: string, payload: CreateLtiExternalToolPayload): Promise<LtiExternalTool> =>
        apiFetch(`/courses/${courseId}/lti-tools`, { method: 'POST', body: JSON.stringify(payload) }, true),
    updateCourseLtiTool: (courseId: string, toolId: string, payload: UpdateLtiExternalToolPayload): Promise<LtiExternalTool> =>
        apiFetch(`/courses/${courseId}/lti-tools/${toolId}`, { method: 'PUT', body: JSON.stringify(payload) }, true),
    deleteCourseLtiTool: (courseId: string, toolId: string): Promise<void> =>
        apiFetch(`/courses/${courseId}/lti-tools/${toolId}`, { method: 'DELETE' }, true),
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
    criteria: unknown;
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

export interface FaqReviewItem {
    id: string;
    source_ai_usage_log_id?: string;
    user_id: string;
    student_name?: string;
    student_email?: string;
    lesson_id?: string;
    session_id?: string;
    question_text: string;
    ai_response?: string;
    rag_context_found: boolean;
    status: 'pending' | 'answered' | 'published' | 'dismissed';
    reviewer_id?: string;
    reviewer_name?: string;
    reviewer_note?: string;
    human_answer?: string;
    faq_entry_id?: string;
    created_at: string;
    reviewed_at?: string;
}

export interface FaqReviewQueueResponse {
    items: FaqReviewItem[];
    total: number;
    limit: number;
    offset: number;
}

export interface FaqEntry {
    id: string;
    organization_id: string;
    question: string;
    answer: string;
    tags?: string[];
    source: string;
    created_by?: string;
    is_published: boolean;
    created_at: string;
    updated_at: string;
}

export interface AiAuditItem {
    id: string;
    user_id: string;
    student_name?: string;
    endpoint: string;
    model: string;
    output_tokens: number;
    has_rag_context: boolean;
    risk_score: number;
    risk_signals: string[];
    response_excerpt: string;
    reviewed: boolean;
    reviewed_by?: string;
    reviewed_by_name?: string;
    reviewer_note?: string;
    created_at: string;
}

export interface AiAuditListResponse {
    items: AiAuditItem[];
    limit: number;
    offset: number;
}

export interface AiAuditWeightedScoreDist {
    low: number;    // score 1–2
    medium: number; // score 3–5
    high: number;   // score ≥ 6
}

export interface AiAuditMetrics {
    days: number;
    total_chat_logs: number;
    total_flagged: number;
    total_reviewed: number;
    flagged_pct: number;
    reviewed_pct: number;
    signal_counts: Record<string, number>;
    weighted_score_distribution: AiAuditWeightedScoreDist;
}

export interface AiDataEthicsEventItem {
    id: string;
    endpoint: string;
    model: string;
    request_type: string;
    tokens_used: number;
    input_tokens: number;
    output_tokens: number;
    has_rag_context: boolean;
    created_at: string;
}

export interface AiDataEthicsSummary {
    days_window: number;
    total_requests: number;
    total_tokens: number;
    total_input_tokens: number;
    total_output_tokens: number;
    average_tokens_per_request: number;
    model_count: number;
    request_type_count: number;
    retention_days: number;
    stored_fields: string[];
}

export interface AiDataEthicsSummaryResponse {
    summary: AiDataEthicsSummary;
    events: AiDataEthicsEventItem[];
}

// Fase 35: Ecosistema de Plugins
export interface OrgPlugin {
    id: string;
    organization_id: string;
    name: string;
    description: string;
    component_url: string;
    icon_url: string | null;
    config: Record<string, unknown>;
    enabled: boolean;
    created_at: string;
    updated_at: string;
}
export interface CreatePluginPayload {
    name: string;
    description?: string;
    component_url: string;
    icon_url?: string;
    config?: Record<string, unknown>;
}
export interface UpdatePluginPayload {
    name?: string;
    description?: string;
    component_url?: string;
    icon_url?: string;
    config?: Record<string, unknown>;
    enabled?: boolean;
}

// Fase 36: LTI 1.3 Tool Consumer
export interface LtiExternalTool {
    id: string;
    organization_id: string;
    course_id: string;
    name: string;
    launch_url: string;
    enabled: boolean;
    config: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}
export interface CreateLtiExternalToolPayload {
    name: string;
    launch_url: string;
    shared_secret: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
}
export interface UpdateLtiExternalToolPayload {
    name?: string;
    launch_url?: string;
    shared_secret?: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
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

export interface CourseTemplateSummary {
    id: string;
    name: string;
    description?: string | null;
    source_course_id?: string | null;
    created_at: string;
    updated_at: string;
}

export interface BackgroundTask {
    id: string;
    title: string;
    course_title?: string;
    task_type: 'lesson_transcription' | 'lesson_image' | 'course_image' | 'zip_rag_import';
    status: 'idle' | 'queued' | 'processing' | 'failed' | 'completed' | 'error';
    progress: number;
    processed_items: number;
    failed_items: number;
    error_message?: string;
    updated_at: string;
}

// ==================== Test Templates ====================

export type CourseLevel = 'beginner' | 'beginner_1' | 'beginner_2' | 'intermediate' | 'intermediate_1' | 'intermediate_2' | 'advanced' | 'advanced_1' | 'advanced_2';
export type CourseType = 'intensive' | 'regular';
export type TestType = 'CA' | 'MWT' | 'MOT' | 'FOT' | 'FWT';
export type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer' | 'essay' | 'matching' | 'ordering' | 'fill-in-the-blanks' | 'audio-response';

export interface TestTemplate {
    id: string;
    organization_id: string;
    mysql_course_id?: number; // Reference to imported MySQL course
    name: string;
    description?: string;
    level?: CourseLevel; // Deprecated: use mysql_course_id instead
    course_type?: CourseType; // Deprecated: use mysql_course_id instead
    test_type: TestType;
    duration_minutes: number;
    passing_score: number;
    total_points: number;
    instructions?: string;
    template_data: unknown;
    tags?: string[];
    is_active: boolean;
    usage_count: number;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface TestTemplateSection {
    id: string;
    template_id: string;
    title: string;
    description?: string;
    section_order: number;
    points: number;
    instructions?: string;
    section_data?: unknown;
    created_at: string;
}

export interface TestTemplateQuestion {
    id: string;
    template_id: string;
    section_id?: string;
    question_order: number;
    question_type: QuestionType;
    question_text: string;
    options?: unknown;
    correct_answer?: unknown;
    explanation?: string;
    points: number;
    metadata?: unknown;
    created_at: string;
}

export interface TestTemplateWithQuestions {
    template: TestTemplate;
    sections: TestTemplateSection[];
    questions: TestTemplateQuestion[];
}

export interface CreateTestTemplatePayload {
    name: string;
    description?: string;
    mysql_course_id?: number; // Reference to imported MySQL course (preferred)
    level?: CourseLevel; // Fallback if mysql_course_id not provided
    course_type?: CourseType; // Fallback if mysql_course_id not provided
    test_type: TestType;
    duration_minutes: number;
    passing_score: number;
    total_points: number;
    instructions?: string;
    template_data: unknown;
    tags?: string[];
}

export interface UpdateTestTemplatePayload {
    name?: string;
    description?: string;
    mysql_course_id?: number;
    level?: CourseLevel;
    course_type?: CourseType;
    test_type?: TestType;
    duration_minutes?: number;
    passing_score?: number;
    total_points?: number;
    instructions?: string;
    template_data?: unknown;
    tags?: string[];
    is_active?: boolean;
}

export interface CreateQuestionPayload {
    section_id?: string;
    question_order: number;
    question_type: string;
    question_text: string;
    options?: unknown;
    correct_answer?: unknown;
    explanation?: string;
    points: number;
    metadata?: unknown;
}

export interface CreateSectionPayload {
    title: string;
    description?: string;
    section_order: number;
    points: number;
    instructions?: string;
    section_data?: unknown;
}

export interface TestTemplateFilters {
    mysql_course_id?: number;
    test_type?: TestType;
    tags?: string;
    search?: string;
}

// ==================== AUDIO RESPONSE INTERFACES ====================

export interface AudioResponse {
    id: string;
    user_id: string;
    student_name: string;
    student_email: string;
    course_id: string;
    course_title: string;
    lesson_id: string;
    lesson_title: string;
    block_id: string;
    prompt: string;
    transcript: string | null;
    ai_score: number | null;
    ai_found_keywords: string[] | null;
    ai_feedback: string | null;
    teacher_score: number | null;
    teacher_feedback: string | null;
    status: 'pending' | 'ai_evaluated' | 'teacher_evaluated' | 'both_evaluated';
    created_at: string;
    attempt_number: number;
}

export interface AudioResponseStats {
    organization_id: string;
    course_id: string;
    lesson_id: string;
    total_responses: number;
    ai_evaluated: number;
    teacher_evaluated: number;
    fully_evaluated: number;
    pending: number;
    avg_ai_score: number | null;
    avg_teacher_score: number | null;
}

export interface AudioResponseFilters {
    course_id?: string;
    lesson_id?: string;
    status?: string;
    user_id?: string;
}

// ==================== AUDIO RESPONSE API ====================

export async function getAudioResponses(filters?: AudioResponseFilters): Promise<AudioResponse[]> {
    const query: Record<string, string> = {};
    if (filters?.course_id) query.course_id = filters.course_id;
    if (filters?.lesson_id) query.lesson_id = filters.lesson_id;
    if (filters?.status) query.status = filters.status;
    if (filters?.user_id) query.user_id = filters.user_id;

    return apiFetch('/audio-responses', { method: 'GET', query }, true);
}

export async function getAudioResponseDetail(id: string): Promise<AudioResponse> {
    return apiFetch(`/audio-responses/${id}`, { method: 'GET' }, true);
}

export async function getAudioResponseAudio(id: string): Promise<Blob> {
    const token = getToken();
    const response = await fetch(`${LMS_API_BASE_URL}/audio-responses/${id}/audio`, {
        method: 'GET',
        headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
    });
    
    if (!response.ok) {
        throw new Error('Failed to fetch audio');
    }
    
    return response.blob();
}

export async function evaluateAudioResponse(
    id: string, 
    teacherScore: number, 
    teacherFeedback?: string
): Promise<{ success: boolean; message: string }> {
    return apiFetch(`/audio-responses/${id}/evaluate`, {
        method: 'POST',
        body: JSON.stringify({
            teacher_score: teacherScore,
            teacher_feedback: teacherFeedback
        })
    }, true);
}

export async function getCourseAudioResponseStats(courseId: string): Promise<AudioResponseStats> {
    return apiFetch(`/courses/${courseId}/audio-responses/stats`, { method: 'GET' }, true);
}