export const API_BASE_URL = "http://localhost:3001";

export interface Course {
    id: string;
    title: string;
    instructor_id: string;
    created_at: string;
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
    type: 'description' | 'media' | 'quiz';
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
            correct: number;
        }[];
    };
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
    position: number;
    created_at: string;
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

    async uploadAsset(file: File): Promise<{ id: string; filename: string; url: string }> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/assets/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error('Upload failed');
        return response.json();
    }
};
