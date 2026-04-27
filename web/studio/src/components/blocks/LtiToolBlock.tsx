"use client";

import { LtiExternalTool } from "@/lib/api";

interface LtiToolBlockProps {
    title?: string;
    lti_tool_id?: string;
    launch_url?: string;
    availableTools: LtiExternalTool[];
    editMode: boolean;
    onChange: (updates: {
        title?: string;
        lti_tool_id?: string;
        launch_url?: string;
        url?: string;
    }) => void;
}

export default function LtiToolBlock({
    title,
    lti_tool_id,
    launch_url,
    availableTools,
    editMode,
    onChange,
}: LtiToolBlockProps) {
    const selectedTool = availableTools.find((t) => t.id === lti_tool_id);

    if (!editMode) {
        return (
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
                <h3 className="text-sm font-semibold mb-2">{title || "Herramienta LTI"}</h3>
                <p className="text-xs text-black/60 dark:text-white/60 mb-2">
                    {selectedTool ? `Tool registrada: ${selectedTool.name}` : "Tool no seleccionada"}
                </p>
                <p className="text-xs font-mono text-blue-600 dark:text-blue-400 break-all">
                    {launch_url || "https://..."}
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4 space-y-4">
            <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50 mb-1">
                    Titulo del bloque
                </label>
                <input
                    value={title || ""}
                    onChange={(e) => onChange({ title: e.target.value })}
                    placeholder="Laboratorio Externo"
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                />
            </div>

            <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50 mb-1">
                    Herramienta LTI registrada
                </label>
                <select
                    value={lti_tool_id || ""}
                    onChange={(e) => {
                        const value = e.target.value;
                        const tool = availableTools.find((t) => t.id === value);
                        onChange({
                            lti_tool_id: value || undefined,
                            launch_url: tool?.launch_url,
                            url: tool?.launch_url,
                            ...(tool && !title ? { title: tool.name } : {}),
                        });
                    }}
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                >
                    <option value="">Selecciona una herramienta...</option>
                    {availableTools.map((tool) => (
                        <option key={tool.id} value={tool.id}>
                            {tool.name}
                        </option>
                    ))}
                </select>
                <p className="mt-1 text-[11px] text-black/50 dark:text-white/50">
                    Si no aparece ninguna, primero crea la tool en la seccion Herramientas LTI del curso.
                </p>
            </div>

            <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50 mb-1">
                    Launch URL
                </label>
                <input
                    value={launch_url || ""}
                    onChange={(e) => onChange({ launch_url: e.target.value, url: e.target.value })}
                    placeholder="https://tool.example/launch"
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm font-mono"
                />
            </div>
        </div>
    );
}
