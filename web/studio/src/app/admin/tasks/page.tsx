"use client";

import { useState, useEffect } from "react";
import { cmsApi, BackgroundTask } from "@/lib/api";
import { Loader2, RefreshCw, XCircle, PlayCircle } from "lucide-react";
import { format } from "date-fns";
import ProtectedRoute from "@/components/AuthGuard";

export default function BackgroundTasksPage() {
    const [tasks, setTasks] = useState<BackgroundTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchTasks = async () => {
        try {
            const data = await cmsApi.getBackgroundTasks();
            setTasks(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
        const interval = setInterval(fetchTasks, 5000); // Poll every 5 seconds
        return () => clearInterval(interval);
    }, []);

    const handleRetry = async (id: string) => {
        setActionLoading(id);
        try {
            await cmsApi.retryTask(id);
            await fetchTasks();
        } catch (error) {
            console.error("Failed to retry task", error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancel = async (id: string) => {
        if (!confirm("Are you sure you want to cancel this task? It will be removed from the queue.")) return;
        setActionLoading(id);
        try {
            await cmsApi.cancelTask(id);
            await fetchTasks();
        } catch (error) {
            console.error("Failed to cancel task", error);
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusBadge = (task: BackgroundTask) => {
        const status = task.status;
        const progress = task.progress;

        switch (status) {
            case 'processing':
                return (
                    <div className="flex flex-col gap-2">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit">
                            <Loader2 className="w-3 h-3 animate-spin" /> Processing
                        </span>
                        {task.task_type !== 'lesson_transcription' && (
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1 max-w-[150px]">
                                <div
                                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                ></div>
                                <div className="text-[10px] text-gray-400 mt-1 font-medium">{progress}% completo</div>
                            </div>
                        )}
                    </div>
                );
            case 'queued':
                return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-semibold w-fit">Queued</span>;
            case 'failed':
            case 'error':
                return <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-semibold w-fit">Failed</span>;
            case 'completed':
                return <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold w-fit">Completed</span>;
            case 'idle':
                return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-semibold w-fit">Idle</span>;
            default:
                return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-semibold w-fit">{status}</span>;
        }
    };

    const getTaskTypeBadge = (type: string) => {
        let label = 'Unknown';
        let color = 'bg-slate-100 text-slate-800';

        switch (type) {
            case 'lesson_transcription':
                label = 'Transcription';
                color = 'bg-purple-100 text-purple-800';
                break;
            case 'lesson_image':
                label = 'Lesson Image';
                color = 'bg-blue-100 text-blue-800';
                break;
            case 'course_image':
                label = 'Course Cover';
                color = 'bg-emerald-100 text-emerald-800';
                break;
        }

        return <span className={`${color} px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider`}>{label}</span>;
    };

    return (
        <ProtectedRoute>
            <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Background Tasks</h1>
                        <p className="text-gray-500">Monitor and manage asynchronous processing jobs and AI transcriptions.</p>
                    </div>
                    <button onClick={fetchTasks} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors">
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {loading && tasks.length === 0 ? (
                    <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
                ) : tasks.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center">
                        <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">🌱</span>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">All Clear</h3>
                        <p className="text-gray-500">There are no pending or stuck background tasks at the moment.</p>
                    </div>
                ) : (
                    <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task / Context</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {tasks.map((task) => (
                                    <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{task.title}</div>
                                            <div className="text-sm text-gray-500">{task.course_title || 'Unknown Course'}</div>
                                            <div className="text-xs text-gray-400 font-mono mt-1">{task.id}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getTaskTypeBadge(task.task_type)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(task)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {format(new Date(task.updated_at), 'MMM d, h:mm a')}
                                            <div className="text-xs text-gray-400">({format(new Date(task.updated_at), 'yyyy')})</div>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            {task.status === 'failed' && (
                                                <button
                                                    onClick={() => handleRetry(task.id)}
                                                    disabled={actionLoading === task.id}
                                                    className="inline-flex items-center px-3 py-1.5 border border-indigo-200 text-xs font-medium rounded-md text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
                                                >
                                                    {actionLoading === task.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <PlayCircle className="w-3 h-3 mr-1" />}
                                                    Retry
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleCancel(task.id)}
                                                disabled={actionLoading === task.id}
                                                className="inline-flex items-center px-3 py-1.5 border border-red-200 text-xs font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                                            >
                                                {actionLoading === task.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                                                Cancel
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
