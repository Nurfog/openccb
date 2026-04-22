'use client';

import React, { useMemo, useState } from 'react';
import { cmsApi, questionBankApi, MySqlPlan, MySqlCourse, AssetImportHistoryItem } from '@/lib/api';
import { Upload, Database, FileArchive, CheckCircle2, AlertTriangle, Scissors } from 'lucide-react';

export default function AdminSharedMaterialsPage() {
    const [zipFile, setZipFile] = useState<File | null>(null);
    const [ingestRag, setIngestRag] = useState(true);
    const [englishLevel, setEnglishLevel] = useState('');
    const [plans, setPlans] = useState<MySqlPlan[]>([]);
    const [courses, setCourses] = useState<MySqlCourse[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('');
    const [selectedCourseId, setSelectedCourseId] = useState<number | ''>('');
    const [splitToRegular, setSplitToRegular] = useState(false);
    const [useDevProcessing, setUseDevProcessing] = useState(false);
    const [regularPlanId, setRegularPlanId] = useState<number | ''>('');
    const [regularCourses, setRegularCourses] = useState<MySqlCourse[]>([]);
    const [selectedCourseIdR1, setSelectedCourseIdR1] = useState<number | ''>('');
    const [selectedCourseIdR2, setSelectedCourseIdR2] = useState<number | ''>('');
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [result, setResult] = useState<{
        imported_assets: number;
        rag_ingested_assets: number;
        rag_chunks_ingested: number;
        failed_entries: string[];
        rag_background_started?: boolean;
        rag_background_items?: number;
    } | null>(null);
    const [importHistory, setImportHistory] = useState<AssetImportHistoryItem[]>([]);

    const canUpload = useMemo(() => Boolean(zipFile) && !loading, [zipFile, loading]);

    // Detect if the selected course is "intensive" (no trailing digit) and auto-detect
    // the two corresponding regular courses (same name + " 1" and " 2").
    const selectedCourseName = useMemo(
        () => courses.find((c) => c.idCursos === selectedCourseId)?.NombreCurso ?? '',
        [courses, selectedCourseId],
    );
    const isIntensiveCourse = useMemo(
        () => Boolean(selectedCourseId) && !/\s*[12]$/.test(selectedCourseName.trim()),
        [selectedCourseId, selectedCourseName],
    );
    // Suggested regular course names: replace "INTENSIVE" with nothing or trim trailing "INTENSIVE"
    const regularBaseName = useMemo(() => {
        const name = selectedCourseName.trim();
        return name.replace(/\s*INTENSIVE\s*$/i, '').trim();
    }, [selectedCourseName]);
    const regularCourse1 = useMemo(
        () => regularCourses.find((c) => c.NombreCurso.trim() === `${regularBaseName} 1`)
            ?? regularCourses.find((c) => /\s1$/.test(c.NombreCurso.trim())),
        [regularCourses, regularBaseName],
    );
    const regularCourse2 = useMemo(
        () => regularCourses.find((c) => c.NombreCurso.trim() === `${regularBaseName} 2`)
            ?? regularCourses.find((c) => /\s2$/.test(c.NombreCurso.trim())),
        [regularCourses, regularBaseName],
    );

    React.useEffect(() => {
        questionBankApi.getMySQLPlans().then(setPlans).catch(() => setPlans([]));
        cmsApi.getAssetImportHistory().then(setImportHistory).catch(() => setImportHistory([]));
    }, []);

    React.useEffect(() => {
        if (!selectedPlanId) {
            setCourses([]);
            setSelectedCourseId('');
            setSplitToRegular(false);
            setRegularPlanId('');
            setRegularCourses([]);
            return;
        }
        questionBankApi.getMySQLCoursesByPlan(selectedPlanId).then(setCourses).catch(() => setCourses([]));
        // Auto-detect sibling regular plan (swap INTENSIVO <-> REGULAR in plan name)
        const intensivePlan = plans.find((p) => p.idPlanDeEstudios === selectedPlanId);
        if (intensivePlan) {
            const regularPlanName = intensivePlan.NombrePlan.replace(/INTENSIVO/i, 'REGULAR').trim();
            const sibling = plans.find((p) => p.NombrePlan.toUpperCase() === regularPlanName.toUpperCase());
            if (sibling) {
                setRegularPlanId(sibling.idPlanDeEstudios);
                questionBankApi.getMySQLCoursesByPlan(sibling.idPlanDeEstudios).then(setRegularCourses).catch(() => setRegularCourses([]));
            } else {
                setRegularPlanId('');
                setRegularCourses([]);
            }
        }
    }, [selectedPlanId, plans]);

    // Load courses for manually selected regular plan
    React.useEffect(() => {
        if (!regularPlanId) return;
        questionBankApi.getMySQLCoursesByPlan(regularPlanId).then(setRegularCourses).catch(() => setRegularCourses([]));
    }, [regularPlanId]);

    // Auto-fill regular course IDs when intensive course is selected and split is on
    React.useEffect(() => {
        if (splitToRegular && isIntensiveCourse) {
            setSelectedCourseIdR1(regularCourse1?.idCursos ?? '');
            setSelectedCourseIdR2(regularCourse2?.idCursos ?? '');
        }
    }, [splitToRegular, isIntensiveCourse, regularCourse1, regularCourse2]);

    React.useEffect(() => {
        if (!loading || !startedAt) {
            return;
        }

        const timer = window.setInterval(() => {
            const seconds = Math.floor((Date.now() - startedAt) / 1000);
            setElapsedSeconds(seconds);
        }, 1000);

        return () => {
            window.clearInterval(timer);
        };
    }, [loading, startedAt]);

    const formatElapsed = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const statusText =
        phase === 'uploading'
            ? `Subiendo ZIP... ${uploadProgress}%`
            : phase === 'processing'
                ? 'Procesando contenido en servidor (esto puede tardar varios minutos para ZIPs grandes)...'
                : phase === 'done'
                    ? 'Importacion completada'
                    : phase === 'error'
                        ? 'Importacion con error'
                        : 'Sin proceso activo';

    const handleUpload = async () => {
        if (!zipFile) {
            alert('Selecciona un archivo ZIP primero.');
            return;
        }

        try {
            setLoading(true);
            setPhase('uploading');
            setUploadProgress(0);
            setStartedAt(Date.now());
            setElapsedSeconds(0);
            setResult(null);
            const response = await cmsApi.importAssetsZip(
                zipFile,
                ingestRag,
                undefined,
                englishLevel || undefined,
                selectedPlanId || undefined,
                selectedCourseId || undefined,
                (pct) => {
                    setUploadProgress(pct);
                    setPhase(pct >= 100 ? 'processing' : 'uploading');
                },
                splitToRegular,
                selectedCourseIdR1 || undefined,
                selectedCourseIdR2 || undefined,
                useDevProcessing,
            );
            setResult(response);
            cmsApi.getAssetImportHistory().then(setImportHistory).catch(() => setImportHistory([]));
            setPhase('done');
            alert('Importacion ZIP finalizada.');
        } catch (error) {
            setPhase('error');
            console.error('ZIP import failed:', error);
            const msg = error instanceof Error ? error.message : 'Error al importar ZIP';
            alert(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Material Compartido y RAG</h1>
                <p className="text-slate-600 dark:text-gray-400 mt-2">
                    Sube ZIPs desde Admin para dejar contenido global disponible en todas las plantillas y cursos.
                </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-6 space-y-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <FileArchive className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900 dark:text-white">Importar ZIP de Materiales</h2>
                        <p className="text-xs text-slate-500 dark:text-gray-500">
                            Organiza el ZIP en carpetas por unidad: <code className="bg-slate-100 px-1 rounded">Unit 1/</code>,{' '}
                            <code className="bg-slate-100 px-1 rounded">Unit 2/</code>, etc. Los audios/videos se vinculan
                            automaticamente a los ejercicios de su unidad.
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Archivo ZIP</label>
                    <input
                        type="file"
                        accept=".zip,application/zip"
                        onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-700 dark:text-gray-200 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-indigo-500"
                    />
                    {zipFile && (
                        <p className="text-xs text-slate-500 dark:text-gray-400">
                            Seleccionado: {zipFile.name}
                        </p>
                    )}
                </div>

                <label className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <input
                        type="checkbox"
                        checked={ingestRag}
                        onChange={(e) => setIngestRag(e.target.checked)}
                    />
                    <span className="font-medium">Ingerir automaticamente en RAG al importar (recomendado activar solo para ZIPs pequeños)</span>
                </label>

                <label className="flex items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                    <input
                        type="checkbox"
                        checked={useDevProcessing}
                        onChange={(e) => setUseDevProcessing(e.target.checked)}
                    />
                    <span className="font-medium">Procesar este ZIP con infraestructura DEV (más potente) para transcripción/IA</span>
                </label>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Plan de Estudios (SAM)</label>
                    <select
                        value={selectedPlanId}
                        onChange={(e) => {
                            const value = e.target.value ? Number(e.target.value) : '';
                            setSelectedPlanId(value);
                            setSelectedCourseId('');
                            setSplitToRegular(false);
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                        <option value="">Seleccionar plan</option>
                        {plans.map((p) => (
                            <option key={p.idPlanDeEstudios} value={p.idPlanDeEstudios}>{p.NombrePlan}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Curso (SAM)</label>
                    <select
                        value={selectedCourseId}
                        onChange={(e) => {
                            const value = e.target.value ? Number(e.target.value) : '';
                            setSelectedCourseId(value);
                            setSplitToRegular(false);
                            const selected = courses.find((c) => c.idCursos === value);
                            if (selected?.NombreCurso) {
                                const normalized = selected.NombreCurso.toUpperCase().replace(/\s*INTENSIVE\s*/g, '').trim();
                                if (normalized.includes('ELEMENTARY')) setEnglishLevel('elementary');
                                else if (normalized.includes('BEGINNER')) setEnglishLevel('beginner');
                                else if (normalized.includes('PRE-INTERMEDIATE') || normalized.includes('PRE INTERMEDIATE')) setEnglishLevel('pre_intermediate');
                                else if (normalized.includes('LOW INTERMEDIATE')) setEnglishLevel('low_intermediate');
                                else if (normalized.includes('UPPER-INTERMEDIATE') || normalized.includes('UPPER INTERMEDIATE')) setEnglishLevel('upper_intermediate');
                                else if (normalized.includes('PRE ADVANCED') || normalized.includes('PRE-ADVANCED')) setEnglishLevel('pre_advanced');
                                else if (normalized.includes('ADVANCED')) setEnglishLevel('advanced');
                            }
                        }}
                        disabled={!selectedPlanId}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                    >
                        <option value="">Seleccionar curso</option>
                        {courses.map((c) => (
                            <option key={c.idCursos} value={c.idCursos}>{c.NombreCurso}</option>
                        ))}
                    </select>
                </div>

                {/* Split to regular courses — only shown for intensive courses */}
                {isIntensiveCourse && (
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-4">
                        <label className="flex items-center gap-3 text-sm text-indigo-900">
                            <input
                                type="checkbox"
                                checked={splitToRegular}
                                onChange={(e) => setSplitToRegular(e.target.checked)}
                            />
                            <Scissors className="w-4 h-4 flex-shrink-0" />
                            <span className="font-medium">
                                Dividir unidades en 2 cursos regulares (intensivo = regular 1 + regular 2)
                            </span>
                        </label>
                        <p className="text-xs text-indigo-700 ml-7">
                            Las unidades 1..N/2 van al curso regular 1 y N/2+1..N al regular 2.
                            Para 8-10 unidades esto resulta en 4-5 unidades por curso regular.
                        </p>

                        {splitToRegular && (
                            <div className="ml-7 space-y-4">
                                {/* Plan regular — may be auto-detected or chosen manually */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-medium text-indigo-800">
                                        Plan de Estudios Regular
                                    </label>
                                    <select
                                        value={regularPlanId}
                                        onChange={(e) => {
                                            const v = e.target.value ? Number(e.target.value) : '';
                                            setRegularPlanId(v);
                                            setSelectedCourseIdR1('');
                                            setSelectedCourseIdR2('');
                                        }}
                                        className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm"
                                    >
                                        <option value="">Seleccionar plan regular</option>
                                        {plans.map((p) => (
                                            <option key={p.idPlanDeEstudios} value={p.idPlanDeEstudios}>{p.NombrePlan}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="block text-xs font-medium text-indigo-800">
                                            Curso Regular 1 (unidades 1..N/2)
                                        </label>
                                        <select
                                            value={selectedCourseIdR1}
                                            onChange={(e) => setSelectedCourseIdR1(e.target.value ? Number(e.target.value) : '')}
                                            disabled={!regularPlanId}
                                            className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                                        >
                                            <option value="">Seleccionar</option>
                                            {regularCourses.map((c) => (
                                                <option key={c.idCursos} value={c.idCursos}>{c.NombreCurso}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-xs font-medium text-indigo-800">
                                            Curso Regular 2 (unidades N/2+1..N)
                                        </label>
                                        <select
                                            value={selectedCourseIdR2}
                                            onChange={(e) => setSelectedCourseIdR2(e.target.value ? Number(e.target.value) : '')}
                                            disabled={!regularPlanId}
                                            className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                                        >
                                            <option value="">Seleccionar</option>
                                            {regularCourses.map((c) => (
                                                <option key={c.idCursos} value={c.idCursos}>{c.NombreCurso}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Nivel de Ingles para este ZIP</label>
                    <select
                        value={englishLevel}
                        onChange={(e) => setEnglishLevel(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                        <option value="">Sin nivel (general)</option>
                        <option value="elementary">Elementary</option>
                        <option value="beginner">Beginner</option>
                        <option value="pre_intermediate">Pre Intermediate</option>
                        <option value="low_intermediate">Low Intermediate</option>
                        <option value="upper_intermediate">Upper Intermediate</option>
                        <option value="pre_advanced">Pre Advanced</option>
                        <option value="advanced">Advanced</option>
                    </select>
                </div>

                <button
                    type="button"
                    onClick={handleUpload}
                    disabled={!canUpload}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                    <Upload className="w-4 h-4" />
                    {loading ? 'Importando...' : 'Importar ZIP Compartido'}
                </button>

                {(loading || phase === 'done' || phase === 'error') && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-800">Estado del proceso</span>
                            <span className="text-slate-600">Tiempo: {formatElapsed(elapsedSeconds)}</span>
                        </div>

                        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div
                                className="h-full bg-indigo-600 transition-all duration-300"
                                style={{ width: `${phase === 'processing' ? 100 : uploadProgress}%` }}
                            />
                        </div>

                        <p className="text-sm text-slate-700">{statusText}</p>
                        <p className="text-xs text-slate-500">
                            Nota: la subida e importación base terminan en esta solicitud. Si activas RAG, su procesamiento puede continuar en segundo plano.
                        </p>
                    </div>
                )}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-6 space-y-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">ZIPs ya importados</h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                        Revisa nombre del ZIP y nivel antes de repetir una carga.
                    </p>
                </div>
                {importHistory.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-gray-400">Aun no hay importaciones ZIP registradas.</p>
                ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {importHistory.map((item) => (
                            <div key={item.zip_batch_id} className="rounded-xl border border-slate-200 dark:border-white/10 p-4 bg-slate-50/70 dark:bg-white/[0.03]">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white break-all">{item.source_zip_name}</p>
                                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                                            {new Date(item.created_at).toLocaleString()} · {item.asset_count} assets
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 justify-end">
                                        <span className="rounded-full border border-slate-300 dark:border-white/10 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:text-gray-300">
                                            Nivel: {item.english_level || 'general'}
                                        </span>
                                        {item.sam_plan_id && (
                                            <span className="rounded-full border border-slate-300 dark:border-white/10 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:text-gray-300">
                                                Plan SAM: {item.sam_plan_id}
                                            </span>
                                        )}
                                        {item.sam_course_id && (
                                            <span className="rounded-full border border-slate-300 dark:border-white/10 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:text-gray-300">
                                                Curso SAM: {item.sam_course_id}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {result && (
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-6 space-y-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Resultado de la Importacion</h3>
                    {result.rag_background_started && (
                        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
                            RAG en segundo plano: {result.rag_background_items ?? 0} archivos en procesamiento
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-lg border border-slate-200 dark:border-white/10 p-4">
                            <div className="flex items-center gap-2 text-slate-700 dark:text-gray-300">
                                <Database className="w-4 h-4" />
                                <span className="text-sm font-medium">Assets importados</span>
                            </div>
                            <p className="text-2xl font-black mt-2">{result.imported_assets}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 dark:border-white/10 p-4">
                            <div className="flex items-center gap-2 text-slate-700 dark:text-gray-300">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-sm font-medium">Assets ingeridos RAG</span>
                            </div>
                            <p className="text-2xl font-black mt-2">{result.rag_ingested_assets}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 dark:border-white/10 p-4">
                            <div className="flex items-center gap-2 text-slate-700 dark:text-gray-300">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-sm font-medium">Chunks RAG</span>
                            </div>
                            <p className="text-2xl font-black mt-2">{result.rag_chunks_ingested}</p>
                        </div>
                    </div>

                    {result.failed_entries.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                            <div className="flex items-center gap-2 text-amber-800 mb-2">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="text-sm font-semibold">Entradas con error</span>
                            </div>
                            <ul className="text-xs text-amber-900 space-y-1 max-h-40 overflow-y-auto">
                                {result.failed_entries.map((entry, idx) => (
                                    <li key={`${entry}-${idx}`}>- {entry}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
