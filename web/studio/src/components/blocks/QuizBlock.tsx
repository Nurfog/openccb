"use client";

import { useState } from "react";

interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correct: number[];
    type?: 'multiple-choice' | 'true-false' | 'multiple-select';
}

interface QuizBlockProps {
    id: string;
    title?: string;
    quizData: {
        questions: QuizQuestion[];
    };
    editMode: boolean;
    onChange: (data: { title?: string; quiz_data?: { questions: QuizQuestion[] } }) => void;
}

export default function QuizBlock({ id, title, quizData, editMode, onChange }: QuizBlockProps) {
    const [userAnswers, setUserAnswers] = useState<Record<string, number[]>>({});
    const [submitted, setSubmitted] = useState(false);

    const questions = quizData.questions || [];

    const addQuestion = () => {
        const newQuestion: QuizQuestion = {
            id: Math.random().toString(36).substr(2, 9),
            question: "New Question?",
            options: ["Option 1", "Option 2"],
            correct: [0],
            type: 'multiple-choice'
        };
        onChange({ quiz_data: { questions: [...questions, newQuestion] } });
    };

    const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
        const newQuestions = [...questions];
        newQuestions[index] = { ...newQuestions[index], ...updates };
        onChange({ quiz_data: { questions: newQuestions } });
    };

    const toggleCorrectOption = (qIdx: number, optIdx: number, isMulti: boolean) => {
        const current = questions[qIdx].correct || [];
        if (isMulti) {
            const next = current.includes(optIdx)
                ? current.filter(i => i !== optIdx)
                : [...current, optIdx].sort((a, b) => a - b);
            updateQuestion(qIdx, { correct: next.length ? next : [0] });
        } else {
            updateQuestion(qIdx, { correct: [optIdx] });
        }
    };

    const handleAnswer = (qId: string, optionIndex: number, isMulti: boolean) => {
        if (submitted) return;
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

    return (
        <div className="space-y-8" id={id}>
            {/* Block Header */}
            <div className="space-y-2">
                {editMode ? (
                    <div className="space-y-2 p-6 glass border-white/5 bg-white/5 mb-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Section Title (Optional)</label>
                        <input
                            type="text"
                            value={title || ""}
                            onChange={(e) => onChange({ title: e.target.value })}
                            placeholder="e.g. Final Evaluation, Knowledge Check..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold focus:border-blue-500/50 focus:outline-none"
                        />
                    </div>
                ) : (
                    <h3 className="text-xl font-bold border-l-4 border-blue-500 pl-4 py-1 tracking-tight text-white">
                        {title || "Knowledge Check"}
                    </h3>
                )}
            </div>

            {editMode ? (
                <div className="space-y-6">
                    {questions.map((q, idx) => (
                        <div key={q.id} className="p-8 glass border-white/5 space-y-6 rounded-3xl relative group/question animate-in slide-in-from-left-4 duration-500">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex bg-white/5 rounded-lg p-1 border border-white/5">
                                    <button
                                        onClick={() => updateQuestion(idx, { type: 'multiple-choice', correct: [q.correct?.[0] || 0] })}
                                        className={`px-3 py-1.5 text-[9px] uppercase font-black tracking-widest rounded-md transition-all ${q.type === 'multiple-choice' ? "bg-blue-500 text-white shadow-lg" : "text-gray-500 hover:text-white"}`}
                                    >
                                        MCQ
                                    </button>
                                    <button
                                        onClick={() => updateQuestion(idx, { type: 'multiple-select', correct: [q.correct?.[0] || 0] })}
                                        className={`px-3 py-1.5 text-[9px] uppercase font-black tracking-widest rounded-md transition-all ${q.type === 'multiple-select' ? "bg-blue-500 text-white shadow-lg" : "text-gray-500 hover:text-white"}`}
                                    >
                                        MSQ
                                    </button>
                                    <button
                                        onClick={() => updateQuestion(idx, { type: 'true-false', options: ["True", "False"], correct: [0] })}
                                        className={`px-3 py-1.5 text-[9px] uppercase font-black tracking-widest rounded-md transition-all ${q.type === 'true-false' ? "bg-blue-500 text-white shadow-lg" : "text-gray-500 hover:text-white"}`}
                                    >
                                        T / F
                                    </button>
                                </div>
                                <button
                                    onClick={() => {
                                        const newQuestions = questions.filter((_, i) => i !== idx);
                                        onChange({ quiz_data: { questions: newQuestions } });
                                    }}
                                    className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                                >
                                    <span className="text-xl">×</span>
                                </button>
                            </div>

                            <input
                                value={q.question}
                                onChange={(e) => updateQuestion(idx, { question: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-lg font-bold focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-gray-600"
                                placeholder="What is the question?"
                            />

                            <div className="space-y-3">
                                {q.type === 'true-false' ? (
                                    <div className="flex gap-4">
                                        {["True", "False"].map((opt, oIdx) => (
                                            <button
                                                key={oIdx}
                                                onClick={() => updateQuestion(idx, { correct: [oIdx] })}
                                                className={`flex-1 py-4 rounded-xl border-2 transition-all font-black text-xs uppercase tracking-widest ${q.correct?.includes(oIdx) ? "border-blue-500 bg-blue-500/10 text-white" : "border-white/5 bg-white/5 text-gray-500"}`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    q.options.map((opt, oIdx) => (
                                        <div key={oIdx} className="flex gap-3 items-center group/opt">
                                            <input
                                                type={q.type === 'multiple-select' ? "checkbox" : "radio"}
                                                checked={q.correct?.includes(oIdx)}
                                                onChange={() => toggleCorrectOption(idx, oIdx, q.type === 'multiple-select')}
                                                className="w-5 h-5 accent-blue-500 cursor-pointer"
                                            />
                                            <input
                                                value={opt}
                                                onChange={(e) => {
                                                    const newOpts = [...q.options];
                                                    newOpts[oIdx] = e.target.value;
                                                    updateQuestion(idx, { options: newOpts });
                                                }}
                                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-blue-500/30 transition-all"
                                                placeholder={`Option ${oIdx + 1}`}
                                            />
                                            {q.options.length > 2 && (
                                                <button
                                                    onClick={() => {
                                                        const newOpts = q.options.filter((_, i) => i !== oIdx);
                                                        const newCorrect = q.correct?.filter(i => i !== oIdx).map(i => i > oIdx ? i - 1 : i);
                                                        updateQuestion(idx, { options: newOpts, correct: newCorrect?.length ? newCorrect : [0] });
                                                    }}
                                                    className="opacity-0 group-hover/opt:opacity-100 p-2 text-gray-500 hover:text-red-400 transition-all"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}

                                {q.type !== 'true-false' && (
                                    <button
                                        onClick={() => updateQuestion(idx, { options: [...q.options, `Option ${q.options.length + 1}`] })}
                                        className="text-[10px] font-black uppercase tracking-widest text-blue-500/50 hover:text-blue-500 transition-colors pl-8 mt-2"
                                    >
                                        + Add Option
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    <button
                        onClick={addQuestion}
                        className="w-full py-4 glass border-dashed border-2 border-white/10 text-gray-500 hover:text-white hover:border-blue-500/30 hover:bg-blue-500/5 transition-all font-bold text-xs uppercase tracking-widest rounded-2xl"
                    >
                        + Add Question
                    </button>
                </div>
            ) : (
                <div className="space-y-8">
                    {questions.map((q) => (
                        <div key={q.id} className="space-y-4 p-6 glass border-white/5 rounded-2xl">
                            <h4 className="font-bold text-xl text-gray-100 leading-tight">{q.question}</h4>
                            <div className="grid gap-3">
                                {q.options.map((opt, oIdx) => {
                                    const isSelected = userAnswers[q.id]?.includes(oIdx);
                                    const isCorrect = q.correct?.includes(oIdx);
                                    const isActuallyCorrect = isCorrect && isSelected;
                                    const isWrongSelection = !isCorrect && isSelected;
                                    const missedCorrect = isCorrect && !isSelected;

                                    let style = "glass border-white/10 hover:bg-white/5";
                                    if (submitted) {
                                        if (isActuallyCorrect) style = "bg-green-500/20 border-green-500 text-green-400";
                                        else if (isWrongSelection) style = "bg-red-500/20 border-red-500 text-red-100";
                                        else if (missedCorrect) style = "border-orange-500/50 text-orange-400 animate-pulse";
                                        else style = "opacity-50 grayscale border-white/5";
                                    } else if (isSelected) {
                                        style = "bg-blue-500/20 border-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.2)]";
                                    }

                                    return (
                                        <button
                                            key={oIdx}
                                            onClick={() => handleAnswer(q.id, oIdx, q.type === 'multiple-select')}
                                            className={`p-5 rounded-xl border transition-all text-left text-sm font-bold ${style}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span>{opt}</span>
                                                {submitted && isActuallyCorrect && <span>✅</span>}
                                                {submitted && isWrongSelection && <span>❌</span>}
                                                {submitted && missedCorrect && <span className="text-[10px] uppercase font-black tracking-tighter">Correct Answer</span>}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    {!submitted && questions.length > 0 && (
                        <button
                            onClick={() => setSubmitted(true)}
                            className="btn-premium w-full py-5 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20"
                        >
                            Validate Answers
                        </button>
                    )}
                    {submitted && (
                        <button
                            onClick={() => { setSubmitted(false); setUserAnswers({}); }}
                            className="w-full py-5 glass text-blue-400 font-black text-xs uppercase tracking-[0.2em] hover:bg-white/5 transition-all rounded-2xl"
                        >
                            Try Again
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
