const LEARNING_DOMAIN = process.env.NEXT_PUBLIC_LEARNING_DOMAIN || 'learning.norteamericano.com';

const getApiBaseUrl = (defaultPort: string, envVar?: string) => {
    if (envVar && envVar.trim() !== '') {
        return envVar;
    }
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        return `${protocol}//${hostname}:${defaultPort}`;
    }
    return `http://localhost:${defaultPort}`;
};

export const getLmsApiUrl = () => {
    if (typeof window !== 'undefined' && window.location.hostname === LEARNING_DOMAIN) {
        return `${window.location.protocol}//${LEARNING_DOMAIN}/lms-api`;
    }
    return getApiBaseUrl("3002", process.env.NEXT_PUBLIC_LMS_API_URL);
};
export const getCmsApiUrl = () => {
    if (typeof window !== 'undefined' && window.location.hostname === LEARNING_DOMAIN) {
        return `${window.location.protocol}//${LEARNING_DOMAIN}/cms-api`;
    }
    return getApiBaseUrl("3001", process.env.NEXT_PUBLIC_CMS_API_URL);
};

// Enrollment progress has existed in two formats historically:
// legacy ratio [0..1] and current percentage [0..100].
export const normalizeProgressPercent = (raw?: number) => {
    if (typeof raw !== 'number' || Number.isNaN(raw)) return 0;
    const pct = raw <= 1 ? raw * 100 : raw;
    return Math.max(0, Math.min(100, pct));
};

export const getImageUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('http')) {
        // Avoid browser CORS issues with private S3 objects by proxying through CMS.
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
                        return `${getCmsApiUrl()}/api/assets/s3-proxy/${encodeURIComponent(bucket)}/${normalizedKey}`;
                    }
                }

                if (bucket && key) {
                    return `${getCmsApiUrl()}/api/assets/s3-proxy/${encodeURIComponent(bucket)}/${key}`;
                }
            }
        } catch {
            // Ignore URL parsing errors and fallback to original path.
        }

        return path;
    }

    // Handle persisted S3 URI format: s3://bucket/key
    if (path.startsWith('s3://')) {
        const withoutScheme = path.slice(5);
        const firstSlash = withoutScheme.indexOf('/');
        if (firstSlash > 0) {
            const bucket = withoutScheme.slice(0, firstSlash);
            const key = withoutScheme.slice(firstSlash + 1);
            if (bucket && key) {
                return `${getCmsApiUrl()}/api/assets/s3-proxy/${encodeURIComponent(bucket)}/${key}`;
            }
        }
    }

    // Handle plain object keys when stored directly in DB.
    if (/^org\/.+/.test(path)) {
        const defaultBucket = process.env.NEXT_PUBLIC_S3_BUCKET || 'openccb-802726101181-us-east-2-an';
        return `${getCmsApiUrl()}/api/assets/s3-proxy/${encodeURIComponent(defaultBucket)}/${path.replace(/^\//, '')}`;
    }

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
    logo_variant?: string;
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
    transcript?: string;
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
}

export interface PaymentPreferenceResponse {
    preference_id: string;
    init_point: string;
}

export interface CertificateResponse {
    id: string;
    user_id: string;
    course_id: string;
    course_title: string;
    student_name: string;
    certificate_html: string;
    issued_at: string;
    verification_code: string;
    metadata: any;
}

export interface CertificateResponse {
    id: string;
    user_id: string;
    course_id: string;
    course_title: string;
    student_name: string;
    certificate_html: string;
    issued_at: string;
    verification_code: string;
    metadata: any;
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
    type: 'description' | 'media' | 'quiz' | 'fill-in-the-blanks' | 'matching' | 'ordering' | 'short-answer' | 'code' | 'hotspot' | 'memory-match' | 'document' | 'audio-response' | 'video_marker' | 'peer-review' | 'role-playing' | 'mermaid' | 'code-lab' | 'scorm' | 'plugin' | 'lti-tool';
    title: string;
    content?: string;
    url?: string;
    media_type?: 'video' | 'audio';
    config?: Record<string, unknown>;
    quiz_data?: {
        questions: QuizQuestion[];
        test_type?: string;
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
    reviewCriteria?: string;
    imageUrl?: string;
    hotspots?: {
        id: string;
        x: number;
        y: number;
        radius: number;
        label: string;
    }[];
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
    initial_code?: string;
    solution?: string;
    test_cases?: { description: string; expected: string }[];
    // SCORM/xAPI fields
    launch_url?: string;
    metadata?: any;
    // Plugin fields
    component_url?: string;
}

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

export interface TrackXapiPayload {
    course_id: string;
    lesson_id: string;
    verb: string;
    object_id: string;
    score?: number;
    progress?: number;
    completed?: boolean;
    raw_statement?: unknown;
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
    content_blocks?: Block[];
    is_graded: boolean;
    grading_category_id: string | null;
    max_attempts: number | null;
    allow_retry: boolean;
    position: number;
    due_date?: string;
    important_date_type?: 'exam' | 'assignment' | 'milestone' | 'live-session';
    is_previewable: boolean;
    created_at: string;
}

export interface GradingCategory {
    id: string;
    course_id: string;
    name: string;
    weight: number;
    drop_count: number;
}

export interface LessonDependency {
    id: string;
    organization_id: string;
    lesson_id: string;
    prerequisite_lesson_id: string;
    min_score_percentage: number | null;
    created_at: string;
}

export interface CollaborativeCanvasState {
    strokes?: Array<{
        points: Array<{ x: number; y: number }>;
        color?: string;
        width?: number;
    }>;
    [key: string]: unknown;
}

export interface CollaborativeCanvas {
    lesson_id: string;
    canvas_state: CollaborativeCanvasState;
    revision: number;
    updated_at?: string | null;
}

export interface CollaborativeCanvasUpdateResult {
    lesson_id: string;
    revision: number;
    updated_at: string;
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

export interface CourseSubmission {
    id: string;
    user_id: string;
    course_id: string;
    lesson_id: string;
    content: string;
    submitted_at: string;
    final_score?: number | null;
    review_count: number;
    status: 'pending' | 'under_review' | 'graded';
}

export interface PeerReview {
    id: string;
    submission_id: string;
    reviewer_id: string;
    score: number;
    feedback: string;
    is_instructor_review: boolean;
    created_at: string;
}

export interface PeerReviewSettings {
    id: string;
    lesson_id: string;
    required_reviews: number;
    peer_weight: number;
    instructor_weight: number;
    rubric_id?: string | null;
    auto_assign: boolean;
    created_at: string;
    updated_at: string;
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

export interface DailyProgress {
    date: string;
    count: number;
}

export interface UserBookmark {
    id: string;
    organization_id: string;
    user_id: string;
    course_id: string;
    lesson_id: string;
    created_at: string;
}

export interface ProgressStats {
    total_lessons: number;
    completed_lessons: number;
    progress_percentage: number;
    daily_completions: DailyProgress[];
    estimated_completion_date?: string;
}

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
    level: number;
    xp: number;
    badges: Badge[];
    completed_courses_count: number;
}

export interface AuthResponse {
    user: User;
    token: string;
}

export interface AuthPayload {
    email: string;
    password?: string;
    full_name?: string;
}

export interface Enrollment {
    id: string;
    user_id: string;
    course_id: string;
    progress: number;
    enrolled_at: string;
}

export interface Module {
    id: string;
    course_id: string;
    title: string;
    position: number;
    lessons: Lesson[];
}

export interface StudentNote {
    id: string;
    user_id: string;
    lesson_id: string;
    content: string;
    created_at: string;
    updated_at: string;
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



export const getToken = () => {
    if (typeof window === 'undefined') return null;

    // Check for preview token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const previewToken = urlParams.get('preview_token');

    if (previewToken) {
        sessionStorage.setItem('preview_token', previewToken);
        return previewToken;
    }

    return sessionStorage.getItem('preview_token') || null;
};

const OFFLINE_QUEUE_KEY = 'experience_offline_mutation_queue_v1';
const OFFLINE_SYNC_META_KEY = 'experience_offline_sync_meta_v1';

type OfflineMutationKind = 'grade' | 'interaction' | 'xapi';

type OfflineMutationItem = {
    id: string;
    dedupeKey: string;
    kind: OfflineMutationKind;
    url: string;
    method: 'POST' | 'PUT' | 'DELETE';
    isCMS: boolean;
    body: string;
    createdAt: string;
};

export type OfflineSyncStatus = {
    pending: number;
    isFlushing: boolean;
    lastSyncAt: string | null;
    lastFlushedCount: number;
    lastError: string | null;
};

const offlineSyncListeners = new Set<(status: OfflineSyncStatus) => void>();
let offlineFlushPromise: Promise<{ flushed: number; pending: number }> | null = null;
let inMemoryOfflineStatus: OfflineSyncStatus = {
    pending: 0,
    isFlushing: false,
    lastSyncAt: null,
    lastFlushedCount: 0,
    lastError: null,
};

const loadOfflineQueue = (): OfflineMutationItem[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return (parsed as OfflineMutationItem[]).map((item) => ({
            ...item,
            dedupeKey: item.dedupeKey || `${item.method}:${item.url}:${item.body}`,
        }));
    } catch {
        return [];
    }
};

const loadOfflineSyncMeta = (): Partial<OfflineSyncStatus> => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(OFFLINE_SYNC_META_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return {};
        return parsed as Partial<OfflineSyncStatus>;
    } catch {
        return {};
    }
};

const saveOfflineSyncMeta = (status: OfflineSyncStatus) => {
    if (typeof window === 'undefined') return;
    const persistable = {
        lastSyncAt: status.lastSyncAt,
        lastFlushedCount: status.lastFlushedCount,
        lastError: status.lastError,
    };
    localStorage.setItem(OFFLINE_SYNC_META_KEY, JSON.stringify(persistable));
};

const emitOfflineSyncStatus = (partial: Partial<OfflineSyncStatus>) => {
    const queue = loadOfflineQueue();
    inMemoryOfflineStatus = {
        ...inMemoryOfflineStatus,
        ...partial,
        pending: queue.length,
    };
    saveOfflineSyncMeta(inMemoryOfflineStatus);
    offlineSyncListeners.forEach((listener) => listener(inMemoryOfflineStatus));
};

const hydrateOfflineSyncStatus = () => {
    const meta = loadOfflineSyncMeta();
    const queue = loadOfflineQueue();
    inMemoryOfflineStatus = {
        pending: queue.length,
        isFlushing: false,
        lastSyncAt: typeof meta.lastSyncAt === 'string' ? meta.lastSyncAt : null,
        lastFlushedCount: typeof meta.lastFlushedCount === 'number' ? meta.lastFlushedCount : 0,
        lastError: typeof meta.lastError === 'string' ? meta.lastError : null,
    };
};

hydrateOfflineSyncStatus();

const saveOfflineQueue = (queue: OfflineMutationItem[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    emitOfflineSyncStatus({ pending: queue.length });
};

const enqueueOfflineMutation = (item: OfflineMutationItem) => {
    const queue = loadOfflineQueue();
    const duplicate = queue.some((queued) => queued.dedupeKey === item.dedupeKey);
    if (duplicate) return;
    queue.push(item);
    saveOfflineQueue(queue);
};

const getOfflineSyncStatusSnapshot = (): OfflineSyncStatus => {
    const queue = loadOfflineQueue();
    return {
        ...inMemoryOfflineStatus,
        pending: queue.length,
    };
};

const subscribeOfflineSync = (listener: (status: OfflineSyncStatus) => void) => {
    offlineSyncListeners.add(listener);
    listener(getOfflineSyncStatusSnapshot());
    return () => {
        offlineSyncListeners.delete(listener);
    };
};

const buildApiHeaders = (options: RequestInit = {}) => {
    const token = getToken();
    const isFormData = options.body instanceof FormData;
    return {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...Object.fromEntries(Object.entries(options.headers || {}).map(([k, v]) => [k, String(v)])),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    } as Record<string, string>;
};

const flushOfflineQueueInternal = async () => {
    if (offlineFlushPromise) {
        return offlineFlushPromise;
    }

    const run = async () => {
    if (typeof window === 'undefined') return { flushed: 0, pending: 0 };
    emitOfflineSyncStatus({ isFlushing: true, lastError: null });

    if (!navigator.onLine) {
        const pending = loadOfflineQueue().length;
        emitOfflineSyncStatus({ isFlushing: false, pending, lastError: 'offline' });
        return { flushed: 0, pending };
    }

    const queue = loadOfflineQueue();
    if (!queue.length) {
        emitOfflineSyncStatus({
            isFlushing: false,
            pending: 0,
            lastSyncAt: new Date().toISOString(),
            lastFlushedCount: 0,
            lastError: null,
        });
        return { flushed: 0, pending: 0 };
    }

    const stillPending: OfflineMutationItem[] = [];
    let flushed = 0;

    for (const item of queue) {
        try {
            const baseUrl = item.isCMS ? getCmsApiUrl() : getLmsApiUrl();
            const response = await fetch(`${baseUrl}${item.url}`, {
                method: item.method,
                body: item.body,
                headers: buildApiHeaders({ body: item.body })
            });

            if (!response.ok) {
                // 4xx validation/auth errors should not block the queue forever.
                if (response.status >= 500) {
                    stillPending.push(item);
                }
                continue;
            }

            flushed += 1;
        } catch {
            stillPending.push(item);
        }
    }

    saveOfflineQueue(stillPending);
    emitOfflineSyncStatus({
        isFlushing: false,
        pending: stillPending.length,
        lastSyncAt: new Date().toISOString(),
        lastFlushedCount: flushed,
        lastError: stillPending.length ? 'partial' : null,
    });
    return { flushed, pending: stillPending.length };
    };

    offlineFlushPromise = run().finally(() => {
        offlineFlushPromise = null;
    });

    return offlineFlushPromise;
};

const enqueueIfOffline = async (
    kind: OfflineMutationKind,
    url: string,
    method: 'POST' | 'PUT' | 'DELETE',
    body: string,
    isCMS = false
) => {
    if (typeof window !== 'undefined' && !navigator.onLine) {
        enqueueOfflineMutation({
            id: crypto.randomUUID(),
            dedupeKey: `${method}:${url}:${body}`,
            kind,
            url,
            method,
            isCMS,
            body,
            createdAt: new Date().toISOString(),
        });
        return true;
    }

    return false;
};

const apiFetch = async (url: string, options: RequestInit = {}, isCMS: boolean = false) => {
    const baseUrl = isCMS ? getCmsApiUrl() : getLmsApiUrl();
    const headers = buildApiHeaders(options);

    const response = await fetch(`${baseUrl}${url}`, { ...options, headers, credentials: 'include' });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'An error occurred');
    }
    if (response.status === 204) return;
    return response.json();
};

export const lmsApi = {
    subscribeOfflineSync(listener: (status: OfflineSyncStatus) => void): () => void {
        return subscribeOfflineSync(listener);
    },

    getOfflineSyncStatus(): OfflineSyncStatus {
        return getOfflineSyncStatusSnapshot();
    },

    async flushOfflineQueue(): Promise<{ flushed: number; pending: number }> {
        return flushOfflineQueueInternal();
    },

    async getCatalog(orgId?: string, userId?: string): Promise<Course[]> {
        const params = new URLSearchParams();
        if (orgId) params.append('organization_id', orgId);
        if (userId) params.append('user_id', userId);
        const query = params.toString() ? `?${params.toString()}` : '';
        return apiFetch(`/catalog${query}`);
    },

    async getCourseOutline(courseId: string): Promise<{
        course: Course,
        modules: Module[],
        grading_categories: GradingCategory[],
        organization: Organization,
        instructors?: CourseInstructor[],
        dependencies?: LessonDependency[]
    }> {
        return apiFetch(`/courses/${courseId}/outline`);
    },

    async getLesson(id: string): Promise<Lesson> {
        return apiFetch(`/lessons/${id}`);
    },

    async getLessonCollaborativeCanvas(lessonId: string): Promise<CollaborativeCanvas> {
        return apiFetch(`/lessons/${lessonId}/collaborative-canvas`);
    },

    async updateLessonCollaborativeCanvas(
        lessonId: string,
        canvasState: CollaborativeCanvasState,
        expectedRevision?: number
    ): Promise<CollaborativeCanvasUpdateResult> {
        return apiFetch(`/lessons/${lessonId}/collaborative-canvas`, {
            method: 'PUT',
            body: JSON.stringify({
                canvas_state: canvasState,
                expected_revision: expectedRevision,
            })
        });
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

    async forgotPassword(email: string): Promise<{ message: string }> {
        return apiFetch('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    },

    async resetPassword(token: string, new_password: string): Promise<{ message: string }> {
        return apiFetch('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, new_password })
        });
    },

    async globalSearch(q: string, limit = 20): Promise<{ query: string; total: number; results: Array<{ id: string; kind: string; title: string; snippet?: string; url: string; course_id?: string; course_title?: string }> }> {
        return apiFetch(`/search?q=${encodeURIComponent(q)}&limit=${limit}`);
    },

    async trackXapiStatement(payload: TrackXapiPayload): Promise<{ id: string; message: string }> {
        const url = '/xapi/statements';
        const body = JSON.stringify(payload);

        if (await enqueueIfOffline('xapi', url, 'POST', body)) {
            return {
                id: `offline-${Date.now()}`,
                message: 'xAPI statement queued for sync',
            };
        }

        try {
            return await apiFetch(url, { method: 'POST', body });
        } catch (error) {
            if (typeof window !== 'undefined' && !navigator.onLine) {
                enqueueOfflineMutation({
                    id: crypto.randomUUID(),
                    dedupeKey: `POST:${url}:${body}`,
                    kind: 'xapi',
                    url,
                    method: 'POST',
                    isCMS: false,
                    body,
                    createdAt: new Date().toISOString(),
                });
                return {
                    id: `offline-${Date.now()}`,
                    message: 'xAPI statement queued for sync',
                };
            }
            throw error;
        }
    },

    async getMe(): Promise<User> {
        return apiFetch('/auth/me', {}, false);
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

    async createPaymentPreference(courseId: string): Promise<PaymentPreferenceResponse> {
        return apiFetch('/payments/preference', {
            method: 'POST',
            body: JSON.stringify({ course_id: courseId })
        });
    },

    async submitScore(userId: string, course_id: string, lessonId: string, score: number, metadata: Record<string, unknown> = {}): Promise<UserGrade> {
        const url = '/grades';
        const body = JSON.stringify({ user_id: userId, course_id, lesson_id: lessonId, score, metadata });

        if (await enqueueIfOffline('grade', url, 'POST', body)) {
            return {
                id: `offline-${Date.now()}`,
                user_id: userId,
                course_id,
                lesson_id: lessonId,
                score,
                attempts_count: 0,
                metadata: { ...metadata, sync_pending: true },
                created_at: new Date().toISOString(),
            };
        }

        try {
            return await apiFetch(url, { method: 'POST', body });
        } catch (error) {
            if (typeof window !== 'undefined' && !navigator.onLine) {
                enqueueOfflineMutation({
                    id: crypto.randomUUID(),
                    dedupeKey: `POST:${url}:${body}`,
                    kind: 'grade',
                    url,
                    method: 'POST',
                    isCMS: false,
                    body,
                    createdAt: new Date().toISOString(),
                });
                return {
                    id: `offline-${Date.now()}`,
                    user_id: userId,
                    course_id,
                    lesson_id: lessonId,
                    score,
                    attempts_count: 0,
                    metadata: { ...metadata, sync_pending: true },
                    created_at: new Date().toISOString(),
                };
            }
            throw error;
        }
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

    async getBranding(): Promise<Organization> {
        return apiFetch('/branding', {}, true);
    },

    async getCourseLanguageConfig(courseId: string): Promise<{ language_setting: 'auto' | 'fixed'; fixed_language: string | null }> {
        return apiFetch(`/courses/${courseId}/language-config`);
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
            body: formData,
            credentials: 'include'
        }).then(res => res.json());
    },

    async recordInteraction(lessonId: string, payload: { video_timestamp?: number, event_type: string, metadata?: any }): Promise<void> {
        const url = `/lessons/${lessonId}/interactions`;
        const body = JSON.stringify(payload);

        if (await enqueueIfOffline('interaction', url, 'POST', body)) {
            return;
        }

        try {
            await apiFetch(url, { method: 'POST', body });
        } catch (error) {
            if (typeof window !== 'undefined' && !navigator.onLine) {
                enqueueOfflineMutation({
                    id: crypto.randomUUID(),
                    dedupeKey: `POST:${url}:${body}`,
                    kind: 'interaction',
                    url,
                    method: 'POST',
                    isCMS: false,
                    body,
                    createdAt: new Date().toISOString(),
                });
                return;
            }
            throw error;
        }
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
    async evaluateAudioFile(file: Blob, prompt: string, keywords: string[], lessonId: string, blockId: string, duration?: number): Promise<AudioGradingResponse> {
        const formData = new FormData();
        formData.append('file', file, 'recorded_audio.webm');
        formData.append('prompt', prompt);
        formData.append('keywords', JSON.stringify(keywords));
        formData.append('lesson_id', lessonId);
        formData.append('block_id', blockId);
        if (duration) {
            formData.append('duration', duration.toString());
        }

        const token = getToken();
        return fetch(`${getLmsApiUrl()}/audio/evaluate-file`, {
            method: 'POST',
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                // Don't set Content-Type for FormData - browser sets it with boundary
            },
            body: formData,
            credentials: 'include'
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
    async chatRolePlay(lessonId: string, blockId: string, message: string, sessionId?: string): Promise<{ response: string, session_id: string }> {
        return apiFetch(`/lessons/${lessonId}/chat-role-play`, {
            method: 'POST',
            body: JSON.stringify({ message, block_id: blockId, session_id: sessionId })
        });
    },

    async getCodeHint(lessonId: string, payload: { current_code: string; error_message?: string; instructions?: string; language?: string }): Promise<{ hint: string }> {
        return apiFetch(`/lessons/${lessonId}/code-hint`, {
            method: 'POST',
            body: JSON.stringify(payload)
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
    },
    async getNote(lessonId: string): Promise<StudentNote | null> {
        return apiFetch(`/lessons/${lessonId}/notes`);
    },
    async saveNote(lessonId: string, content: string): Promise<StudentNote> {
        return apiFetch(`/lessons/${lessonId}/notes`, {
            method: 'PUT',
            body: JSON.stringify({ content })
        });
    },

    // Peer Assessment
    async submitAssignment(courseId: string, lessonId: string, content: string): Promise<CourseSubmission> {
        return apiFetch(`/courses/${courseId}/lessons/${lessonId}/submit`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
    },
    async getPeerReviewAssignment(courseId: string, lessonId: string): Promise<CourseSubmission | null> {
        return apiFetch(`/courses/${courseId}/lessons/${lessonId}/peer-review`);
    },
    async submitPeerReview(courseId: string, lessonId: string, submissionId: string, score: number, feedback: string): Promise<PeerReview> {
        return apiFetch(`/courses/${courseId}/lessons/${lessonId}/peer-review`, {
            method: 'POST',
            body: JSON.stringify({ submission_id: submissionId, score, feedback })
        });
    },
    async getMySubmissionFeedback(courseId: string, lessonId: string): Promise<PeerReview[]> {
        return apiFetch(`/courses/${courseId}/lessons/${lessonId}/feedback`);
    },
    // 41-F: Peer Review Mejorado
    async getMySubmission(courseId: string, lessonId: string): Promise<CourseSubmission | null> {
        return apiFetch(`/courses/${courseId}/lessons/${lessonId}/my-submission`);
    },
    async getPeerReviewSettings(courseId: string, lessonId: string): Promise<PeerReviewSettings | null> {
        return apiFetch(`/courses/${courseId}/lessons/${lessonId}/peer-settings`);
    },
    async getProgressStats(courseId: string): Promise<ProgressStats> {
        return apiFetch(`/courses/${courseId}/progress-stats`);
    },
    async getCourseProgress(courseId: string): Promise<{ progress_percentage: number; completed_lessons: number; total_lessons: number; completed: boolean }> {
        return apiFetch(`/courses/${courseId}/progress`);
    },
    async toggleBookmark(lessonId: string): Promise<void> {
        return apiFetch(`/lessons/${lessonId}/bookmark`, { method: 'POST' });
    },
    async getBookmarks(courseId?: string): Promise<UserBookmark[]> {
        const query = courseId ? `?cohort_id=${courseId}` : '';
        return apiFetch(`/bookmarks${query}`);
    },

    // Anotaciones en Lecciones (Fase 41-B)
    async getLessonAnnotations(lessonId: string): Promise<LessonAnnotation[]> {
        return apiFetch(`/lessons/${lessonId}/annotations`);
    },
    async createLessonAnnotation(lessonId: string, payload: CreateAnnotationPayload): Promise<LessonAnnotation> {
        return apiFetch(`/lessons/${lessonId}/annotations`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },
    async updateLessonAnnotation(lessonId: string, annotationId: string, payload: CreateAnnotationPayload): Promise<LessonAnnotation> {
        return apiFetch(`/lessons/${lessonId}/annotations/${annotationId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
    },
    async deleteLessonAnnotation(lessonId: string, annotationId: string): Promise<void> {
        return apiFetch(`/lessons/${lessonId}/annotations/${annotationId}`, { method: 'DELETE' });
    },
    async getMyAnnotations(): Promise<LessonAnnotation[]> {
        return apiFetch(`/annotations`);
    },

    // Fase 41-C: Mentoría
    async getMyMentor(courseId: string): Promise<MentorshipView | null> {
        return apiFetch(`/courses/${courseId}/my-mentor`);
    },
    async getMyMentees(courseId: string): Promise<MentorshipView[]> {
        return apiFetch(`/courses/${courseId}/my-mentees`);
    },

    // Live Learning & Portfolio
    async getMeetings(courseId: string): Promise<Meeting[]> {
        return apiFetch(`/courses/${courseId}/meetings`, {}, false);
    },

    async getPublicProfile(userId: string): Promise<PublicProfile> {
        return apiFetch(`/profile/${userId}`, {}, false);
    },

    async getMyBadges(): Promise<Badge[]> {
        return apiFetch(`/my/badges`, {}, false);
    },

    // Certificates
    async getCertificate(courseId: string): Promise<CertificateResponse> {
        return apiFetch(`/courses/${courseId}/certificate`);
    },
    async issueCertificate(courseId: string, forceReissue = false): Promise<CertificateResponse> {
        return apiFetch(`/courses/${courseId}/certificate/issue`, {
            method: 'POST',
            body: JSON.stringify({ force_reissue: forceReissue })
        });
    },
    async verifyCertificate(code: string): Promise<any> {
        return apiFetch(`/certificates/verify/${code}`);
    },

    // Fase 35: Plugins
    getEnabledPlugins(): Promise<OrgPlugin[]> {
        return apiFetch('/plugins/enabled', {}, true);
    },

    listCourseStudyRooms(courseId: string): Promise<StudyRoom[]> {
        return apiFetch(`/courses/${courseId}/study-rooms`);
    },

    joinStudyRoom(courseId: string, roomId: string): Promise<{ room_id: string; join_url: string }> {
        return apiFetch(`/courses/${courseId}/study-rooms/${roomId}/join`, { method: 'POST' });
    },

    getStudyRoomRecordings(courseId: string, roomId: string): Promise<BbbRecording[]> {
        return apiFetch(`/courses/${courseId}/study-rooms/${roomId}/recordings`);
    },

    getLessonCollaborativeDoc(lessonId: string): Promise<CollaborativeDoc> {
        return apiFetch(`/lessons/${lessonId}/collaborative-doc`);
    },

    updateLessonCollaborativeDoc(
        lessonId: string,
        payload: { content: string; base_revision: number }
    ): Promise<UpdateCollaborativeDocResponse> {
        return apiFetch(`/lessons/${lessonId}/collaborative-doc`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
    },
};

export interface StudyRoom {
    id: string;
    organization_id: string;
    course_id: string;
    created_by: string;
    title: string;
    description?: string;
    status: 'pending' | 'active' | 'ended';
    bbb_meeting_id?: string;
    join_url?: string;
    scheduled_at?: string;
    started_at?: string;
    ended_at?: string;
    max_participants: number;
    created_at: string;
    updated_at: string;
}

export interface BbbRecording {
    record_id: string;
    meeting_id: string;
    name: string;
    state: string;
    start_time: string;
    end_time: string;
    participants: number;
    playback_url: string;
    duration_minutes: number;
}

// ─── Documentos Colaborativos (Fase 40) ──────────────────────────────────────

export interface CollaborativeDoc {
    lesson_id: string;
    organization_id: string;
    content: string;
    revision: number;
    last_modified_by: string | null;
    updated_at: string;
}

export interface UpdateCollaborativeDocResponse {
    lesson_id: string;
    revision: number;
    conflict: boolean;
    server_content?: string;
    server_revision?: number;
}

// ─── Anotaciones en Lecciones (Fase 41-B) ────────────────────────────────────

export interface LessonAnnotation {
    id: string;
    user_id: string;
    lesson_id: string;
    organization_id: string;
    course_id: string;
    content: string;
    position_data: { type: 'timestamp'; value: number } | { type: 'scroll'; value: number } | null;
    created_at: string;
    updated_at: string;
}

export interface CreateAnnotationPayload {
    content: string;
    position_data?: LessonAnnotation['position_data'];
}

export interface MentorshipView {
    id: string;
    course_id: string;
    notes: string | null;
    created_at: string;
    mentor_id: string;
    mentor_name: string;
    mentor_email: string;
    mentor_avatar: string | null;
    student_id: string;
    student_name: string;
    student_email: string;
    student_avatar: string | null;
}
