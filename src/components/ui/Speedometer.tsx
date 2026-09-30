import React from 'react';

interface SpeedometerProps {
  currentSpeed: number;
  gear: 'P' | 'R' | 'N' | 'D';
  onGearChange?: (gear: 'P' | 'R' | 'N' | 'D') => void;
}

export const Speedometer: React.FC<SpeedometerProps> = ({
  currentSpeed,
  gear,
  onGearChange,
}) => {
  // 计算仪表盘圆弧进度（0 ~ 160 km/h 对应 0 ~ 240 度弧长）
  const maxSpeed = 160;
  const clampedSpeed = Math.min(Math.max(currentSpeed, 0), maxSpeed);
  const ratio = clampedSpeed / maxSpeed;

  // SVG 弧形参数
  const radius = 68;
  const circumference = 2 * Math.PI * radius; // 约 427
  // 仪表盘覆盖约 220 度的弧度
  const arcLength = circumference * (220 / 360);
  const strokeDashoffset = arcLength * (1 - ratio);

  return (
    <div className="absolute left-6 bottom-20 z-20 pointer-events-none select-none">
      <div className="relative w-48 h-48 p-3 bg-slate-950/75 backdrop-blur-md border border-slate-800/80 rounded-2xl shadow-2xl flex flex-col items-center justify-between pointer-events-auto">
        {/* 边角修饰符 */}
        <div className="absolute top-1.5 left-1.5 w-2 h-2 border-t-2 border-l-2 border-slate-500/70" />
        <div className="absolute top-1.5 right-1.5 w-2 h-2 border-t-2 border-r-2 border-slate-500/70" />
        <div className="absolute bottom-1.5 left-1.5 w-2 h-2 border-b-2 border-l-2 border-slate-500/70" />
        <div className="absolute bottom-1.5 right-1.5 w-2 h-2 border-b-2 border-r-2 border-slate-500/70" />

        {/* 速度表盘 SVG */}
        <div className="relative w-36 h-36 flex items-center justify-center -mt-1">
          <svg className="w-full h-full -rotate-110" viewBox="0 0 160 160">
            {/* 渐变定义 */}
            <defs>
              <linearGradient id="speedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="60%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>

            {/* 背景底轨 */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#1e293b"
              strokeWidth="6"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeLinecap="round"
            />

            {/* 动态高亮发光进度条（对齐原图金黄橙色弧线） */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="url(#speedGrad)"
              strokeWidth="6"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-150 ease-out"
              style={{
                filter: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.7))',
              }}
            />
          </svg>

          {/* 仪表盘中心数字车速 */}
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-4xl font-black tracking-tight text-white font-mono drop-shadow-md">
              {Math.round(currentSpeed)}
            </span>
            <span className="text-[11px] font-bold text-slate-400 tracking-wider -mt-0.5">
              KM / H
            </span>
          </div>
        </div>

        {/* 底部档位指示器：[ P ] [ R ] [ N ] [ D ] */}
        <div className="flex items-center gap-2 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800/80 w-full justify-around mb-1">
          {(['P', 'R', 'N', 'D'] as const).map((g) => {
            const isActive = gear === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => onGearChange && onGearChange(g)}
                className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold font-mono transition-all ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-[0_0_10px_rgba(6,182,212,0.8)] scale-105'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
