export const API_BASE_URL = "http://localhost:3001";

export interface Course {
    id: string;
    title: string;
    description: string;
    instructor_id: string;
    passing_percentage: number;
    created_at: string;
}

export interface CourseAnalytics {
    course_id: string;
    total_enrollments: number;
    average_score: number;
    lessons: LessonAnalytics[];
}

export interface LessonAnalytics {
    lesson_id: string;
    lesson_title: string;
    average_score: number;
    submission_count: number;
}

export interface Module {
    id: string;
    course_id: string;
    title: string;
    position: number;
    created_at: string;
    lessons: Lesson[];
}

export interface Block {
    id: string;
    type: 'description' | 'media' | 'quiz' | 'fill-in-the-blanks' | 'matching' | 'ordering' | 'short-answer';
    title?: string;
    content?: string;
    url?: string;
    media_type?: 'video' | 'audio';
    config?: {
        maxPlays?: number;
        currentPlays?: number;
        allowDownload?: boolean;
    };
    quiz_data?: {
        questions: {
            id: string;
            question: string;
            options: string[];
            correct: number[];
            type?: 'multiple-choice' | 'true-false' | 'multiple-select';
        }[];
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
    content_url: string | null;
    transcription?: {
        en?: string;
        es?: string;
        cues?: { start: number; end: number; text: string }[];
    } | null;
    metadata?: {
        blocks?: Block[];
    } | null;
    is_graded: boolean;
    grading_category_id: string | null;
    max_attempts: number | null;
    allow_retry: boolean;
    position: number;
    created_at: string;
}

export interface GradingCategory {
    id: string;
    course_id: string;
    name: string;
    weight: number;
    drop_count: number;
    created_at: string;
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
    role?: string;
}

export const cmsApi = {
    async getCourses(): Promise<Course[]> {
        const response = await fetch(`${API_BASE_URL}/courses`);
        if (!response.ok) throw new Error('Failed to fetch courses');
        return response.json();
    },

    async createCourse(title: string): Promise<Course> {
        const response = await fetch(`${API_BASE_URL}/courses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
        });
        if (!response.ok) throw new Error('Failed to create course');
        return response.json();
    },

    async getCourseWithFullOutline(courseId: string): Promise<Course & { modules: Module[] }> {
        const course = await fetch(`${API_BASE_URL}/courses/${courseId}`).then(res => res.json());
        const modules = await fetch(`${API_BASE_URL}/modules?course_id=${courseId}`).then(res => res.json());

        const modulesWithLessons = await Promise.all(modules.map(async (m: Module) => {
            const lessons = await fetch(`${API_BASE_URL}/lessons?module_id=${m.id}`).then(res => res.json());
            return { ...m, lessons };
        }));

        return { ...course, modules: modulesWithLessons };
    },

    async createModule(courseId: string, title: string, position: number): Promise<Module> {
        const response = await fetch(`${API_BASE_URL}/modules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ course_id: courseId, title, position }),
        });
        if (!response.ok) throw new Error('Failed to create module');
        return response.json();
    },

    async createLesson(moduleId: string, title: string, contentType: string, position: number): Promise<Lesson> {
        const response = await fetch(`${API_BASE_URL}/lessons`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ module_id: moduleId, title, content_type: contentType, position }),
        });
        if (!response.ok) throw new Error('Failed to create lesson');
        return response.json();
    },

    async transcribeLesson(lessonId: string): Promise<Lesson> {
        const response = await fetch(`${API_BASE_URL}/lessons/${lessonId}/transcribe`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to transcribe lesson');
        return response.json();
    },

    async updateLesson(lessonId: string, updates: Partial<Lesson>): Promise<Lesson> {
        const response = await fetch(`${API_BASE_URL}/lessons/${lessonId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
        if (!response.ok) throw new Error('Failed to update lesson');
        return response.json();
    },

    async getLesson(lessonId: string): Promise<Lesson> {
        const response = await fetch(`${API_BASE_URL}/lessons/${lessonId}`);
        if (!response.ok) throw new Error('Failed to fetch lesson');
        return response.json();
    },

    async getGradingCategories(courseId: string): Promise<GradingCategory[]> {
        const response = await fetch(`${API_BASE_URL}/courses/${courseId}/grading`);
        if (!response.ok) throw new Error('Failed to fetch grading categories');
        return response.json();
    },

    async createGradingCategory(courseId: string, name: string, weight: number): Promise<GradingCategory> {
        const response = await fetch(`${API_BASE_URL}/grading`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ course_id: courseId, name, weight, drop_count: 0 }),
        });
        if (!response.ok) throw new Error('Failed to create grading category');
        return response.json();
    },

    async deleteGradingCategory(id: string): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/grading/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete grading category');
    },

    async uploadAsset(file: File): Promise<{ id: string; filename: string; url: string }> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/assets/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error('Upload failed');
        return response.json();
    },

    async publishCourse(courseId: string): Promise<void> {
        const token = typeof window !== 'undefined' ? localStorage.getItem('studio_token') : null;
        const response = await fetch(`${API_BASE_URL}/courses/${courseId}/publish`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) throw new Error('Failed to publish course');
    },

    async register(payload: AuthPayload): Promise<AuthResponse> {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw await response.json();
        return response.json();
    },

    async login(payload: AuthPayload): Promise<AuthResponse> {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw await response.json();
        return response.json();
    },

    async getCourseAnalytics(courseId: string): Promise<CourseAnalytics> {
        const token = typeof window !== 'undefined' ? localStorage.getItem('studio_token') : null;
        const response = await fetch(`${API_BASE_URL}/courses/${courseId}/analytics`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch course analytics');
        return response.json();
    },

    async getCourse(id: string): Promise<Course> {
        const response = await fetch(`${API_BASE_URL}/courses/${id}`);
        if (!response.ok) throw new Error('Failed to fetch course');
        return response.json();
    },

    async updateCourse(id: string, data: Partial<Course>): Promise<Course> {
        const token = typeof window !== 'undefined' ? localStorage.getItem('studio_token') : null;
        const response = await fetch(`${API_BASE_URL}/courses/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to update course');
        return response.json();
    }
};
