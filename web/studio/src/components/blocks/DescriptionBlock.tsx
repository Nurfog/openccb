"use client";

interface DescriptionBlockProps {
    id: string;
    title?: string;
    content: string;
    editMode: boolean;
    onChange: (updates: { title?: string; content?: string }) => void;
}

export default function DescriptionBlock({ title, content, editMode, onChange }: DescriptionBlockProps) {
    return (
        <div className="space-y-6">
            {/* Block Header */}
            <div className="space-y-2">
                {editMode ? (
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Section Title (Optional)</label>
                        <input
                            type="text"
                            value={title || ""}
                            onChange={(e) => onChange({ title: e.target.value })}
                            placeholder="e.g. Introduction, Context..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold focus:border-blue-500/50 focus:outline-none"
                        />
                    </div>
                ) : (
                    title && <h3 className="text-xl font-bold border-l-4 border-blue-500 pl-4 py-1 tracking-tight text-white">{title}</h3>
                )}
            </div>

            {editMode ? (
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Instructional Text</label>
                    <textarea
                        value={content}
                        onChange={(e) => onChange({ content: e.target.value })}
                        placeholder="Explain the activity to the students..."
                        className="w-full h-40 bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:border-blue-500/50 focus:outline-none transition-all resize-none"
                    />
                </div>
            ) : (
                <div className="prose prose-invert max-w-none">
                    <p className="text-gray-300 leading-relaxed text-lg">
                        {content || "No description provided."}
                    </p>
                </div>
            )}
        </div>
    );
}
