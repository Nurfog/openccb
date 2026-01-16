"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check } from "lucide-react";

interface Option {
    id: string;
    name: string;
}

interface ComboboxProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export default function Combobox({ options, value, onChange, placeholder = "Search..." }: ComboboxProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredOptions = options.filter(option =>
        option.name.toLowerCase().includes(search.toLowerCase())
    );

    const selectedOption = options.find(o => o.id === value);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 cursor-pointer hover:border-white/20 transition-all focus-within:ring-2 focus-within:ring-blue-500/50"
            >
                <span className={selectedOption ? "text-white" : "text-gray-500"}>
                    {selectedOption ? selectedOption.name : placeholder}
                </span>
                <ChevronDown size={18} className={`text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 z-[110] bg-[#1a1d23] border border-white/10 rounded-lg shadow-2xl overflow-hidden glass-card animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b border-white/5 bg-white/5">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                autoFocus
                                type="text"
                                className="w-full bg-black/20 border-none rounded-md pl-9 pr-4 py-2 text-sm focus:ring-0 placeholder:text-gray-600"
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                        {filteredOptions.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">No results found</div>
                        ) : (
                            filteredOptions.map(option => (
                                <div
                                    key={option.id}
                                    onClick={() => {
                                        onChange(option.id);
                                        setIsOpen(false);
                                        setSearch("");
                                    }}
                                    className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${value === option.id ? "bg-blue-600 text-white" : "hover:bg-white/5 text-gray-300"
                                        }`}
                                >
                                    <span className="text-sm font-medium">{option.name}</span>
                                    {value === option.id && <Check size={14} />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
