'use client';

import React, { useState, useEffect } from 'react';
import { cmsApi, questionBankApi, CreateTestTemplatePayload, CourseLevel, CourseType, TestType, QuestionType, MySqlPlan, MySqlCourse, Asset } from '@/lib/api';
import { X, Save, Plus, Trash2, Sparkles, ChevronDown, ChevronUp, Copy, GripVertical, Edit2 } from 'lucide-react';

interface Section {
    id: string;
    title: string;
    description?: string;
    section_order: number;
    points: number;
    instructions?: string;
}

interface Question {
    id: string;
    section_id?: string;
    question_order: number;
    question_type: QuestionType;
    question_text: string;
    options?: unknown;
    correct_answer?: unknown;
    explanation?: string;
    points: number;
    metadata?: any;
}

interface TestTemplateFormProps {
    templateId?: string;
    onSuccess?: () => void;
    onCancel?: () => void;
}

interface TemplateLinkedAsset {
    id: string;
    filename?: string;
    mimetype?: string;
}

const readLinkedAssetsFromTemplateData = (templateData: unknown): TemplateLinkedAsset[] => {
    if (!templateData || typeof templateData !== 'object') return [];

    const data = templateData as Record<string, unknown>;
    const raw = data.selected_assets;
    if (!Array.isArray(raw)) return [];

    return raw
        .map((item) => {
            if (typeof item === 'string') {
                return { id: item };
            }
            if (item && typeof item === 'object') {
                const obj = item as Record<string, unknown>;
                if (typeof obj.id === 'string') {
                    return {
                        id: obj.id,
                        filename: typeof obj.filename === 'string' ? obj.filename : undefined,
                        mimetype: typeof obj.mimetype === 'string' ? obj.mimetype : undefined,
                    };
                }
            }
            return null;
        })
        .filter((asset): asset is TemplateLinkedAsset => Boolean(asset));
};

export default function TestTemplateForm({ templateId, onSuccess, onCancel }: TestTemplateFormProps) {
    const [formData, setFormData] = useState<CreateTestTemplatePayload>({
        name: '',
        description: '',
        mysql_course_id: undefined,
        test_type: 'CA',
        duration_minutes: 60,
        passing_score: 70,
        total_points: 100,
        instructions: '',
        template_data: { sections: [], questions: [] },
        tags: [],
    });

    const [sections, setSections] = useState<Section[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [newTag, setNewTag] = useState('');
    const [saving, setSaving] = useState(false);
    const [generatingAI, setGeneratingAI] = useState(false);
    const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
    const [aiContext, setAiContext] = useState('');
    const [aiQuestionType, setAiQuestionType] = useState<QuestionType>('multiple-choice');
    const [aiQuestionCount, setAiQuestionCount] = useState<number>(5);
    
    // MySQL course selection state
    const [mysqlPlans, setMysqlPlans] = useState<MySqlPlan[]>([]);
    const [mysqlCourses, setMysqlCourses] = useState<MySqlCourse[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('');
    const [selectedCourseId, setSelectedCourseId] = useState<number | ''>('');
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [loadingCourses, setLoadingCourses] = useState(false);
    const [sharedAssets, setSharedAssets] = useState<Asset[]>([]);
    const [selectedLinkedAssets, setSelectedLinkedAssets] = useState<TemplateLinkedAsset[]>([]);
    const [loadingSharedAssets, setLoadingSharedAssets] = useState(false);
    const [assetSearch, setAssetSearch] = useState('');
    const [selectedAssetLevel, setSelectedAssetLevel] = useState<string>('');
    const [selectedAssetPlanId, setSelectedAssetPlanId] = useState<number | ''>('');
    const [assetPlans, setAssetPlans] = useState<MySqlPlan[]>([]);
    const [assetCourses, setAssetCourses] = useState<MySqlCourse[]>([]);
    const [selectedAssetCourseId, setSelectedAssetCourseId] = useState<number | ''>('');
    const isEditing = Boolean(templateId);

    // Load MySQL plans on mount
    useEffect(() => {
        const loadPlans = async () => {
            try {
                setLoadingPlans(true);
                const plans = await questionBankApi.getMySQLPlans();
                setMysqlPlans(plans);
            } catch (error) {
                console.error('Failed to load MySQL plans:', error);
            } finally {
                setLoadingPlans(false);
            }
        };
        loadPlans();
    }, []);

    useEffect(() => {
        questionBankApi.getMySQLPlans().then(setAssetPlans).catch(() => setAssetPlans([]));
    }, []);

    useEffect(() => {
        if (!selectedAssetPlanId) {
            setAssetCourses([]);
            setSelectedAssetCourseId('');
            return;
        }
        questionBankApi.getMySQLCoursesByPlan(selectedAssetPlanId).then(setAssetCourses).catch(() => setAssetCourses([]));
    }, [selectedAssetPlanId]);

    useEffect(() => {
        const loadSharedAssets = async () => {
            try {
                setLoadingSharedAssets(true);
                const assets = await cmsApi.getAssets({
                    english_level: selectedAssetLevel || undefined,
                    sam_plan_id: selectedAssetPlanId || undefined,
                    sam_course_id: selectedAssetCourseId || undefined,
                });
                setSharedAssets(assets.filter((asset) => !asset.course_id));
            } catch (error) {
                console.error('Failed to load shared assets:', error);
            } finally {
                setLoadingSharedAssets(false);
            }
        };

        loadSharedAssets();
    }, [selectedAssetLevel, selectedAssetPlanId, selectedAssetCourseId]);

    // Load courses when plan is selected
    useEffect(() => {
        const loadCourses = async () => {
            if (!selectedPlanId) {
                setMysqlCourses([]);
                return;
            }
            
            try {
                setLoadingCourses(true);
                const courses = await questionBankApi.getMySQLCoursesByPlan(selectedPlanId as number);
                setMysqlCourses(courses);
            } catch (error) {
                console.error('Failed to load MySQL courses:', error);
            } finally {
                setLoadingCourses(false);
            }
        };
        loadCourses();
    }, [selectedPlanId]);

    useEffect(() => {
        if (!templateId) return;

        const loadTemplateForEdit = async () => {
            try {
                setSaving(true);
                const data = await cmsApi.getTestTemplate(templateId);

                setFormData({
                    name: data.template.name,
                    description: data.template.description || '',
                    mysql_course_id: data.template.mysql_course_id,
                    level: data.template.level,
                    course_type: data.template.course_type,
                    test_type: data.template.test_type,
                    duration_minutes: data.template.duration_minutes,
                    passing_score: data.template.passing_score,
                    total_points: data.template.total_points,
                    instructions: data.template.instructions || '',
                    template_data: data.template.template_data || { sections: [], questions: [] },
                    tags: data.template.tags || [],
                });

                if (data.template.level) {
                    setSelectedAssetLevel(data.template.level);
                }

                setSections(
                    (data.sections || []).map((section) => ({
                        id: section.id,
                        title: section.title,
                        description: section.description || '',
                        section_order: section.section_order,
                        points: section.points,
                        instructions: section.instructions || '',
                    }))
                );

                setQuestions(
                    (data.questions || []).map((question) => {
                        const allowedTypes: QuestionType[] = [
                            'multiple-choice',
                            'true-false',
                            'short-answer',
                            'essay',
                            'matching',
                            'ordering',
                            'fill-in-the-blanks',
                            'audio-response',
                        ];
                        const normalizedType = allowedTypes.includes(question.question_type)
                            ? question.question_type
                            : 'multiple-choice';

                        return {
                            id: question.id,
                            section_id: question.section_id,
                            question_order: question.question_order,
                            question_type: normalizedType,
                            question_text: question.question_text,
                            options: question.options,
                            correct_answer: question.correct_answer,
                            explanation: question.explanation || '',
                            points: question.points,
                            metadata: question.metadata,
                        };
                    })
                );

                if (data.template.mysql_course_id) {
                    setSelectedCourseId(data.template.mysql_course_id);
                }

                setSelectedLinkedAssets(readLinkedAssetsFromTemplateData(data.template.template_data));
            } catch (error) {
                console.error('Failed to load template for edit:', error);
                alert('No se pudo cargar la plantilla para editar');
                onCancel?.();
            } finally {
                setSaving(false);
            }
        };

        loadTemplateForEdit();
    }, [templateId, onCancel]);

    // Handle course selection - store mysql_course_id (preferred approach)
    const handleCourseSelect = (courseId: number | '') => {
        setSelectedCourseId(courseId);
        // Store the MySQL course ID directly - level/course_type can be derived from mysql_courses table
        setFormData((prev) => ({
            ...prev,
            mysql_course_id: courseId === '' ? undefined : courseId,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            alert('El nombre es obligatorio');
            return;
        }

        if (questions.length === 0) {
            alert('Debes agregar al menos una pregunta');
            return;
        }

        // Validate: either mysql_course_id OR level+course_type must be provided
        if (!formData.mysql_course_id && (!formData.level || !formData.course_type)) {
            alert('Debes seleccionar un curso de MySQL o especificar nivel y tipo de curso manualmente');
            return;
        }

        try {
            setSaving(true);

            const templateDataObject: Record<string, unknown> =
                formData.template_data && typeof formData.template_data === 'object'
                    ? { ...(formData.template_data as Record<string, unknown>) }
                    : {};

            templateDataObject.selected_assets = selectedLinkedAssets;

            const payloadBase = {
                name: formData.name,
                description: formData.description,
                mysql_course_id: formData.mysql_course_id,
                level: formData.level,
                course_type: formData.course_type,
                test_type: formData.test_type,
                duration_minutes: formData.duration_minutes,
                passing_score: formData.passing_score,
                total_points: formData.total_points,
                instructions: formData.instructions,
                template_data: templateDataObject,
                tags: formData.tags,
            };

            let targetTemplateId = templateId;

            if (isEditing && templateId) {
                await cmsApi.updateTestTemplate(templateId, payloadBase);

                const existingData = await cmsApi.getTestTemplate(templateId);

                for (const existingQuestion of existingData.questions) {
                    await cmsApi.deleteTemplateQuestion(templateId, existingQuestion.id);
                }

                for (const existingSection of existingData.sections) {
                    await cmsApi.deleteTemplateSection(templateId, existingSection.id);
                }
            } else {
                const template = await cmsApi.createTestTemplate(payloadBase);
                targetTemplateId = template.id;
            }

            if (!targetTemplateId) {
                throw new Error('No se pudo determinar la plantilla a guardar');
            }

            const sectionIdMap = new Map<string, string>();

            for (const section of sections) {
                const createdSection = await cmsApi.createTemplateSection(targetTemplateId, {
                    title: section.title,
                    description: section.description,
                    section_order: section.section_order,
                    points: section.points,
                    instructions: section.instructions,
                });
                sectionIdMap.set(section.id, createdSection.id);
            }

            for (const question of questions) {
                await cmsApi.createTemplateQuestion(targetTemplateId, {
                    section_id: question.section_id ? sectionIdMap.get(question.section_id) : undefined,
                    question_order: question.question_order,
                    question_type: question.question_type,
                    question_text: question.question_text,
                    options: question.options,
                    correct_answer: question.correct_answer,
                    explanation: question.explanation,
                    points: question.points,
                    metadata: question.metadata,
                });
            }

            alert(isEditing ? 'Plantilla actualizada exitosamente' : 'Plantilla creada exitosamente');
            onSuccess?.();
        } catch (error) {
            console.error('Failed to create template:', error);
            const message = error instanceof Error ? error.message : 'Error al crear la plantilla';
            alert(message);
        } finally {
            setSaving(false);
        }
    };

    const handleAddTag = () => {
        if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
            setFormData({
                ...formData,
                tags: [...(formData.tags || []), newTag.trim()],
            });
            setNewTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setFormData({
            ...formData,
            tags: formData.tags?.filter(tag => tag !== tagToRemove) || [],
        });
    };

    const handleAddSection = () => {
        const newSection: Section = {
            id: `section-${Date.now()}`,
            title: `Sección ${sections.length + 1}`,
            description: '',
            section_order: sections.length,
            points: 0,
            instructions: '',
        };
        setSections([...sections, newSection]);
    };

    const handleRemoveSection = (sectionId: string) => {
        setSections(sections.filter(s => s.id !== sectionId));
        setQuestions(questions.filter(q => q.section_id !== sectionId));
    };

    const handleUpdateSection = (sectionId: string, updates: Partial<Section>) => {
        setSections(sections.map(s => s.id === sectionId ? { ...s, ...updates } : s));
    };

    const handleAddQuestion = (sectionId?: string) => {
        const newQuestion: Question = {
            id: `question-${Date.now()}`,
            section_id: sectionId,
            question_order: questions.filter(q => q.section_id === sectionId).length,
            question_type: 'multiple-choice',
            question_text: '',
            options: ['Opción 1', 'Opción 2', 'Opción 3', 'Opción 4'],
            correct_answer: 0,
            explanation: '',
            points: 1,
        };
        setQuestions([...questions, newQuestion]);
        setExpandedQuestion(newQuestion.id);
    };

    const handleGenerateWithAI = async () => {
        if (!aiContext.trim()) {
            alert('Ingresa el contexto para generar las preguntas (ej: tema de la lección, contenido, etc.)');
            return;
        }

        try {
            setGeneratingAI(true);

            const response = await fetch(`${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3001'}/test-templates/generate-with-rag`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    topic: aiContext,
                    num_questions: aiQuestionCount,
                    question_type: aiQuestionType,
                }),
                credentials: 'include',
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error ${response.status}: ${errorText}`);
            }

            const generatedQuestions = await response.json();

            // Parsear las preguntas generadas
            if (Array.isArray(generatedQuestions) && generatedQuestions.length > 0) {
                const questionsToAdd: Question[] = generatedQuestions.map((q: any, idx: number) => ({
                    id: `q-${Date.now()}-${idx}`,
                    section_id: undefined,
                    question_order: questions.length + idx,
                    question_type: q.question_type || 'multiple-choice',
                    question_text: q.question_text || q.text,
                    options: Array.isArray(q.options) ? q.options : [],
                    correct_answer: q.correct_answer ?? q.correct,
                    explanation: q.explanation || '',
                    points: q.points || 1,
                    metadata: q.metadata,
                }));

                setQuestions([...questions, ...questionsToAdd]);
                alert(`Se generaron ${questionsToAdd.length} preguntas con IA`);
            }
        } catch (error) {
            console.error('AI generation error:', error);
            alert(`Error al generar preguntas con IA: ${error instanceof Error ? error.message : 'Verifica que Ollama esté configurado y el banco de preguntas MySQL tenga datos'}`);
        } finally {
            setGeneratingAI(false);
        }
    };

    const handleDuplicateQuestion = (question: Question) => {
        const duplicate: Question = {
            ...question,
            id: `question-${Date.now()}`,
            question_order: questions.length,
            question_text: `${question.question_text} (copia)`,
        };
        setQuestions([...questions, duplicate]);
    };

    const handleUpdateQuestion = (questionId: string, updates: Partial<Question>) => {
        setQuestions(questions.map(q => 
            q.id === questionId ? { ...q, ...updates } : q
        ));
    };

    const handleRemoveQuestion = (questionId: string) => {
        setQuestions(questions.filter(q => q.id !== questionId));
        if (expandedQuestion === questionId) {
            setExpandedQuestion(null);
        }
    };

    const handleToggleLinkedAsset = (asset: Asset) => {
        setSelectedLinkedAssets((prev) => {
            const exists = prev.some((selected) => selected.id === asset.id);
            if (exists) {
                return prev.filter((selected) => selected.id !== asset.id);
            }
            return [
                ...prev,
                { id: asset.id, filename: asset.filename, mimetype: asset.mimetype },
            ];
        });
    };

    const filteredSharedAssets = sharedAssets.filter((asset) => {
        if (!assetSearch.trim()) return true;
        const q = assetSearch.toLowerCase();
        return (
            asset.filename.toLowerCase().includes(q) ||
            asset.mimetype.toLowerCase().includes(q)
        );
    });

    const getQuestionTypeLabel = (type: QuestionType) => {
        const labels: Record<QuestionType, string> = {
            'multiple-choice': 'Opción Múltiple',
            'true-false': 'Verdadero/Falso',
            'short-answer': 'Respuesta Corta',
            'essay': 'Ensayo',
            'matching': 'Emparejamiento',
            'ordering': 'Ordenar',
            'fill-in-the-blanks': 'Completar espacios',
            'audio-response': 'Respuesta de audio',
        };
        return labels[type] || type;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            {isEditing ? 'Editar Plantilla de Prueba' : 'Nueva Plantilla de Prueba'}
                        </h2>
                        <p className="text-sm text-gray-500">
                            {isEditing ? 'Modifica preguntas y secciones de tu evaluación' : 'Crea preguntas y secciones para tu evaluación'}
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-8">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Edit2 className="w-4 h-4" />
                            Información Básica
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nombre *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ej: Final Exam - Beginner 1"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Tipo de Prueba *
                                </label>
                                <select
                                    value={formData.test_type}
                                    onChange={(e) => setFormData({ ...formData, test_type: e.target.value as TestType })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="CA">Continuous Assessment (CA)</option>
                                    <option value="MWT">Midterm Written Test (MWT)</option>
                                    <option value="MOT">Midterm Oral Test (MOT)</option>
                                    <option value="FOT">Final Oral Test (FOT)</option>
                                    <option value="FWT">Final Written Test (FWT)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Descripción
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Descripción de la plantilla..."
                            />
                        </div>

                        {/* MySQL Course Selection */}
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <h4 className="text-sm font-medium text-blue-900 mb-3">
                                📚 Seleccionar Curso desde MySQL (Opcional)
                            </h4>
                            <p className="text-xs text-blue-700 mb-3">
                                Selecciona un curso para autocompletar automáticamente el Nivel y Tipo de Curso
                            </p>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-blue-800 mb-1">
                                        Plan de Estudios *
                                    </label>
                                    <select
                                        value={selectedPlanId}
                                        onChange={(e) => {
                                            setSelectedPlanId(e.target.value ? Number(e.target.value) : '');
                                            setSelectedCourseId('');
                                            setFormData((prev) => ({
                                                ...prev,
                                                mysql_course_id: undefined,
                                            }));
                                        }}
                                        disabled={loadingPlans}
                                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                        <option value="">-- Seleccionar Plan --</option>
                                        {mysqlPlans.map(plan => (
                                            <option key={plan.idPlanDeEstudios} value={plan.idPlanDeEstudios}>
                                                {plan.NombrePlan}
                                            </option>
                                        ))}
                                    </select>
                                    {loadingPlans && <p className="text-xs text-blue-600 mt-1">Cargando planes...</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-blue-800 mb-1">
                                        Curso *
                                    </label>
                                    <select
                                        value={selectedCourseId}
                                        onChange={(e) => handleCourseSelect(e.target.value ? Number(e.target.value) : '')}
                                        disabled={!selectedPlanId || loadingCourses}
                                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100"
                                    >
                                        <option value="">-- Seleccionar Curso --</option>
                                        {mysqlCourses.map(course => (
                                            <option key={course.idCursos} value={course.idCursos}>
                                                {course.NombreCurso}
                                            </option>
                                        ))}
                                    </select>
                                    {loadingCourses && <p className="text-xs text-blue-600 mt-1">Cargando cursos...</p>}
                                </div>
                            </div>
                        </div>

                        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                            <h4 className="text-sm font-medium text-emerald-900 mb-2">
                                Material Compartido para esta Plantilla
                            </h4>
                            <p className="text-xs text-emerald-700 mb-3">
                                Este material queda vinculado a la plantilla y disponible para instructores al reutilizarla.
                            </p>

                            <input
                                type="text"
                                value={assetSearch}
                                onChange={(e) => setAssetSearch(e.target.value)}
                                className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white mb-3"
                                placeholder="Buscar material por nombre o tipo..."
                            />

                            <select
                                value={selectedAssetLevel}
                                onChange={(e) => setSelectedAssetLevel(e.target.value)}
                                className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white mb-3"
                            >
                                <option value="">Todos los niveles</option>
                                <option value="beginner">Beginner</option>
                                <option value="beginner_1">Beginner 1</option>
                                <option value="beginner_2">Beginner 2</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="intermediate_1">Intermediate 1</option>
                                <option value="intermediate_2">Intermediate 2</option>
                                <option value="advanced">Advanced</option>
                                <option value="advanced_1">Advanced 1</option>
                                <option value="advanced_2">Advanced 2</option>
                            </select>

                            <select
                                value={selectedAssetPlanId}
                                onChange={(e) => {
                                    const value = e.target.value ? Number(e.target.value) : '';
                                    setSelectedAssetPlanId(value);
                                    setSelectedAssetCourseId('');
                                }}
                                className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white mb-3"
                            >
                                <option value="">Todos los planes SAM</option>
                                {assetPlans.map((p) => (
                                    <option key={p.idPlanDeEstudios} value={p.idPlanDeEstudios}>{p.NombrePlan}</option>
                                ))}
                            </select>

                            <select
                                value={selectedAssetCourseId}
                                onChange={(e) => setSelectedAssetCourseId(e.target.value ? Number(e.target.value) : '')}
                                disabled={!selectedAssetPlanId}
                                className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white mb-3 disabled:opacity-60"
                            >
                                <option value="">Todos los cursos SAM</option>
                                {assetCourses.map((c) => (
                                    <option key={c.idCursos} value={c.idCursos}>{c.NombreCurso}</option>
                                ))}
                            </select>

                            <div className="max-h-52 overflow-y-auto bg-white border border-emerald-200 rounded-lg divide-y divide-emerald-100">
                                {loadingSharedAssets && (
                                    <p className="text-xs text-emerald-700 p-3">Cargando materiales...</p>
                                )}
                                {!loadingSharedAssets && filteredSharedAssets.length === 0 && (
                                    <p className="text-xs text-emerald-700 p-3">No hay materiales compartidos disponibles.</p>
                                )}
                                {!loadingSharedAssets && filteredSharedAssets.map((asset) => {
                                    const checked = selectedLinkedAssets.some((a) => a.id === asset.id);
                                    return (
                                        <label key={asset.id} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-emerald-50">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => handleToggleLinkedAsset(asset)}
                                                className="mt-0.5"
                                            />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">{asset.filename}</p>
                                                <p className="text-xs text-gray-600">{asset.mimetype}</p>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>

                            {selectedLinkedAssets.length > 0 && (
                                <p className="text-xs text-emerald-800 mt-2">
                                    {selectedLinkedAssets.length} material(es) vinculados a la plantilla.
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nivel {formData.mysql_course_id ? '(del curso seleccionado)' : '*'}
                                </label>
                                <select
                                    value={formData.level || ''}
                                    onChange={(e) => setFormData({ ...formData, level: e.target.value as CourseLevel || undefined })}
                                    disabled={!!formData.mysql_course_id}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                >
                                    <option value="">Seleccionar nivel</option>
                                    <option value="beginner">Beginner</option>
                                    <option value="beginner_1">Beginner 1</option>
                                    <option value="beginner_2">Beginner 2</option>
                                    <option value="intermediate">Intermediate</option>
                                    <option value="intermediate_1">Intermediate 1</option>
                                    <option value="intermediate_2">Intermediate 2</option>
                                    <option value="advanced">Advanced</option>
                                    <option value="advanced_1">Advanced 1</option>
                                    <option value="advanced_2">Advanced 2</option>
                                </select>
                                {formData.mysql_course_id && (
                                    <p className="text-xs text-green-600 mt-1">
                                        ✓ Nivel determinado automáticamente desde el curso MySQL
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Tipo de Curso {formData.mysql_course_id ? '(del curso seleccionado)' : '*'}
                                </label>
                                <select
                                    value={formData.course_type || ''}
                                    onChange={(e) => setFormData({ ...formData, course_type: e.target.value as CourseType || undefined })}
                                    disabled={!!formData.mysql_course_id}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                >
                                    <option value="">Seleccionar tipo</option>
                                    <option value="regular">Regular</option>
                                    <option value="intensive">Intensivo</option>
                                </select>
                                {formData.mysql_course_id && (
                                    <p className="text-xs text-green-600 mt-1">
                                        ✓ Tipo determinado automáticamente desde el curso MySQL
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Duración (min) *
                                </label>
                                <input
                                    type="number"
                                    value={formData.duration_minutes}
                                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    min="1"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Puntuación Mínima (%) *
                                </label>
                                <input
                                    type="number"
                                    value={formData.passing_score}
                                    onChange={(e) => setFormData({ ...formData, passing_score: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    min="0"
                                    max="100"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Puntos Totales *
                                </label>
                                <input
                                    type="number"
                                    value={formData.total_points}
                                    onChange={(e) => setFormData({ ...formData, total_points: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    min="1"
                                />
                            </div>
                        </div>
                    </div>

                    {/* AI Generation */}
                    <div className="space-y-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-600" />
                            Generar Preguntas con IA
                        </h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={aiContext}
                                onChange={(e) => setAiContext(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                placeholder="Describe el tema o contenido (ej: 'Past Simple tense, vocabulary about travel, 5 questions')"
                                disabled={generatingAI}
                            />
                            <select
                                value={aiQuestionType}
                                onChange={(e) => setAiQuestionType(e.target.value as QuestionType)}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                                disabled={generatingAI}
                            >
                                <option value="multiple-choice">Opcion multiple</option>
                                <option value="true-false">Verdadero/Falso</option>
                                <option value="short-answer">Respuesta corta</option>
                                <option value="essay">Ensayo</option>
                                <option value="matching">Emparejamiento</option>
                                <option value="ordering">Ordenar</option>
                                <option value="fill-in-the-blanks">Completar espacios</option>
                                <option value="audio-response">Respuesta de audio</option>
                            </select>
                            <select
                                value={aiQuestionCount}
                                onChange={(e) => setAiQuestionCount(Number(e.target.value))}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                                disabled={generatingAI}
                            >
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                                <option value={3}>3</option>
                                <option value={4}>4</option>
                                <option value={5}>5</option>
                                <option value={6}>6</option>
                                <option value={7}>7</option>
                                <option value={8}>8</option>
                                <option value={9}>9</option>
                                <option value={10}>10</option>
                                <option value={12}>12</option>
                                <option value={15}>15</option>
                                <option value={20}>20</option>
                            </select>
                            <button
                                type="button"
                                onClick={handleGenerateWithAI}
                                disabled={generatingAI}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <Sparkles className="w-4 h-4" />
                                {generatingAI ? 'Generando...' : 'Generar'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            La IA genera varios tipos de ejercicios. Hotspot y Code Lab quedan para creacion manual del instructor.
                        </p>
                        <p className="text-xs text-gray-500">
                            Puedes elegir entre 1 y 20 preguntas por generacion.
                        </p>
                    </div>

                    {/* Sections */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Copy className="w-4 h-4" />
                                Secciones y Preguntas
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleAddSection}
                                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                                >
                                    <Plus className="w-3 h-3" />
                                    Agregar Sección
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleAddQuestion(undefined)}
                                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                                >
                                    <Plus className="w-3 h-3" />
                                    Agregar Pregunta
                                </button>
                            </div>
                        </div>

                        {/* Sections List */}
                        {sections.map((section, sIdx) => (
                            <div key={section.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 grid grid-cols-3 gap-3">
                                        <input
                                            type="text"
                                            value={section.title}
                                            onChange={(e) => handleUpdateSection(section.id, { title: e.target.value })}
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium"
                                            placeholder="Título de sección"
                                        />
                                        <input
                                            type="number"
                                            value={section.points}
                                            onChange={(e) => handleUpdateSection(section.id, { points: parseInt(e.target.value) || 0 })}
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            placeholder="Puntos"
                                        />
                                        <input
                                            type="text"
                                            value={section.instructions || ''}
                                            onChange={(e) => handleUpdateSection(section.id, { instructions: e.target.value })}
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            placeholder="Instrucciones (opcional)"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveSection(section.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                
                                {/* Questions for this section */}
                                <div className="ml-4 space-y-2">
                                    {questions.filter(q => q.section_id === section.id).map((q) => (
                                        <div key={q.id} className="bg-white border border-gray-200 rounded p-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-700">{q.question_text || 'Sin título'}</span>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs text-gray-500">{q.points} pts</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveQuestion(q.id)}
                                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => handleAddQuestion(section.id)}
                                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" />
                                        Agregar pregunta a esta sección
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Questions without section */}
                        <div className="space-y-3">
                            {questions.filter(q => !q.section_id).map((question, qIdx) => (
                                <div key={question.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                    {/* Question Header */}
                                    <div 
                                        className="bg-gray-50 p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                                        onClick={() => setExpandedQuestion(expandedQuestion === question.id ? null : question.id)}
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <GripVertical className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm font-medium text-gray-500">Pregunta {qIdx + 1}</span>
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                                {getQuestionTypeLabel(question.question_type)}
                                            </span>
                                            <span className="text-xs text-gray-500">{question.points} puntos</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleDuplicateQuestion(question)}
                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="Duplicar"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveQuestion(question.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            {expandedQuestion === question.id ? (
                                                <ChevronUp className="w-4 h-4 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 text-gray-400" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Question Editor */}
                                    {expandedQuestion === question.id && (
                                        <div className="p-4 space-y-4 bg-white">
                                            {/* Question Type */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Tipo de Pregunta
                                                    </label>
                                                    <select
                                                        value={question.question_type}
                                                        onChange={(e) => {
                                                            const nextType = e.target.value as QuestionType;
                                                            const updates: Partial<Question> = { question_type: nextType };

                                                            if (nextType === 'true-false') {
                                                                updates.options = ['Verdadero', 'Falso'];
                                                                updates.correct_answer =
                                                                    typeof question.correct_answer === 'number' ? question.correct_answer : 0;
                                                            } else if (
                                                                nextType === 'multiple-choice' &&
                                                                !Array.isArray(question.options)
                                                            ) {
                                                                updates.options = ['Opción 1', 'Opción 2', 'Opción 3', 'Opción 4'];
                                                                updates.correct_answer = 0;
                                                            }

                                                            handleUpdateQuestion(question.id, updates);
                                                        }}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="multiple-choice">Opción Múltiple</option>
                                                        <option value="true-false">Verdadero/Falso</option>
                                                        <option value="short-answer">Respuesta Corta</option>
                                                        <option value="essay">Ensayo</option>
                                                        <option value="matching">Emparejamiento</option>
                                                        <option value="ordering">Ordenar</option>
                                                        <option value="fill-in-the-blanks">Completar espacios</option>
                                                        <option value="audio-response">Respuesta de audio</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Puntos
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={question.points}
                                                        onChange={(e) => handleUpdateQuestion(question.id, { points: parseInt(e.target.value) || 1 })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                        min="1"
                                                    />
                                                </div>
                                            </div>

                                            {/* Question Text */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Pregunta *
                                                </label>
                                                <textarea
                                                    value={question.question_text}
                                                    onChange={(e) => handleUpdateQuestion(question.id, { question_text: e.target.value })}
                                                    rows={2}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Escribe el enunciado de la pregunta..."
                                                    required
                                                />
                                            </div>

                                            {/* Options for multiple choice */}
                                            {(question.question_type === 'multiple-choice' || question.question_type === 'true-false') && (
                                                <div className="space-y-2">
                                                    <label className="block text-sm font-medium text-gray-700">
                                                        Opciones (marca la correcta)
                                                    </label>
                                                    {(Array.isArray(question.options) ? question.options : []).map((option, oIdx) => (
                                                        <div key={oIdx} className="flex items-center gap-2">
                                                            <input
                                                                type="radio"
                                                                name={`correct-${question.id}`}
                                                                checked={question.correct_answer === oIdx}
                                                                onChange={() => handleUpdateQuestion(question.id, { correct_answer: oIdx })}
                                                                className="w-4 h-4 text-blue-600"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={String(option ?? '')}
                                                                onChange={(e) => {
                                                                    const currentOptions = Array.isArray(question.options)
                                                                        ? [...question.options]
                                                                        : [];
                                                                    currentOptions[oIdx] = e.target.value;
                                                                    handleUpdateQuestion(question.id, { options: currentOptions });
                                                                }}
                                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                                placeholder={`Opción ${oIdx + 1}`}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const currentOptions = Array.isArray(question.options)
                                                                        ? question.options
                                                                        : [];
                                                                    const newOptions = currentOptions.filter((_, idx) => idx !== oIdx);
                                                                    handleUpdateQuestion(question.id, { options: newOptions });
                                                                }}
                                                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const currentOptions = Array.isArray(question.options)
                                                                ? question.options
                                                                : [];
                                                            handleUpdateQuestion(question.id, {
                                                                options: [
                                                                    ...currentOptions,
                                                                    `Opción ${currentOptions.length + 1}`,
                                                                ],
                                                            });
                                                        }}
                                                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                        Agregar opción
                                                    </button>
                                                </div>
                                            )}

                                            {/* Explanation (AI generated field) */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                                    Explicación / Feedback
                                                    <Sparkles className="w-3 h-3 text-purple-600" />
                                                    <span className="text-xs text-gray-500 font-normal">(Generado por IA, editable)</span>
                                                </label>
                                                <textarea
                                                    value={question.explanation || ''}
                                                    onChange={(e) => handleUpdateQuestion(question.id, { explanation: e.target.value })}
                                                    rows={2}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                                    placeholder="Explicación que se mostrará al estudiante después de responder..."
                                                />
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Esta explicación se mostrará al alumno después de que responda la pregunta.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {questions.length === 0 && (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                <Copy className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                <p className="text-gray-500 text-sm">No hay preguntas agregadas</p>
                                <p className="text-gray-400 text-xs">Usa la IA o agrega preguntas manualmente</p>
                            </div>
                        )}
                    </div>

                    {/* Tags */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900">Etiquetas</h3>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Agregar etiqueta..."
                            />
                            <button
                                type="button"
                                onClick={handleAddTag}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
                            >
                                <Plus className="w-4 h-4" />
                                Agregar
                            </button>
                        </div>

                        {formData.tags && formData.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {formData.tags.map((tag, idx) => (
                                    <span
                                        key={idx}
                                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-1"
                                    >
                                        {tag}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveTag(tag)}
                                            className="hover:text-blue-600"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 sticky bottom-0 bg-white">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving || questions.length === 0}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Guardando...' : `Guardar Plantilla (${questions.length} preguntas)`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
