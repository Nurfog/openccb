'use client';

import React, { useState } from 'react';
import { questionBankApi, QuestionBank, CreateQuestionBankPayload, QuestionBankType } from '@/lib/api';
import { X, Save, Sparkles, Volume2, Trash2, Upload } from 'lucide-react';

interface QuestionBankEditorProps {
    question?: QuestionBank | null;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export default function QuestionBankEditor({ question, onSuccess, onCancel }: QuestionBankEditorProps) {
    const toDisplayText = (value: unknown): string => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (Array.isArray(value)) return value.map((v) => toDisplayText(v)).filter(Boolean).join(', ');
        if (typeof value === 'object') {
            const obj = value as Record<string, unknown>;
            if (typeof obj.answer === 'string') return obj.answer;
            if (typeof obj.text === 'string') return obj.text;
            if (typeof obj.label === 'string') return obj.label;
            try { return JSON.stringify(obj); } catch { return ''; }
        }
        return '';
    };

    const [formData, setFormData] = useState<CreateQuestionBankPayload>({
        question_text: question?.question_text || '',
        question_type: question?.question_type || 'multiple-choice',
        options: question?.options || (question?.question_type === 'true-false' ? ['Verdadero', 'Falso'] : undefined),
        correct_answer: question?.correct_answer,
        explanation: question?.explanation || '',
        points: question?.points || 1,
        difficulty: question?.difficulty || 'medium',
        tags: question?.tags || [],
        media_url: question?.media_url,
        media_type: question?.media_type,
        skill_assessed: question?.skill_assessed,
    });

    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [audioPreview, setAudioPreview] = useState<string | null>(question?.audio_url || null);
    const [uploadingAudio, setUploadingAudio] = useState(false);

    const [newTag, setNewTag] = useState('');
    const [saving, setSaving] = useState(false);
    const [generatingAI, setGeneratingAI] = useState(false);

    const normalizedOptions = Array.isArray(formData.options)
        ? (formData.options as unknown[]).map((opt) => toDisplayText(opt))
        : [];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.question_text.trim()) {
            alert('El texto de la pregunta es obligatorio');
            return;
        }

        try {
            setSaving(true);
            
            let audioUrl = audioPreview;
            
            // Upload audio file if provided
            if (audioFile) {
                setUploadingAudio(true);
                const audioFormData = new FormData();
                audioFormData.append('file', audioFile);
                audioFormData.append('type', 'question_audio');
                
                const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3001'}/assets/upload`, {
                    method: 'POST',
                    headers: {},
                    body: audioFormData,
                    credentials: 'include',
                });
                
                if (uploadResponse.ok) {
                    const uploadResult = await uploadResponse.json();
                    audioUrl = uploadResult.url || uploadResult.file_url;
                } else {
                    console.warn('Audio upload failed, continuing without audio');
                }
                setUploadingAudio(false);
            }
            
            const payload = {
                ...formData,
                audio_url: audioUrl || undefined,
                audio_text: formData.question_text, // Suggestion for what the audio should say
            };
            
            if (question) {
                await questionBankApi.update(question.id, payload);
            } else {
                await questionBankApi.create(payload);
            }
            
            onSuccess?.();
        } catch (error) {
            console.error('Failed to save question:', error);
            alert('Error al guardar la pregunta');
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

    const handleAddOption = () => {
        const currentOptions = normalizedOptions;
        setFormData({
            ...formData,
            options: [...currentOptions, `Opción ${currentOptions.length + 1}`],
        });
    };

    const handleRemoveOption = (index: number) => {
        const newOptions = normalizedOptions.filter((_, i) => i !== index);
        setFormData({ ...formData, options: newOptions });
        
        // Adjust correct answer if needed
        if (typeof formData.correct_answer === 'number' && formData.correct_answer === index) {
            setFormData({ ...formData, correct_answer: undefined });
        } else if (typeof formData.correct_answer === 'number' && formData.correct_answer > index) {
            setFormData({ ...formData, correct_answer: formData.correct_answer - 1 });
        }
    };

    const handleGenerateWithAI = async () => {
        if (!formData.question_text.trim()) {
            alert('Ingresa una pregunta base o contexto para que la IA genere las opciones y explicación');
            return;
        }

        // Define las 4 habilidades del inglés que deben cubrirse
        const skills = ['reading', 'listening', 'speaking', 'writing'];
        const randomSkill = skills[Math.floor(Math.random() * skills.length)];
        
        const skillPrompts = {
            reading: 'Focus on reading comprehension, vocabulary in context, or text analysis.',
            listening: 'Focus on listening comprehension, audio-based understanding, or spoken dialogue interpretation.',
            speaking: 'Focus on oral production, pronunciation, or conversational response.',
            writing: 'Focus on written production, grammar in writing, or composition skills.'
        };

        try {
            setGeneratingAI(true);

            const response = await fetch(`${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3001'}/question-bank/ai-generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question_text: formData.question_text,
                    difficulty: formData.difficulty,
                    skill: randomSkill,
                }),
                credentials: 'include',
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            if (data.options && data.correct_answer !== undefined) {
                setFormData({
                    ...formData,
                    options: data.options,
                    correct_answer: data.correct_answer,
                    explanation: data.explanation
                        ? `${data.explanation}\n\n📊 Skill assessed: ${randomSkill.toUpperCase()}`
                        : `This question assesses ${randomSkill.toUpperCase()} skills.`,
                    tags: [...(formData.tags || []), randomSkill, 'ai-generated'],
                });
                alert(`IA generó las opciones y explicación enfocadas en la habilidad: ${randomSkill.toUpperCase()}`);
            }
        } catch (error) {
            console.error('AI generation error:', error);
            alert(`Error al generar con IA: ${error instanceof Error ? error.message : 'Verifica que Ollama esté configurado'}`);
        } finally {
            setGeneratingAI(false);
        }
    };

    const isMultipleChoice = formData.question_type === 'multiple-choice' || formData.question_type === 'true-false';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full my-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {question ? 'Editar Pregunta' : 'Nueva Pregunta'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {question ? 'Modifica los detalles de la pregunta' : 'Crea una nueva pregunta para el banco'}
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Question Type & Difficulty */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Tipo de Pregunta *
                            </label>
                            <select
                                value={formData.question_type}
                                onChange={(e) => setFormData({ 
                                    ...formData, 
                                    question_type: e.target.value as QuestionBankType,
                                    options: e.target.value === 'true-false' ? ['Verdadero', 'Falso'] : formData.options,
                                })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="multiple-choice">Opción Múltiple</option>
                                <option value="true-false">Verdadero/Falso</option>
                                <option value="short-answer">Respuesta Corta</option>
                                <option value="essay">Ensayo</option>
                                <option value="matching">Emparejamiento</option>
                                <option value="ordering">Ordenar</option>
                                <option value="fill-in-the-blanks">Completar Espacios</option>
                                <option value="audio-response">Respuesta de Audio</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Dificultad
                            </label>
                            <select
                                value={formData.difficulty}
                                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="easy">Fácil</option>
                                <option value="medium">Media</option>
                                <option value="hard">Difícil</option>
                            </select>
                        </div>
                    </div>

                    {/* Question Text */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Pregunta *
                        </label>
                        <textarea
                            value={formData.question_text}
                            onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Escribe el enunciado de la pregunta..."
                            required
                        />
                    </div>

                    {/* Options for Multiple Choice */}
                    {isMultipleChoice && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Opciones (marca la correcta)
                                </label>
                                <button
                                    type="button"
                                    onClick={handleAddOption}
                                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                >
                                    <Upload className="w-3 h-3" />
                                    Agregar opción
                                </button>
                            </div>
                            
                            {normalizedOptions.map((option: string, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="correct_answer"
                                        checked={formData.correct_answer === idx}
                                        onChange={() => setFormData({ ...formData, correct_answer: idx })}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <input
                                        type="text"
                                        value={option}
                                        onChange={(e) => {
                                            const newOptions = [...normalizedOptions];
                                            newOptions[idx] = e.target.value;
                                            setFormData({ ...formData, options: newOptions });
                                        }}
                                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                                        placeholder={`Opción ${idx + 1}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveOption(idx)}
                                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* AI Generation Button */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleGenerateWithAI}
                            disabled={generatingAI || !formData.question_text.trim()}
                            className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                        >
                            <Sparkles className="w-4 h-4" />
                            {generatingAI ? 'Generando...' : 'Generar con IA'}
                        </button>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            Genera opciones y explicación automáticamente
                        </span>
                    </div>

                    {/* Explanation */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                            Explicación / Feedback
                            <Sparkles className="w-3 h-3 text-purple-600" />
                        </label>
                        <textarea
                            value={formData.explanation}
                            onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Explicación que se mostrará al estudiante después de responder..."
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Esta explicación ayuda al estudiante a entender por qué su respuesta fue correcta o incorrecta.
                        </p>
                    </div>

                    {/* Audio Upload Section */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Volume2 className="w-4 h-4" />
                            Audio de la Pregunta (Opcional)
                        </label>
                        
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center">
                            {audioPreview ? (
                                <div className="space-y-3">
                                    <audio controls src={audioPreview} className="w-full" />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAudioPreview(null);
                                            setAudioFile(null);
                                        }}
                                        className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1 mx-auto"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        Eliminar audio
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <input
                                        type="file"
                                        accept="audio/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                setAudioFile(file);
                                                setAudioPreview(URL.createObjectURL(file));
                                            }
                                        }}
                                        className="hidden"
                                        id="audio-upload"
                                    />
                                    <label
                                        htmlFor="audio-upload"
                                        className="cursor-pointer flex flex-col items-center gap-2"
                                    >
                                        <Volume2 className="w-8 h-8 text-gray-400" />
                                        <div>
                                            <span className="text-sm font-medium text-blue-600 hover:text-blue-700">
                                                Subir archivo de audio
                                            </span>
                                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                                {' '}o arrastrar aquí
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">
                                            MP3, WAV, OGG - Máx 10MB
                                        </p>
                                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                                            💡 Sugerencia: Graba la pregunta con tu celular y súbelala aquí
                                        </p>
                                    </label>
                                </div>
                            )}
                        </div>
                        
                        {audioFile && !audioPreview && (
                            <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                Subiendo: {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                            </div>
                        )}
                    </div>

                    {/* Points & Tags */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Puntos
                            </label>
                            <input
                                type="number"
                                value={formData.points}
                                onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 1 })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                min="1"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Etiquetas
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                    placeholder="Agregar etiqueta..."
                                />
                                <button
                                    type="button"
                                    onClick={handleAddTag}
                                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                    <Upload className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tags Display */}
                    {formData.tags && formData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {formData.tags.map((tag, idx) => (
                                <span
                                    key={idx}
                                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm flex items-center gap-1"
                                >
                                    {toDisplayText(tag)}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveTag(toDisplayText(tag))}
                                        className="hover:text-blue-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800 -mx-6 px-6 py-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Guardando...' : (question ? 'Actualizar' : 'Guardar Pregunta')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
