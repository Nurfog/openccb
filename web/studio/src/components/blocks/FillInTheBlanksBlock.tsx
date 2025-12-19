"use client";

import { useState, useMemo } from "react";

interface FillInTheBlanksBlockProps {
    id: string;
    title?: string;
    content: string;
    editMode: boolean;
    onChange: (updates: { title?: string; content?: string }) => void;
}

export default function FillInTheBlanksBlock({ id, title, content, editMode, onChange }: FillInTheBlanksBlockProps) {
    const [userAnswers, setUserAnswers] = useState<string[]>([]);
    const [submitted, setSubmitted] = useState(false);

    // Parse content to find blanks
    const parsed = useMemo(() => {
        const parts: { type: 'text' | 'blank'; value?: string; index?: number; answer?: string }[] = [];
        const answers: string[] = [];
        let lastIndex = 0;
        const regex = /\[\[(.*?)\]\]/g;
        let match;

        while ((match = regex.exec(content)) !== null) {
            // Push text before the blank
            parts.push({ type: 'text', value: content.substring(lastIndex, match.index) });
            // Push the blank
            const answer = match[1];
            parts.push({ type: 'blank', index: answers.length, answer });
            answers.push(answer);
            lastIndex = regex.lastIndex;
        }
        // Push remaining text
        parts.push({ type: 'text', value: content.substring(lastIndex) });

        return { parts, answers };
    }, [content]);

    const handleReset = () => {
        setSubmitted(false);
        setUserAnswers([]);
    };

    const isCorrect = (index: number) => {
        return userAnswers[index]?.trim().toLowerCase() === parsed.answers[index]?.trim().toLowerCase();
    };

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
                            placeholder="e.g. Fill the gaps, Quote..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold focus:border-blue-500/50 focus:outline-none"
                        />
                    </div>
                ) : (
                    <h3 className="text-xl font-bold border-l-4 border-blue-500 pl-4 py-1 tracking-tight text-white">
                        {title || "Fill in the Blanks"}
                    </h3>
                )}
            </div>

            {editMode ? (
                <div className="space-y-4">
                    <div className="p-6 glass border-white/5 space-y-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Text with blanks (use [[answer]])</label>
                        <textarea
                            value={content}
                            onChange={(e) => onChange({ content: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 min-h-[150px] text-lg font-medium focus:outline-none focus:border-blue-500/50 transition-all"
                            placeholder="Example: The [[capital]] of France is [[Paris]]."
                        />
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Tip: Surround any word with double brackets to create a blank.</p>
                    </div>
                </div>
            ) : (
                <div className="p-8 glass border-white/5 rounded-3xl space-y-8">
                    <div className="text-lg leading-loose text-gray-100">
                        {parsed.parts.map((part, i) => (
                            part.type === 'text' ? (
                                <span key={i}>{part.value}</span>
                            ) : (
                                <input
                                    key={i}
                                    type="text"
                                    value={userAnswers[part.index!] || ""}
                                    onChange={(e) => {
                                        const newAnswers = [...userAnswers];
                                        newAnswers[part.index!] = e.target.value;
                                        setUserAnswers(newAnswers);
                                    }}
                                    disabled={submitted}
                                    className={`mx-1 px-2 py-0 border-b-2 bg-transparent transition-all focus:outline-none text-center rounded-t-sm ${submitted
                                            ? (isCorrect(part.index!) ? "border-green-500 text-green-400 bg-green-500/10" : "border-red-500 text-red-100 bg-red-500/10")
                                            : "border-blue-500/30 focus:border-blue-500 text-blue-400 focus:bg-blue-500/5"
                                        }`}
                                    style={{ width: `${Math.max((part.answer?.length || 5) * 12, 60)}px` }}
                                    placeholder="..."
                                />
                            )
                        ))}
                    </div>

                    {!submitted && parsed.answers.length > 0 && (
                        <button
                            onClick={() => setSubmitted(true)}
                            className="btn-premium w-full py-4 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20"
                        >
                            Validate Answers
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
