"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CourseEditorLayout from "@/components/CourseEditorLayout";
import RubricList from "@/components/Rubrics/RubricList";
import RubricEditor from "@/components/Rubrics/RubricEditor";
import { ArrowLeft, FileText, Info } from "lucide-react";

export default function RubricsPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [editingRubricId, setEditingRubricId] = useState<string | null>(null);

    return (
        <div className="min-h-screen bg-transparent text-gray-900 dark:text-white p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                                Rubrics Management
                            </h1>
                            <p className="text-gray-400 mt-1">Create and manage evaluation rubrics for your course</p>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-2xl text-blue-400 text-sm">
                        <Info className="w-4 h-4" />
                        <span>Rubrics can be assigned to multiple lessons across the course.</span>
                    </div>
                </div>

                <CourseEditorLayout activeTab="rubrics">
                    <div className="p-8">
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
            </div>
        </div>
    );
}
