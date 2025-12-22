"use client";

import { useState } from "react";

interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correct: number[];
    type?: 'multiple-choice' | 'true-false' | 'multiple-select';
}

interface QuizPlayerProps {
    id: string;
    title?: string;
    quizData: {
        questions: QuizQuestion[];
    };
    allowRetry?: boolean;
}

export default function QuizPlayer({ id, title, quizData, allowRetry = true }: QuizPlayerProps) {
    const [userAnswers, setUserAnswers] = useState<Record<string, number[]>>({});
    const [submitted, setSubmitted] = useState(false);

    const questions = quizData?.questions || [];

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
            <div className="space-y-2">
                <h3 className="text-xl font-bold border-l-4 border-blue-500 pl-4 py-1 tracking-tight text-white uppercase tracking-widest text-[10px]">
                    {title || "Knowledge Check"}
                </h3>
            </div>

            <div className="space-y-8">
                {questions.map((q) => (
                    <div key={q.id} className="space-y-4 p-8 glass border-white/5 rounded-3xl">
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

                {allowRetry && (
                    <>
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
                                className="w-full py-5 glass text-blue-400 font-black text-xs uppercase tracking-[0.2em] hover:bg-white/5 transition-all rounded-3xl border-white/5"
                            >
                                Try Again
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
