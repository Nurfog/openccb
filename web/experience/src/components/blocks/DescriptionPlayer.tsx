"use client";

import ReactMarkdown from "react-markdown";
import { getImageUrl } from "@/lib/api";

interface DescriptionPlayerProps {
    id: string;
    title?: string;
    content: string;
}

export default function DescriptionPlayer({ id, title, content }: DescriptionPlayerProps) {
    return (
        <div className="space-y-8" id={id}>
            <div className="space-y-2">
                <h3 className="text-xl font-bold border-l-4 border-blue-500 pl-4 py-1 tracking-tight text-white uppercase tracking-widest text-[10px]">
                    {title || "Resumen"}
                </h3>
            </div>

            <div className="prose prose-invert prose-lg max-w-none prose-p:text-gray-300 prose-p:leading-relaxed prose-p:font-medium prose-headings:text-white prose-a:text-blue-400 prose-img:rounded-2xl prose-img:shadow-2xl">
                <ReactMarkdown urlTransform={getImageUrl}>{content}</ReactMarkdown>
            </div>
        </div>
    );
}
