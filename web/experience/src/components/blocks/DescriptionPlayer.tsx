"use client";

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

            <div className="prose prose-invert prose-lg max-w-none">
                {/* We can use a markdown parser here later if desired, for now simple multiline text */}
                <div className="text-gray-300 leading-relaxed whitespace-pre-wrap font-medium">
                    {content}
                </div>
            </div>
        </div>
    );
}
