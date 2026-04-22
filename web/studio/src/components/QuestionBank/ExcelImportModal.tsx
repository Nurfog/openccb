'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { CreateQuestionBankPayload, QuestionBankType, questionBankApi } from '@/lib/api';
import { X, Upload, FileSpreadsheet, Check, AlertCircle, Download } from 'lucide-react';

interface ExcelImportModalProps {
    onSuccess?: () => void;
    onCancel?: () => void;
}

export default function ExcelImportModal({ onSuccess, onCancel }: ExcelImportModalProps) {
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<{ imported: number; skipped: number; error?: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const toQuestionType = (value: string): QuestionBankType | null => {
        const normalized = value.trim().toLowerCase();
        const mapping: Record<string, QuestionBankType> = {
            'multiple-choice': 'multiple-choice',
            'multiple choice': 'multiple-choice',
            'mcq': 'multiple-choice',
            'true-false': 'true-false',
            'true false': 'true-false',
            'boolean': 'true-false',
            'short-answer': 'short-answer',
            'short answer': 'short-answer',
            'essay': 'essay',
            'matching': 'matching',
            'ordering': 'ordering',
            'fill-in-the-blanks': 'fill-in-the-blanks',
            'fill in the blanks': 'fill-in-the-blanks',
            'audio-response': 'audio-response',
            'audio response': 'audio-response',
            'hotspot': 'hotspot',
            'code-lab': 'code-lab',
            'code lab': 'code-lab',
        };
        return mapping[normalized] || null;
    };

    const parseUnknownJson = (value: string): unknown => {
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            try {
                return JSON.parse(trimmed);
            } catch {
                return undefined;
            }
        }
        if (/^-?\d+$/.test(trimmed)) {
            return Number.parseInt(trimmed, 10);
        }
        if (/^-?\d+\.\d+$/.test(trimmed)) {
            return Number.parseFloat(trimmed);
        }
        return trimmed;
    };

    const parseOptions = (raw: string): unknown => {
        const parsed = parseUnknownJson(raw);
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === 'string') {
            const pieces = parsed
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean);
            return pieces.length > 0 ? pieces : undefined;
        }
        return undefined;
    };

    const parseExcelRows = async (file: File): Promise<CreateQuestionBankPayload[]> => {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!firstSheet) return [];

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
            defval: '',
            raw: false,
        });

        return rows
            .map((row) => {
                const getField = (name: string): string => {
                    const direct = row[name];
                    if (direct !== undefined) return String(direct).trim();
                    const lowerName = name.toLowerCase();
                    const foundKey = Object.keys(row).find((k) => k.trim().toLowerCase() === lowerName);
                    return foundKey ? String(row[foundKey]).trim() : '';
                };

                const questionText = getField('question_text');
                const questionTypeRaw = getField('question_type');
                const questionType = toQuestionType(questionTypeRaw);
                if (!questionText || !questionType) return null;

                const optionsRaw = getField('options');
                const correctAnswerRaw = getField('correct_answer');
                const explanation = getField('explanation') || undefined;
                const difficultyRaw = getField('difficulty').toLowerCase();
                const difficulty = ['easy', 'medium', 'hard'].includes(difficultyRaw) ? difficultyRaw : 'medium';
                const tagsRaw = getField('tags');
                const pointsRaw = getField('points');

                let options = parseOptions(optionsRaw);
                let correctAnswer = parseUnknownJson(correctAnswerRaw);

                if (questionType === 'true-false') {
                    options = ['Verdadero', 'Falso'];
                    if (typeof correctAnswer === 'string') {
                        const lower = correctAnswer.toLowerCase();
                        correctAnswer = lower === 'verdadero' || lower === 'true' ? 0 : 1;
                    }
                }

                const tags = tagsRaw
                    ? tagsRaw
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean)
                    : undefined;

                const pointsNum = Number.parseInt(pointsRaw, 10);

                return {
                    question_text: questionText,
                    question_type: questionType,
                    options,
                    correct_answer: correctAnswer,
                    explanation,
                    difficulty,
                    tags,
                    points: Number.isFinite(pointsNum) && pointsNum > 0 ? pointsNum : 1,
                } as CreateQuestionBankPayload;
            })
            .filter((item): item is CreateQuestionBankPayload => item !== null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
                alert('Por favor sube un archivo Excel (.xlsx o .xls)');
                return;
            }
            setExcelFile(file);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!excelFile) {
            alert('Selecciona un archivo primero');
            return;
        }

        try {
            setUploading(true);
            setError(null);

            const payloads = await parseExcelRows(excelFile);
            if (payloads.length === 0) {
                throw new Error('No se encontraron filas válidas en el archivo. Verifica columnas y tipos.');
            }

            let imported = 0;
            let skipped = 0;
            const errors: string[] = [];

            for (const payload of payloads) {
                try {
                    await questionBankApi.create(payload);
                    imported += 1;
                } catch (e) {
                    skipped += 1;
                    if (errors.length < 5) {
                        errors.push((e as Error).message || 'Error desconocido al crear pregunta');
                    }
                }
            }

            setResult({
                imported,
                skipped,
                error: errors.length > 0 ? errors.join(' | ') : undefined,
            });

            setTimeout(() => {
                onSuccess?.();
            }, 2000);

        } catch (err: unknown) {
            console.error('Excel import failed:', err);
            setError((err as Error)?.message || 'Error al importar');
        } finally {
            setUploading(false);
        }
    };

    const downloadTemplate = () => {
        const csv = [
            'question_text,question_type,options,correct_answer,explanation,difficulty,tags,points',
            'What color is the sky?,multiple-choice,"[""Blue"",""Green"",""Red"",""Yellow""]",0,"The sky appears blue due to Rayleigh scattering",easy,"science,colors",1',
            'The sun rises in the east.,true-false,"[""Verdadero"",""Falso""]",0,"The sun always rises in the east",easy,"geography",1',
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'question_bank_template.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-6 h-6 text-green-600" />
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                Importar desde Excel
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Sube preguntas desde un archivo Excel (.xlsx)
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Info Box */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 text-sm">
                            ¿Cómo funciona?
                        </h4>
                        <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                            <li>• Crea un Excel con columnas: question_text, question_type, options, correct_answer, explanation, difficulty, tags</li>
                            <li>• question_type: multiple-choice, true-false, short-answer, etc.</li>
                            <li>• options: Formato JSON ["A","B","C","D"] o separado por comas</li>
                            <li>• correct_answer: Índice de la opción correcta (0, 1, 2, 3)</li>
                            <li>• Todas las preguntas se importarán al banco</li>
                        </ul>
                    </div>

                    {/* Download Template Button */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Download className="w-5 h-5 text-gray-500" />
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">Plantilla de ejemplo</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Descarga una plantilla con el formato correcto</p>
                            </div>
                        </div>
                        <button
                            onClick={downloadTemplate}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm font-medium"
                        >
                            Descargar
                        </button>
                    </div>

                    {/* File Upload */}
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileChange}
                            className="hidden"
                            id="excel-upload"
                        />
                        <label
                            htmlFor="excel-upload"
                            className="cursor-pointer flex flex-col items-center gap-3"
                        >
                            <FileSpreadsheet className="w-12 h-12 text-green-500" />
                            <div>
                                <span className="text-sm font-medium text-blue-600 hover:text-blue-700">
                                    Subir archivo Excel
                                </span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {' '}o arrastrar aquí
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                .xlsx, .xls - Máx 10MB
                            </p>
                        </label>
                        
                        {excelFile && (
                            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
                                    <Check className="w-4 h-4" />
                                    Archivo seleccionado: {excelFile.name}
                                    <span className="text-xs">({(excelFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Result Messages */}
                    {result && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <Check className="w-5 h-5 text-green-600" />
                                <p className="font-semibold text-green-900 dark:text-green-100">
                                    ¡Importación completada!
                                </p>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="text-green-700 dark:text-green-300">Importadas:</span>
                                    <span className="ml-2 font-bold text-green-900 dark:text-green-100">
                                        {result.imported}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-green-700 dark:text-green-300">Saltadas:</span>
                                    <span className="ml-2 font-bold text-green-900 dark:text-green-100">
                                        {result.skipped}
                                    </span>
                                </div>
                                {result.error && (
                                    <div>
                                        <span className="text-green-700 dark:text-green-300">Errores:</span>
                                        <span className="ml-2 font-bold text-green-900 dark:text-green-100">
                                            {result.error}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <div>
                                <p className="text-sm font-medium text-red-900 dark:text-red-100">
                                    Error
                                </p>
                                <p className="text-xs text-red-700 dark:text-red-300">
                                    {error}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={uploading}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                        {result ? 'Cerrar' : 'Cancelar'}
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={uploading || !excelFile}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Upload className="w-4 h-4" />
                        {uploading ? 'Importando...' : 'Importar Excel'}
                    </button>
                </div>
            </div>
        </div>
    );
}
