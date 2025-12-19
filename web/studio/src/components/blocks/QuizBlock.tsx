"use client";

import { useState } from "react";

interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correct: number;
}

interface QuizBlockProps {
    id: string;
    title?: string;
    quizData: {
        questions: QuizQuestion[];
    };
    editMode: boolean;
    onChange: (data: { title?: string; questions?: QuizQuestion[] }) => void;
}

export default function QuizBlock({ id, title, quizData, editMode, onChange }: QuizBlockProps) {
    const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
    const [submitted, setSubmitted] = useState(false);

    const questions = quizData.questions || [];

    const addQuestion = () => {
        const newQuestion: QuizQuestion = {
            id: Math.random().toString(36).substr(2, 9),
            question: "New Question?",
            options: ["Option 1", "Option 2"],
            correct: 0
        };
        onChange({ questions: [...questions, newQuestion] });
    };

    const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
        const newQuestions = [...questions];
        newQuestions[index] = { ...newQuestions[index], ...updates };
        onChange({ questions: newQuestions });
    };

    const handleAnswer = (qId: string, optionIndex: number) => {
        if (submitted) return;
        setUserAnswers(prev => ({ ...prev, [qId]: optionIndex }));
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
                        <div key={q.id} className="p-6 glass border-white/5 space-y-4 rounded-2xl">
                            <input
                                value={q.question}
                                onChange={(e) => updateQuestion(idx, { question: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 font-semibold focus:outline-none focus:border-blue-500/50 transition-all"
                                placeholder="Enter your question..."
                            />
                            <div className="space-y-3">
                                {q.options.map((opt, oIdx) => (
                                    <div key={oIdx} className="flex gap-3 items-center">
                                        <input
                                            type="radio"
                                            checked={q.correct === oIdx}
                                            onChange={() => updateQuestion(idx, { correct: oIdx })}
                                            className="w-4 h-4 accent-blue-500"
                                        />
                                        <input
                                            value={opt}
                                            onChange={(e) => {
                                                const newOpts = [...q.options];
                                                newOpts[oIdx] = e.target.value;
                                                updateQuestion(idx, { options: newOpts });
                                            }}
                                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500/30"
                                            placeholder={`Option ${oIdx + 1}`}
                                        />
                                    </div>
                                ))}
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
                                    const isSelected = userAnswers[q.id] === oIdx;
                                    const isCorrect = q.correct === oIdx;
                                    let style = "glass border-white/10 hover:bg-white/5";
                                    if (submitted) {
                                        if (isCorrect) style = "bg-green-500/20 border-green-500 text-green-400";
                                        else if (isSelected && !isCorrect) style = "bg-red-500/20 border-red-500 text-red-100";
                                        else style = "opacity-50 grayscale border-white/5";
                                    } else if (isSelected) {
                                        style = "bg-blue-500/20 border-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.2)]";
                                    }

                                    return (
                                        <button
                                            key={oIdx}
                                            onClick={() => handleAnswer(q.id, oIdx)}
                                            className={`p-5 rounded-xl border transition-all text-left text-sm font-bold ${style}`}
                                        >
                                            {opt}
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
