export const API_BASE_URL = process.env.NEXT_PUBLIC_LMS_API_URL || "http://localhost:3002";

export interface Course {
    id: string;
    title: string;
    description?: string;
    instructor_id: string;
    created_at: string;
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
    content_url?: string;
    transcription?: any;
    metadata?: {
        blocks: Block[];
    };
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
}

export interface UserGrade {
    id: string;
    user_id: string;
    course_id: string;
    lesson_id: string;
    score: number;
    attempts_count: number;
    metadata: any;
    created_at: string;
}

export interface User {
    id: string;
    email: string;
    full_name: string;
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
    enroled_at: string;
}

export interface Module {
    id: string;
    course_id: string;
    title: string;
    position: number;
    lessons: Lesson[];
}

export const lmsApi = {
    async getCatalog(): Promise<Course[]> {
        // LMS service uses /catalog for the published courses list
        const response = await fetch(`${API_BASE_URL}/catalog`);
        if (!response.ok) throw new Error('Failed to fetch catalog');
        return response.json();
    },

    async getCourseOutline(courseId: string): Promise<Course & { modules: Module[], grading_categories: GradingCategory[] }> {
        const response = await fetch(`${API_BASE_URL}/courses/${courseId}/outline`);
        if (!response.ok) throw new Error('Failed to fetch course outline');
        return response.json();
    },

    async getLesson(id: string): Promise<Lesson> {
        return fetch(`${API_BASE_URL}/lessons/${id}`).then(res => res.json());
    },

    async register(payload: AuthPayload): Promise<AuthResponse> {
        return fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(res => res.ok ? res.json() : res.json().then(e => Promise.reject(e)));
    },

    async login(payload: AuthPayload): Promise<AuthResponse> {
        return fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(res => res.ok ? res.json() : res.json().then(e => Promise.reject(e)));
    },

    async enroll(courseId: string, userId: string): Promise<any> {
        return fetch(`${API_BASE_URL}/enroll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ course_id: courseId, user_id: userId })
        }).then(res => res.ok ? res.json() : res.json().then(e => Promise.reject(e)));
    },

    async getEnrollments(userId: string): Promise<Enrollment[]> {
        return fetch(`${API_BASE_URL}/enrollments/${userId}`).then(res => res.json());
    },

    async submitScore(userId: string, courseId: string, lessonId: string, score: number): Promise<UserGrade> {
        const response = await fetch(`${API_BASE_URL}/grades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, course_id: courseId, lesson_id: lessonId, score })
        });
        if (!response.ok) throw new Error('Failed to submit score');
        return response.json();
    },

    async getUserGrades(userId: string, courseId: string): Promise<UserGrade[]> {
        const response = await fetch(`${API_BASE_URL}/users/${userId}/courses/${courseId}/grades`);
        if (!response.ok) throw new Error('Failed to fetch user grades');
        return response.json();
    }
};
