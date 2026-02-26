"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check, Loader2 } from "lucide-react";

interface Option {
    id: string;
    name: string;
}

interface AsyncComboboxProps {
    value: string;
    onChange: (value: string) => void;
    onSearch: (query: string) => Promise<Option[]>;
    placeholder?: string;
    id?: string;
    leftIcon?: React.ReactNode;
    defaultOptions?: Option[];
}

export default function AsyncCombobox({ value, onChange, onSearch, placeholder = "Search...", id, leftIcon, defaultOptions = [] }: AsyncComboboxProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [options, setOptions] = useState<Option[]>(defaultOptions);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => o.id === value) || defaultOptions.find(o => o.id === value);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const delayDebounceFn = setTimeout(async () => {
            if (!search) {
                setOptions(defaultOptions);
                return;
            }
            setLoading(true);
            try {
                const results = await onSearch(search);
                setOptions(results);
            } catch (error) {
                console.error("Search failed", error);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [search, onSearch, isOpen, defaultOptions]);

    return (
        <div className="relative" ref={containerRef}>
            <button
                id={id}
                type="button"
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen && !options.length && defaultOptions.length) {
                        setOptions(defaultOptions);
                    }
                }}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                className="flex items-center justify-between w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 cursor-pointer hover:border-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-left"
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {leftIcon && <div className="text-gray-400 shrink-0">{leftIcon}</div>}
                    <span className={`truncate ${selectedOption ? "text-white text-sm" : "text-gray-500 text-sm"}`}>
                        {selectedOption ? selectedOption.name : placeholder}
                    </span>
                </div>
                <ChevronDown size={18} className={`text-gray-500 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 z-[110] bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b border-white/5 bg-white/5">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                            <input
                                autoFocus
                                type="text"
                                role="combobox"
                                aria-autocomplete="list"
                                aria-expanded="true"
                                aria-controls="combobox-options"
                                className="w-full bg-slate-900/50 border-none rounded-lg pl-9 pr-8 py-2 text-sm text-white focus:outline-none focus:ring-0 placeholder:text-gray-500"
                                placeholder="Buscar empresa..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {loading && (
                                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 animate-spin" />
                            )}
                        </div>
                    </div>
                    <div
                        id="combobox-options"
                        role="listbox"
                        className="max-h-60 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                    >
                        {!loading && options.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center" role="option" aria-disabled="true">No se encontraron resultados</div>
                        ) : (
                            options.map(option => (
                                <div
                                    key={option.id}
                                    role="option"
                                    aria-selected={value === option.id}
                                    tabIndex={0}
                                    onClick={() => {
                                        onChange(option.id);
                                        setIsOpen(false);
                                        setSearch("");
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            onChange(option.id);
                                            setIsOpen(false);
                                            setSearch("");
                                        }
                                    }}
                                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors outline-none focus:bg-indigo-600 focus:text-white ${value === option.id ? "bg-indigo-600 text-white" : "hover:bg-white/5 text-gray-300"
                                        }`}
                                >
                                    <span className="text-sm font-medium">{option.name}</span>
                                    {value === option.id && <Check size={14} aria-hidden="true" />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
