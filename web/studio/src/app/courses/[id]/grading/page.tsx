"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { cmsApi, GradingCategory } from "@/lib/api";
import {
    Plus,
    Trash2,
    Percent,
    AlertCircle,
    CheckCircle2,
    ArrowLeft,
    TrendingUp,
    Settings
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import CourseEditorLayout from "@/components/CourseEditorLayout";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function GradingPolicyPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [categories, setCategories] = useState<GradingCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState("");
    const [newWeight, setNewWeight] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);

    const loadCategories = useCallback(async () => {
        try {
            const data = await cmsApi.getGradingCategories(id);
            setCategories(data);
        } catch (err) {
            console.error("Failed to load categories", err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    async function handleAdd() {
        if (!newName || newWeight <= 0) return;
        setSubmitting(true);
        try {
            await cmsApi.createGradingCategory(id, newName, newWeight);
            setNewName("");
            setNewWeight(0);
            await loadCategories();
        } catch (err) {
            console.error("Failed to create category", err);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete(catId: string) {
        if (!confirm("Are you sure you want to delete this category?")) return;
        try {
            await cmsApi.deleteGradingCategory(catId);
            await loadCategories();
        } catch (err) {
            console.error("Failed to delete category", err);
        }
    }

    const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
    const isBalanced = totalWeight === 100;

    if (loading) return (
        <div className="min-h-screen bg-[#0f1115] flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0f1115] text-white p-8">
            <div className="max-w-4xl mx-auto">
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
                                Grading Policy
                            </h1>
                            <p className="text-gray-400 mt-1">Configure assessment types and weight distribution</p>
                        </div>
                    </div>

                    <div className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-500",
                        isBalanced ? "bg-green-500/10 border-green-500/30 text-green-400 shadow-lg shadow-green-500/5"
                            : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    )}>
                        {isBalanced ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="font-bold text-lg">{totalWeight}%</span>
                        <span className="text-sm opacity-70">Total Weight</span>
                    </div>
                </div>

                <CourseEditorLayout activeTab="grading">
                    <div className="p-8">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Categories List */}
                            <div className="lg:col-span-2 space-y-4">
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-6 flex items-center gap-2">
                                    <Settings className="w-4 h-4" /> Assessment Categories
                                </h2>

                                {categories.length === 0 ? (
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                                        <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                        <p className="text-gray-400 italic">No grading categories defined yet.</p>
                                    </div>
                                ) : (
                                    categories.map((cat) => (
                                        <div
                                            key={cat.id}
                                            className="group bg-white/5 border border-white/10 p-6 rounded-2xl flex items-center justify-between hover:border-blue-500/50 hover:bg-white/[0.07] transition-all duration-300"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold group-hover:scale-110 transition-transform">
                                                    {cat.weight}%
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold text-gray-100">{cat.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full capitalize">
                                                            Weight: {cat.weight}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(cat.id)}
                                                className="p-3 bg-red-500/10 text-red-400 rounded-xl opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all duration-300"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Add New Category Form */}
                            <div className="space-y-6">
                                <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 p-8 rounded-3xl border border-white/10 sticky top-8">
                                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <Plus className="w-5 h-5 text-blue-400" /> New Format
                                    </h2>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest ml-1">Type Name</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Quizzes, Final Exam"
                                                value={newName}
                                                onChange={(e) => setNewName(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mt-1.5 focus:outline-none focus:border-blue-500 transition-all text-gray-100"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest ml-1">Weight (%)</label>
                                            <div className="relative mt-1.5">
                                                <input
                                                    type="number"
                                                    placeholder="20"
                                                    value={newWeight || ""}
                                                    onChange={(e) => setNewWeight(parseInt(e.target.value) || 0)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-all text-gray-100 pl-10"
                                                />
                                                <Percent className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleAdd}
                                            disabled={submitting || !newName || newWeight <= 0}
                                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 rounded-2xl mt-4 transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            {submitting ? "Adding..." : (
                                                <>
                                                    <Plus className="w-5 h-5" />
                                                    Add Category
                                                </>
                                            )}
                                        </button>

                                        {!isBalanced && (
                                            <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
                                                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                                <p className="text-sm text-amber-200/80 leading-relaxed">
                                                    The total weight of all categories must be exactly 100% for the course to be valid for certification. Currently: <strong>{totalWeight}%</strong>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </CourseEditorLayout>
            </div>
        </div>
    );
}
