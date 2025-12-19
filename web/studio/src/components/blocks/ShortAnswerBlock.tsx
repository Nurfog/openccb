"use client";

import { useState } from "react";

interface ShortAnswerBlockProps {
    id: string;
    title?: string;
    prompt: string;
    correctAnswers: string[];
    editMode: boolean;
    onChange: (updates: { title?: string; prompt?: string; correctAnswers?: string[] }) => void;
}

export default function ShortAnswerBlock({ id, title, prompt, correctAnswers, editMode, onChange }: ShortAnswerBlockProps) {
    const [userAnswer, setUserAnswer] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const handleReset = () => {
        setSubmitted(false);
        setUserAnswer("");
    };

    const isCorrect = correctAnswers.some(ans => ans.trim().toLowerCase() === userAnswer.trim().toLowerCase());

    return (
        <div className="space-y-8" id={id}>
            <div className="space-y-2">
                {editMode ? (
                    <div className="space-y-2 p-6 glass border-white/5 bg-white/5 mb-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Section Title (Optional)</label>
                        <input
                            type="text"
                            value={title || ""}
                            onChange={(e) => onChange({ title: e.target.value })}
                            placeholder="e.g. Critical Thinking, Quick Response..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold focus:border-blue-500/50 focus:outline-none"
                        />
                    </div>
                ) : (
                    <h3 className="text-xl font-bold border-l-4 border-blue-500 pl-4 py-1 tracking-tight text-white">
                        {title || "Short Answer"}
                    </h3>
                )}
            </div>

            {editMode ? (
                <div className="space-y-6">
                    <div className="p-6 glass border-white/5 space-y-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Question Prompt</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => onChange({ prompt: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 min-h-[100px] text-lg font-medium focus:outline-none focus:border-blue-500/50 transition-all"
                            placeholder="Type the question for the student..."
                        />
                    </div>

                    <div className="p-6 glass border-white/5 space-y-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Correct Answers (One per line)</label>
                        <textarea
                            value={correctAnswers ? correctAnswers.join("\n") : ""}
                            onChange={(e) => onChange({ correctAnswers: e.target.value.split("\n").filter(a => a.trim() !== "") })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 min-h-[100px] text-sm font-medium focus:outline-none focus:border-blue-500/50 transition-all"
                            placeholder="Answer 1&#10;Answer 2 (Alternative)"
                        />
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Validation is case-insensitive. Provide multiple alternatives if necessary.</p>
                    </div>
                </div>
            ) : (
                <div className="p-8 glass border-white/5 rounded-3xl space-y-8">
                    <p className="text-xl font-bold text-gray-100">{prompt || "Please enter your answer below:"}</p>

                    <div className="space-y-4">
                        <input
                            type="text"
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            disabled={submitted}
                            className={`w-full bg-white/5 border-2 rounded-2xl px-6 py-4 text-lg transition-all focus:outline-none ${submitted
                                    ? (isCorrect ? "border-green-500 bg-green-500/10 text-green-400" : "border-red-500 bg-red-500/10 text-red-100")
                                    : "border-white/10 focus:border-blue-500 text-white"
                                }`}
                            placeholder="Type your answer..."
                        />

                        {submitted && !isCorrect && (
                            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                                <p className="text-[10px] text-orange-400 uppercase font-black tracking-widest">Suggested Answer(s):</p>
                                <p className="text-sm text-gray-400 mt-1">{correctAnswers && correctAnswers[0]}</p>
                            </div>
                        )}
                    </div>

                    {!submitted && (
                        <button
                            onClick={() => setSubmitted(true)}
                            disabled={!userAnswer.trim()}
                            className="btn-premium w-full py-4 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 disabled:opacity-50 disabled:grayscale"
                        >
                            Submit Answer
                        </button>
                    )}

                    {submitted && (
                        <button
                            onClick={handleReset}
                            className="w-full py-4 glass text-blue-400 font-black text-xs uppercase tracking-[0.2em] hover:bg-white/5 transition-all rounded-xl border-white/5"
                        >
                            Try Again
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
