"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sparkles, HelpCircle, CheckCircle2, RotateCcw } from "lucide-react";

interface MemoryCard {
    id: number;
    content: string;
    pairId: string;
    isFlipped: boolean;
    isMatched: boolean;
}

interface MemoryPlayerProps {
    title: string;
    pairs: { left: string, right: string, id?: string }[];
    onComplete: (score: number) => void;
}

export default function MemoryPlayer({
    title,
    pairs: initialPairs,
    onComplete
}: MemoryPlayerProps) {
    const [cards, setCards] = useState<MemoryCard[]>([]);
    const [flipped, setFlipped] = useState<number[]>([]);
    const [moves, setMoves] = useState(0);
    const [status, setStatus] = useState<"playing" | "success">("playing");

    const initializeGame = useCallback(() => {
        const gameCards: MemoryCard[] = [];
        initialPairs.forEach((pair, idx) => {
            const pairId = pair.id || idx.toString();
            // Add two of each (Left and Right)
            gameCards.push({ id: idx * 2, content: pair.left, pairId: pairId, isFlipped: false, isMatched: false });
            gameCards.push({ id: idx * 2 + 1, content: pair.right, pairId: pairId, isFlipped: false, isMatched: false });
        });

        // Shuffle
        setCards(gameCards.sort(() => Math.random() - 0.5));
        setFlipped([]);
        setMoves(0);
        setStatus("playing");
    }, [initialPairs]);

    useEffect(() => {
        initializeGame();
    }, [initializeGame]);

    const handleFlip = (id: number) => {
        if (flipped.length === 2 || status === "success") return;

        const cardIndex = cards.findIndex(c => c.id === id);
        if (cards[cardIndex].isMatched || cards[cardIndex].isFlipped) return;

        const updatedCards = [...cards];
        updatedCards[cardIndex].isFlipped = true;
        setCards(updatedCards);

        const newFlipped = [...flipped, id];
        setFlipped(newFlipped);

        if (newFlipped.length === 2) {
            setMoves(m => m + 1);
            checkMatch(newFlipped);
        }
    };

    const checkMatch = (currentFlipped: number[]) => {
        const [id1, id2] = currentFlipped;
        const card1 = cards.find(c => c.id === id1)!;
        const card2 = cards.find(c => c.id === id2)!;

        if (card1.pairId === card2.pairId) {
            // Match found
            setTimeout(() => {
                const updatedCards = cards.map(c =>
                    (c.id === id1 || c.id === id2) ? { ...c, isMatched: true } : c
                );
                setCards(updatedCards);
                setFlipped([]);

                if (updatedCards.every(c => c.isMatched)) {
                    setStatus("success");
                    onComplete(1.0);
                }
            }, 500);
        } else {
            // No match
            setTimeout(() => {
                const updatedCards = cards.map(c =>
                    (c.id === id1 || c.id === id2) ? { ...c, isFlipped: false } : c
                );
                setCards(updatedCards);
                setFlipped([]);
            }, 1000);
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
                        <Sparkles size={28} className="animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-white">{title}</h2>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-400">
                            <span>Brain Training</span>
                            <span className="w-1 h-1 rounded-full bg-indigo-800" />
                            <span>Level: Beginner</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Moves</div>
                        <div className="text-xl font-black text-white">{moves}</div>
                    </div>
                    <button
                        onClick={initializeGame}
                        className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-90"
                        title="Restart"
                    >
                        <RotateCcw size={20} className="text-gray-400" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {cards.map((card) => (
                    <div
                        key={card.id}
                        onClick={() => handleFlip(card.id)}
                        className="perspective-1000 h-40 cursor-pointer group"
                    >
                        <div className={`relative w-full h-full transition-all duration-500 transform-style-3d ${(card.isFlipped || card.isMatched) ? "rotate-y-180" : ""
                            }`}>
                            {/* Card Front (Hidden) */}
                            <div className="absolute inset-0 backface-hidden flex items-center justify-center rounded-2xl bg-[#1a1c21] border-2 border-white/5 hover:border-indigo-500/50 transition-colors shadow-lg">
                                <HelpCircle size={40} className="text-white/10 group-hover:text-indigo-500/30 transition-colors" />
                            </div>

                            {/* Card Back (Content) */}
                            <div className={`absolute inset-0 backface-hidden rotate-y-180 flex items-center justify-center rounded-2xl p-4 text-center border-2 shadow-2xl ${card.isMatched
                                ? "bg-green-500/10 border-green-500/40 text-green-400"
                                : "bg-indigo-600 border-indigo-400 text-white"
                                }`}>
                                <div className="text-center font-black text-sm tracking-tight leading-tight">
                                    {card.content}
                                    {card.isMatched && (
                                        <div className="absolute top-2 right-2">
                                            <CheckCircle2 size={16} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {status === "success" && (
                <div className="p-8 rounded-3xl bg-green-500/10 border border-green-500/20 flex flex-col items-center text-center animate-in zoom-in duration-500">
                    <div className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center mb-4 shadow-lg shadow-green-500/20">
                        <CheckCircle2 size={32} strokeWidth={3} />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-1">BRAVO!</h3>
                    <p className="text-green-500/80 font-bold uppercase tracking-widest text-xs">
                        Finished in {moves} moves
                    </p>
                </div>
            )}

            <style jsx>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
            `}</style>
        </div>
    );
}
