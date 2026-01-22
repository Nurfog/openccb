"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Bold, Italic, Link as LinkIcon, Image as ImageIcon, FileText, Eye, PenLine, Sparkles, Wand2, Check, X as CloseIcon } from "lucide-react";
import AssetPickerModal from "../AssetPickerModal";
import { Asset, getImageUrl, cmsApi } from "@/lib/api";

interface DescriptionBlockProps {
    id: string;
    title?: string;
    content: string;
    editMode: boolean;
    courseId: string;
    onChange: (updates: { title?: string; content?: string }) => void;
}

export default function DescriptionBlock({ id, title, content, editMode, courseId, onChange }: DescriptionBlockProps) {
    const [showPreview, setShowPreview] = useState(false);
    const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
    const [pickerType, setPickerType] = useState<"image" | "file">("image");
    const [isReviewing, setIsReviewing] = useState(false);
    const [suggestion, setSuggestion] = useState<{ suggestion: string, comments: string } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleReviewText = async () => {
        if (!content.trim() || isReviewing) return;
        setIsReviewing(true);
        try {
            const data = await cmsApi.reviewText(content);
            setSuggestion(data);
        } catch (err) {
            console.error("Content review failed", err);
            alert("Failed to review content");
        } finally {
            setIsReviewing(false);
        }
    };

    const applySuggestion = () => {
        if (!suggestion) return;
        onChange({ content: suggestion.suggestion });
        setSuggestion(null);
    };

    const insertMarkdown = (prefix: string, suffix: string = "") => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selectedText = text.substring(start, end);
        const before = text.substring(0, start);
        const after = text.substring(end);

        const newContent = before + prefix + selectedText + suffix + after;
        onChange({ content: newContent });

        // Restore focus and selection
        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + prefix.length + selectedText.length + suffix.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    const handleAssetSelect = (asset: Asset) => {
        const url = asset.storage_path.replace('uploads/', '/assets/');
        if (asset.mimetype.startsWith('image/')) {
            insertMarkdown(`![${asset.filename}](${url})`);
        } else {
            insertMarkdown(`[${asset.filename}](${url})`);
        }
    };

    return (
        <div className="space-y-6" id={id}>
            {/* Block Header */}
            <div className="space-y-2">
                {editMode ? (
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Activity Title (Optional)</label>
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
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Instructional Content</label>
                            <div className="h-4 w-px bg-white/10 mx-2" />
                            {/* Toolbar */}
                            {!showPreview && (
                                <div className="flex items-center gap-1">
                                    <button onClick={() => insertMarkdown("**", "**")} className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white" title="Bold"><Bold size={14} /></button>
                                    <button onClick={() => insertMarkdown("*", "*")} className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white" title="Italic"><Italic size={14} /></button>
                                    <button onClick={() => insertMarkdown("[", "](url)")} className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white" title="Link"><LinkIcon size={14} /></button>
                                    <div className="w-px h-3 bg-white/10 mx-1" />
                                    <button
                                        onClick={() => { setPickerType("image"); setIsAssetPickerOpen(true); }}
                                        className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-blue-400 hover:text-blue-300"
                                        title="Insert Image"
                                    >
                                        <ImageIcon size={14} />
                                    </button>
                                    <button
                                        onClick={() => { setPickerType("file"); setIsAssetPickerOpen(true); }}
                                        className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-purple-400 hover:text-purple-300"
                                        title="Insert File Link"
                                    >
                                        <FileText size={14} />
                                    </button>
                                    <div className="w-px h-3 bg-white/10 mx-1" />
                                    <button
                                        onClick={handleReviewText}
                                        disabled={isReviewing}
                                        className={`p-1.5 rounded-md transition-all flex items-center gap-1.5 text-xs font-bold ${isReviewing ? 'bg-indigo-500/20 text-indigo-300 animate-pulse' : 'hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300'}`}
                                        title="AI Suggest Improvements"
                                    >
                                        <Sparkles size={14} className={isReviewing ? 'animate-spin' : ''} />
                                        {isReviewing ? 'Analyzing...' : 'AI Suggest'}
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex bg-white/5 rounded-lg p-1 border border-white/5">
                            <button
                                onClick={() => setShowPreview(false)}
                                className={`px-3 py-1 flex items-center gap-2 text-[10px] uppercase font-black tracking-widest rounded-md transition-all ${!showPreview ? "bg-blue-500 text-white shadow-lg" : "text-gray-500 hover:text-white"}`}
                            >
                                <PenLine size={12} /> Write
                            </button>
                            <button
                                onClick={() => setShowPreview(true)}
                                className={`px-3 py-1 flex items-center gap-2 text-[10px] uppercase font-black tracking-widest rounded-md transition-all ${showPreview ? "bg-blue-500 text-white shadow-lg" : "text-gray-500 hover:text-white"}`}
                            >
                                <Eye size={12} /> Preview
                            </button>
                        </div>
                    </div>

                    {showPreview ? (
                        <div className="min-h-[200px] p-8 rounded-2xl glass border-white/5 bg-white/5">
                            <div className="prose prose-invert max-w-none prose-p:text-gray-300 prose-p:leading-relaxed prose-p:text-lg prose-headings:text-white prose-a:text-blue-400 prose-img:rounded-xl">
                                <ReactMarkdown urlTransform={getImageUrl}>{content || "Nothing to preview..."}</ReactMarkdown>
                            </div>
                        </div>
                    ) : (
                        <div className="relative">
                            <textarea
                                ref={textareaRef}
                                value={content}
                                onChange={(e) => onChange({ content: e.target.value })}
                                placeholder="Explain the activity (Markdown supported)..."
                                className="w-full h-80 bg-white/5 border border-white/10 rounded-xl p-6 text-lg tracking-tight focus:border-blue-500/50 focus:outline-none transition-all resize-none shadow-inner custom-scrollbar"
                            />
                            <div className="absolute bottom-4 right-4 text-[10px] text-gray-600 font-bold uppercase tracking-widest pointer-events-none">
                                Markdown Mode
                            </div>
                        </div>
                    )}
                    {suggestion && (
                        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500 shadow-xl shadow-indigo-500/5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Wand2 size={16} className="text-indigo-400" />
                                    <span className="text-xs font-black uppercase tracking-widest text-indigo-300">AI Teacher Suggestions</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setSuggestion(null)}
                                        className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                                    >
                                        <CloseIcon size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Improved Version</span>
                                    <div className="p-4 bg-black/40 rounded-xl border border-white/5 text-sm text-gray-300 leading-relaxed italic">
                                        {suggestion.suggestion}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Key Changes</span>
                                    <div className="text-xs text-gray-400 leading-relaxed pl-1 whitespace-pre-line">
                                        {suggestion.comments}
                                    </div>
                                    <div className="pt-4 flex gap-3">
                                        <button
                                            onClick={applySuggestion}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 group active:scale-95"
                                        >
                                            <Check size={14} className="group-hover:scale-110 transition-transform" />
                                            Apply Changes
                                        </button>
                                        <button
                                            onClick={() => setSuggestion(null)}
                                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-bold rounded-lg border border-white/10 transition-all active:scale-95"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="prose prose-invert max-w-none prose-p:text-gray-300 prose-p:leading-relaxed prose-p:text-lg prose-headings:text-white prose-a:text-blue-400 prose-img:rounded-xl">
                    <ReactMarkdown urlTransform={getImageUrl}>{content || "No description provided."}</ReactMarkdown>
                </div>
            )}

            <AssetPickerModal
                isOpen={isAssetPickerOpen}
                onClose={() => setIsAssetPickerOpen(false)}
                courseId={courseId}
                filterType={pickerType}
                onSelect={handleAssetSelect}
            />
        </div>
    );
}
