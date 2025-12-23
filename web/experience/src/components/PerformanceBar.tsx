import React from 'react';

interface PerformanceBarProps {
    score: number; // 0-100
    passingPercentage: number; // e.g., 70
}

export default function PerformanceBar({ score, passingPercentage }: PerformanceBarProps) {
    // Calculate tier boundaries
    // Reprobado: 0 to P-1
    const reprobadoMax = Math.max(0, passingPercentage - 1);
    // Rendimiento Bajo: P to P+9
    const lowMin = passingPercentage;
    const lowMax = passingPercentage + 9;
    // Rendimiento Medio: P+10 to P+15
    const mediumMin = passingPercentage + 10;
    const mediumMax = passingPercentage + 15;
    // Buen Rendimiento: P+16 to 90
    const goodMin = passingPercentage + 16;
    const goodMax = 90;
    // Excelente: 91+
    const excellentMin = 91;

    // Determine current tier
    let tier = '';
    let tierColor = '';
    let tierLabel = '';

    if (score < passingPercentage) {
        tier = 'reprobado';
        tierColor = 'bg-red-500';
        tierLabel = 'Reprobado';
    } else if (score >= lowMin && score <= lowMax) {
        tier = 'low';
        tierColor = 'bg-orange-500';
        tierLabel = 'Rendimiento Bajo';
    } else if (score >= mediumMin && score <= mediumMax) {
        tier = 'medium';
        tierColor = 'bg-yellow-500';
        tierLabel = 'Rendimiento Medio';
    } else if (score >= goodMin && score <= goodMax) {
        tier = 'good';
        tierColor = 'bg-green-500';
        tierLabel = 'Buen Rendimiento';
    } else if (score >= excellentMin) {
        tier = 'excellent';
        tierColor = 'bg-blue-500';
        tierLabel = 'Excelente';
    }

    return (
        <div className="space-y-4">
            {/* Current Score Display */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">Tu Rendimiento</div>
                    <div className={`text-3xl font-black ${tierColor.replace('bg-', 'text-')}`}>
                        {score}%
                    </div>
                </div>
                <div className={`px-4 py-2 rounded-xl ${tierColor} text-white font-bold text-sm`}>
                    {tierLabel}
                </div>
            </div>

            {/* Visual Bar */}
            <div className="relative h-8 bg-white/5 rounded-full overflow-hidden border border-white/10">
                {/* Tier segments */}
                <div className="absolute inset-0 flex">
                    {/* Reprobado */}
                    <div
                        className="bg-red-500/30 border-r border-white/20"
                        style={{ width: `${reprobadoMax}%` }}
                    ></div>
                    {/* Low */}
                    <div
                        className="bg-orange-500/30 border-r border-white/20"
                        style={{ width: `${lowMax - lowMin + 1}%` }}
                    ></div>
                    {/* Medium */}
                    <div
                        className="bg-yellow-500/30 border-r border-white/20"
                        style={{ width: `${mediumMax - mediumMin + 1}%` }}
                    ></div>
                    {/* Good */}
                    <div
                        className="bg-green-500/30 border-r border-white/20"
                        style={{ width: `${goodMax - goodMin + 1}%` }}
                    ></div>
                    {/* Excellent */}
                    <div
                        className="bg-blue-500/30"
                        style={{ width: `${100 - excellentMin + 1}%` }}
                    ></div>
                </div>

                {/* Current position indicator */}
                <div
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
                    style={{ left: `${score}%` }}
                >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-gray-900 px-2 py-1 rounded text-xs font-black">
                        {score}%
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-5 gap-2 text-xs">
                <div className="text-center">
                    <div className="w-full h-2 bg-red-500 rounded mb-1"></div>
                    <div className="text-red-400 font-bold">0-{reprobadoMax}</div>
                </div>
                <div className="text-center">
                    <div className="w-full h-2 bg-orange-500 rounded mb-1"></div>
                    <div className="text-orange-400 font-bold">{lowMin}-{lowMax}</div>
                </div>
                <div className="text-center">
                    <div className="w-full h-2 bg-yellow-500 rounded mb-1"></div>
                    <div className="text-yellow-400 font-bold">{mediumMin}-{mediumMax}</div>
                </div>
                <div className="text-center">
                    <div className="w-full h-2 bg-green-500 rounded mb-1"></div>
                    <div className="text-green-400 font-bold">{goodMin}-{goodMax}</div>
                </div>
                <div className="text-center">
                    <div className="w-full h-2 bg-blue-500 rounded mb-1"></div>
                    <div className="text-blue-400 font-bold">{excellentMin}+</div>
                </div>
            </div>
        </div>
    );
}
