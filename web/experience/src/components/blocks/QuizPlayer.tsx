"use client";

import { useState, useEffect } from "react";
import { lmsApi } from "@/lib/api";

interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correct: number | number[];
    type?: 'multiple-choice' | 'true-false' | 'multiple-select';
    explanation?: string;
    points?: number;
}

interface QuizPlayerProps {
    id: string;
    lessonId: string;
    courseId: string;
    title?: string;
    quizData: {
        questions: QuizQuestion[];
        test_type?: string;
        instructions?: string;
        passing_score?: number;
        total_points?: number;
        max_attempts?: number;
        show_feedback?: boolean;
        permanent_history?: boolean;
    };
    allowRetry?: boolean;
    maxAttempts?: number;
    initialAttempts?: number;
    existingGrade?: {
        score: number;
        answers: any;
        created_at: string;
    };
    onAttempt?: (score: number, answers: any) => void;
}

export default function QuizPlayer({ 
    id, 
    lessonId,
    courseId,
    title, 
    quizData, 
    allowRetry = true, 
    maxAttempts = 0, 
    initialAttempts = 0,
    existingGrade,
    onAttempt 
}: QuizPlayerProps) {
    const [userAnswers, setUserAnswers] = useState<Record<string, number[]>>({});
    const [submitted, setSubmitted] = useState(false);
    const [attempts, setAttempts] = useState(initialAttempts || 0);
    const [submitting, setSubmitting] = useState(false);
    const [score, setScore] = useState<number | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [a11yStatus, setA11yStatus] = useState("");

    const questions = quizData?.questions || [];
    const isSingleAttempt = maxAttempts === 1 || quizData.max_attempts === 1;
    const hasExistingGrade = existingGrade !== undefined && existingGrade !== null;

    // Sync attempts with prop
    useEffect(() => {
        if (initialAttempts !== undefined) {
            setAttempts(initialAttempts);
        }
    }, [initialAttempts]);

    // Load existing grade if available
    useEffect(() => {
        if (hasExistingGrade && existingGrade?.answers) {
            setUserAnswers(existingGrade.answers);
            setSubmitted(true);
            setScore(existingGrade.score * 100);
        }
    }, [existingGrade]);

    const handleAnswer = (qId: string, optionIndex: number, isMulti: boolean) => {
        if (submitted) return; // No changes after submission
        
        setUserAnswers(prev => {
            const current = prev[qId] || [];
            if (isMulti) {
                const next = current.includes(optionIndex)
                    ? current.filter(i => i !== optionIndex)
                    : [...current, optionIndex].sort((a, b) => a - b);
                return { ...prev, [qId]: next };
            } else {
                return { ...prev, [qId]: [optionIndex] };
            }
        });
    };

    const calculateScore = () => {
        let totalPoints = 0;
        let earnedPoints = 0;

        questions.forEach(q => {
            const points = q.points || 1;
            totalPoints += points;

            const userAnswer = userAnswers[q.id] || [];
            const correctAnswer = Array.isArray(q.correct) ? q.correct : [q.correct];

            // Check if all correct answers are selected and no incorrect ones
            const allCorrectSelected = correctAnswer.every(idx => userAnswer.includes(idx));
            const noIncorrectSelected = userAnswer.every(idx => correctAnswer.includes(idx));

            if (allCorrectSelected && noIncorrectSelected) {
                earnedPoints += points;
            }
        });

        return totalPoints > 0 ? earnedPoints / totalPoints : 0;
    };

    const handleValidate = async () => {
        if (maxAttempts > 0 && attempts >= maxAttempts) return;
        setA11yStatus("Enviando respuestas del cuestionario.");

        // Check if all questions are answered
        const allAnswered = questions.every(q => userAnswers[q.id] && userAnswers[q.id].length > 0);
        if (!allAnswered) {
            if (!confirm('Hay preguntas sin responder. ¿Estás seguro de que deseas enviar?')) {
                setA11yStatus("Envío cancelado. Puedes completar las preguntas pendientes.");
                return;
            }
        }

        try {
            setSubmitting(true);
            
            // Calculate score
            const calculatedScore = calculateScore();
            const scorePercent = Math.round(calculatedScore * 100);
            setScore(scorePercent);

            // Prepare answers metadata
            const answersMetadata = {
                answers: userAnswers,
                questions: questions.map(q => ({
                    id: q.id,
                    question: q.question,
                    options: q.options,
                    correct: q.correct,
                    explanation: q.explanation,
                    points: q.points,
                })),
                submitted_at: new Date().toISOString(),
                quiz_type: quizData.test_type || 'quiz',
            };

            setSubmitted(true);
            setAttempts(prev => prev + 1);
            setA11yStatus(`Prueba enviada correctamente. Puntuación ${scorePercent} por ciento.`);

            if (onAttempt) {
                onAttempt(calculatedScore, answersMetadata);
            }

            // Show success message
            alert(`¡Prueba enviada! Tu puntuación: ${scorePercent}%`);
        } catch (error) {
            console.error('Error submitting quiz:', error);
            setA11yStatus('Error al enviar la prueba.');
            alert('Error al enviar la prueba. Por favor, inténtalo de nuevo.');
        } finally {
            setSubmitting(false);
        }
    };

    const getQuestionScore = (q: QuizQuestion) => {
        if (!submitted) return null;

        const userAnswer = userAnswers[q.id] || [];
        const correctAnswer = Array.isArray(q.correct) ? q.correct : [q.correct];

        const allCorrectSelected = correctAnswer.every(idx => userAnswer.includes(idx));
        const noIncorrectSelected = userAnswer.every(idx => correctAnswer.includes(idx));

        if (allCorrectSelected && noIncorrectSelected) {
            return 'correct';
        } else if (userAnswer.length === 0) {
            return 'unanswered';
        } else {
            return 'incorrect';
        }
    };

    // If already submitted and single attempt, show read-only view
    if (hasExistingGrade && isSingleAttempt) {
        return (
            <div className="space-y-6 notranslate" id={id} translate="no">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {title || "Prueba Completada"}
                        </h3>
                        <div className="text-right">
                            <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
                                {existingGrade?.score ? Math.round(existingGrade.score * 100) : 0}%
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(existingGrade?.created_at || Date.now()).toLocaleDateString()}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            Completado
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                            1 intento permitido
                        </span>
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                            {showHistory ? 'Ocultar detalles' : 'Ver mis respuestas'}
                        </button>
                    </div>
                </div>

                {showHistory && (
                    <div className="space-y-4">
                        {questions.map((q, qIdx) => {
                            const userAnswer = userAnswers[q.id] || [];
                            const correctAnswer = Array.isArray(q.correct) ? q.correct : [q.correct];
                            const questionScore = getQuestionScore(q);

                            return (
                                <div 
                                    key={q.id} 
                                    className={`border rounded-xl p-5 ${
                                        questionScore === 'correct' 
                                            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' 
                                            : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                                    }`}
                                >
                                    <div className="flex items-start gap-3 mb-3">
                                        <span className={`text-lg font-bold ${
                                            questionScore === 'correct' ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                            {questionScore === 'correct' ? '✓' : '✗'}
                                        </span>
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-900 dark:text-white mb-3">
                                                {qIdx + 1}. {q.question}
                                            </p>
                                            
                                            <div className="space-y-2">
                                                {q.options.map((opt, oIdx) => {
                                                    const isSelected = userAnswer.includes(oIdx);
                                                    const isCorrect = correctAnswer.includes(oIdx);
                                                    
                                                    let optionClass = "p-3 rounded-lg border text-sm ";
                                                    if (isCorrect) {
                                                        optionClass += "border-green-500 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200";
                                                    } else if (isSelected && !isCorrect) {
                                                        optionClass += "border-red-500 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200";
                                                    } else {
                                                        optionClass += "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 opacity-60";
                                                    }

                                                    return (
                                                        <div key={oIdx} className={optionClass}>
                                                            <div className="flex items-center justify-between">
                                                                <span>{opt}</span>
                                                                {isCorrect && <span className="text-green-600">✓ Correcta</span>}
                                                                {isSelected && !isCorrect && <span className="text-red-600">✗ Tu respuesta</span>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {q.explanation && (
                                                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                                                        📝 Explicación:
                                                    </p>
                                                    <p className="text-sm text-blue-700 dark:text-blue-300">
                                                        {q.explanation}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // Normal quiz mode (not yet submitted or allows retry)
    return (
        <div className="space-y-8 notranslate" id={id} translate="no">
            <p className="sr-only" aria-live="polite" aria-atomic="true">{a11yStatus}</p>
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold border-l-4 border-blue-600 dark:border-blue-500 pl-4 py-1 tracking-tight text-gray-900 dark:text-white uppercase tracking-widest text-[10px]">
                        {title || "Verificación de Conocimientos"}
                    </h3>
                    {isSingleAttempt && (
                        <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-black uppercase tracking-widest rounded-full border border-red-200 dark:border-red-800">
                            1 Solo Intento
                        </span>
                    )}
                </div>
                
                {quizData.instructions && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Instrucciones:</strong> {quizData.instructions}
                        </p>
                    </div>
                )}
                
                {maxAttempts > 0 && (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-gray-500 dark:text-gray-400">
                        Intento {attempts} / {maxAttempts}
                    </span>
                )}
            </div>

            <div className="space-y-8">
                {questions.map((q, qIdx) => (
                    <fieldset 
                        key={q.id} 
                        className="space-y-4 p-8 glass border-black/5 dark:border-white/5 rounded-3xl bg-black/[0.02] dark:bg-black/20" 
                        aria-labelledby={`q-${q.id}-text`}
                    >
                        <legend id={`q-${q.id}-text`} className="font-bold text-xl text-gray-900 dark:text-gray-100 leading-tight mb-4">
                            {qIdx + 1}. {q.question}
                        </legend>
                        <div
                            className="grid gap-3"
                            role={q.type === 'multiple-select' ? 'group' : 'radiogroup'}
                            aria-label="Opciones de respuesta"
                        >
                            {q.options.map((opt, oIdx) => {
                                const isSelected = userAnswers[q.id]?.includes(oIdx);
                                const correctAnswers = Array.isArray(q.correct) ? q.correct : [q.correct];
                                const isCorrect = correctAnswers.includes(oIdx);
                                const isActuallyCorrect = isCorrect && isSelected;
                                const isWrongSelection = !isCorrect && isSelected;
                                const missedCorrect = isCorrect && !isSelected;

                                let style = "glass border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300";
                                if (submitted) {
                                    if (isActuallyCorrect) style = "bg-green-500/20 border-green-500 text-green-400";
                                    else if (isWrongSelection) style = "bg-red-500/20 border-red-500 text-red-100";
                                    else if (missedCorrect) style = "border-orange-500/50 text-orange-400 animate-pulse";
                                    else style = "opacity-50 grayscale border-white/5";
                                } else if (isSelected) {
                                    style = "bg-blue-600/10 dark:bg-blue-500/20 border-blue-600 dark:border-blue-500 text-blue-700 dark:text-white shadow-[0_0_20px_rgba(59,130,246,0.2)]";
                                }

                                return (
                                    <button
                                        key={oIdx}
                                        type="button"
                                        role={q.type === 'multiple-select' ? 'checkbox' : 'radio'}
                                        aria-checked={isSelected}
                                        aria-disabled={submitted || submitting}
                                        aria-label={`Opción ${oIdx + 1}: ${opt}`}
                                        onClick={() => handleAnswer(q.id, oIdx, q.type === 'multiple-select')}
                                        className={`p-5 rounded-xl border transition-all text-left text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 disabled:cursor-not-allowed ${style}`}
                                        disabled={submitted || submitting}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>{opt}</span>
                                            {submitted && (
                                                <div className="flex items-center gap-2">
                                                    {isActuallyCorrect && <span role="img" aria-label="Correcto">✅</span>}
                                                    {isWrongSelection && <span role="img" aria-label="Incorrecto">❌</span>}
                                                    {missedCorrect && <span className="text-[10px] uppercase font-black tracking-tighter text-orange-400">Respuesta Correcta</span>}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Show explanation after submission if enabled */}
                        {submitted && q.explanation && quizData.show_feedback && (
                            <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                                <p className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-1">
                                    💡 Explicación:
                                </p>
                                <p className="text-sm text-purple-700 dark:text-purple-300">
                                    {q.explanation}
                                </p>
                            </div>
                        )}
                    </fieldset>
                ))}

                {!submitted && questions.length > 0 && (
                    <button
                        onClick={handleValidate}
                        disabled={submitting || (maxAttempts > 0 && attempts >= maxAttempts)}
                        className={`btn-premium w-full py-5 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 ${
                            isSingleAttempt ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800' : ''
                        }`}
                        aria-describedby={`quiz-attempts-${id}`}
                    >
                        {submitting ? 'Enviando...' : (
                            isSingleAttempt 
                                ? 'Enviar Respuestas (1 Solo Intento)' 
                                : maxAttempts > 0 && attempts >= maxAttempts 
                                    ? 'Máximo de Intentos Alcanzado' 
                                    : 'Validar Respuestas'
                        )}
                    </button>
                )}
                <p id={`quiz-attempts-${id}`} className="sr-only">
                    Intentos usados: {attempts}. Máximo permitido: {maxAttempts > 0 ? maxAttempts : 'sin límite'}.
                </p>

                {submitted && score !== null && (
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 dark:border-green-700 rounded-2xl p-6 text-center">
                        <div className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-2">Tu Puntuación</div>
                        <div className="text-5xl font-black text-green-600 dark:text-green-400 mb-4">
                            {score}%
                        </div>
                        {quizData.passing_score && (
                            <div className={`text-sm font-bold ${
                                score >= quizData.passing_score 
                                    ? 'text-green-600 dark:text-green-400' 
                                    : 'text-red-600 dark:text-red-400'
                            }`}>
                                {score >= quizData.passing_score ? '✓ Aprobado' : '✗ No Aprobado'} 
                                (Mínimo: {quizData.passing_score}%)
                            </div>
                        )}
                        {quizData.show_feedback && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                                📍 Revisa las explicaciones de cada pregunta más arriba
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
