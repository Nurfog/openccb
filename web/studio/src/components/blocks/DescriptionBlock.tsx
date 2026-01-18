"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Bold, Italic, Link as LinkIcon, Image as ImageIcon, FileText, Eye, PenLine } from "lucide-react";
import AssetPickerModal from "../AssetPickerModal";
import { Asset, getImageUrl } from "@/lib/api";

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
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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
