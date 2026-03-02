"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import CourseEditorLayout from "@/components/CourseEditorLayout";
import RubricList from "@/components/Rubrics/RubricList";
import RubricEditor from "@/components/Rubrics/RubricEditor";
import { FileText, Info } from "lucide-react";

export default function RubricsPage() {
    const { id } = useParams() as { id: string };
    const [editingRubricId, setEditingRubricId] = useState<string | null>(null);

    return (
        <CourseEditorLayout
            activeTab="rubrics"
            pageTitle="Gestión de Rúbricas"
            pageDescription="Crea y gestiona rúbricas de evaluación para tu curso."
            pageActions={
                <div className="hidden md:flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-2xl text-blue-400 text-sm">
                    <Info className="w-4 h-4" />
                    <span>Las rúbricas pueden asignarse a múltiples lecciones.</span>
                </div>
            }
        >
            <div className="p-0">
                {editingRubricId ? (
                    <RubricEditor
                        rubricId={editingRubricId}
                        courseId={id}
                        onClose={() => setEditingRubricId(null)}
                    />
                ) : (
                    <RubricList
                        courseId={id}
                        onEdit={(rubricId) => setEditingRubricId(rubricId)}
                    />
                )}
            </div>
        </CourseEditorLayout>
    );
}
