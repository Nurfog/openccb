'use client';

import { useState, useEffect } from 'react';
import { LibraryBlock, cmsApi } from '@/lib/api';

interface LibraryPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectBlock: (block: LibraryBlock) => void;
}

export default function LibraryPanel({ isOpen, onClose, onSelectBlock }: LibraryPanelProps) {
    const [blocks, setBlocks] = useState<LibraryBlock[]>([]);
    const [filteredBlocks, setFilteredBlocks] = useState<LibraryBlock[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState<string>('');
    const [selectedTag, setSelectedTag] = useState<string>('');

    // Get unique types and tags from blocks
    const blockTypes = Array.from(new Set(blocks.map(b => b.block_type)));
    const allTags = Array.from(new Set(blocks.flatMap(b => b.tags || [])));

    useEffect(() => {
        if (isOpen) {
            loadBlocks();
        }
    }, [isOpen]);

    useEffect(() => {
        filterBlocks();
    }, [blocks, searchTerm, selectedType, selectedTag]);

    const loadBlocks = async () => {
        setLoading(true);
        try {
            const data = await api.listLibraryBlocks();
            setBlocks(data);
        } catch (error) {
            console.error('Error loading library blocks:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterBlocks = () => {
        let filtered = [...blocks];

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(
                b => b.name.toLowerCase().includes(term) ||
                    b.description?.toLowerCase().includes(term)
            );
        }

        if (selectedType) {
            filtered = filtered.filter(b => b.block_type === selectedType);
        }

        if (selectedTag) {
            filtered = filtered.filter(b => b.tags?.includes(selectedTag));
        }

        setFilteredBlocks(filtered);
    };

    const handleUseBlock = async (block: LibraryBlock) => {
        try {
            // Increment usage counter
            await api.incrementBlockUsage(block.id);
            onSelectBlock(block);
            onClose();
        } catch (error) {
            console.error('Error using block:', error);
        }
    };

    const handleDeleteBlock = async (blockId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('¿Estás seguro de eliminar este bloque de la biblioteca?')) return;

        try {
            await api.deleteLibraryBlock(blockId);
            setBlocks(blocks.filter(b => b.id !== blockId));
        } catch (error) {
            console.error('Error deleting block:', error);
            alert('Error al eliminar el bloque');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Biblioteca de Bloques</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Search */}
                        <input
                            type="text"
                            placeholder="Buscar por nombre..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        {/* Type Filter */}
                        <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todos los tipos</option>
                            {blockTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>

                        {/* Tag Filter */}
                        <select
                            value={selectedTag}
                            onChange={(e) => setSelectedTag(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todas las etiquetas</option>
                            {allTags.map(tag => (
                                <option key={tag} value={tag}>{tag}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="text-gray-500">Cargando...</div>
                        </div>
                    ) : filteredBlocks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                            <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            <p>No se encontraron bloques</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredBlocks.map((block) => (
                                <div
                                    key={block.id}
                                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-lg">{block.name}</h3>
                                            <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mt-1">
                                                {block.block_type}
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => handleDeleteBlock(block.id, e)}
                                            className="text-red-500 hover:text-red-700 ml-2"
                                            title="Eliminar"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>

                                    {block.description && (
                                        <p className="text-sm text-gray-600 mb-3">{block.description}</p>
                                    )}

                                    {block.tags && block.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-3">
                                            {block.tags.map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
                                                >
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center mt-3 pt-3 border-t">
                                        <span className="text-xs text-gray-500">
                                            Usado {block.usage_count} {block.usage_count === 1 ? 'vez' : 'veces'}
                                        </span>
                                        <button
                                            onClick={() => handleUseBlock(block)}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                                        >
                                            Usar Bloque
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50">
                    <div className="flex justify-between items-center text-sm text-gray-600">
                        <span>{filteredBlocks.length} bloque(s) encontrado(s)</span>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md font-medium"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
