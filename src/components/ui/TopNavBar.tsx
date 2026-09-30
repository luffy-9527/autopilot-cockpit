import React from 'react';

interface TopNavBarProps {
  laneStatusText: string;
  fps?: number;
  frameTime?: number;
  isPerfVisible?: boolean;
  onTogglePerf?: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  laneStatusText,
  fps,
  frameTime,
  isPerfVisible,
  onTogglePerf,
}) => {
  return (
    <header className="absolute top-0 left-0 right-0 z-20 flex justify-between items-start p-5 pointer-events-none">
      {/* 左上角：导航转向指示卡片（对齐原图） */}
      <div className="flex items-center gap-4 bg-slate-950/80 backdrop-blur-md border border-slate-800/80 rounded-xl px-5 py-3 shadow-2xl pointer-events-auto">
        {/* 弯曲转弯箭头图标 */}
        <div className="relative flex items-center justify-center w-12 h-12 rounded-lg bg-cyan-950/50 border border-cyan-500/40 text-cyan-400">
          <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
            <path d="M14 4h4v4h-2V6.41l-4.29 4.3a4 4 0 0 0-1.17 2.83V20h-2v-6.46a6 6 0 0 1 1.76-4.24L14.59 5H14V4z" />
          </svg>
        </div>

        {/* 距离与路线文字 */}
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold tracking-tight text-white font-mono">300</span>
            <span className="text-sm font-medium text-slate-300">米</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm font-semibold text-slate-200">华南快速干线</span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-900/60 border border-cyan-400/50 text-cyan-300 font-medium">
              右转 · 驶入匝道
            </span>
          </div>
        </div>
      </div>

      {/* 右上角：行程统计信息 + 变道指示徽章（对齐原图） */}
      <div className="flex items-center gap-6 pointer-events-auto">
        {/* 行程统计小字 */}
        <div className="flex items-center gap-6 bg-slate-950/70 backdrop-blur-md border border-slate-800/60 rounded-xl px-5 py-2.5 text-xs text-slate-400 shadow-xl">
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase text-slate-500 font-medium">剩余</span>
            <span className="text-base font-bold text-slate-100 font-mono">
              12.9 <span className="text-xs font-normal text-slate-400">km</span>
            </span>
          </div>
          <div className="w-[1px] h-6 bg-slate-800" />
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase text-slate-500 font-medium">预计</span>
            <span className="text-base font-bold text-slate-100 font-mono">09:25</span>
          </div>
          <div className="w-[1px] h-6 bg-slate-800" />
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase text-slate-500 font-medium">剩余时间</span>
            <span className="text-base font-bold text-slate-100 font-mono">
              6 <span className="text-xs font-normal text-slate-400">min</span>
            </span>
          </div>
        </div>

        {/* 变道中 LANE CHANGE 芯片边框徽章 */}
        <div className="relative flex flex-col items-center justify-center px-4 py-2 bg-emerald-950/40 border border-emerald-500/60 rounded-lg text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
          {/* 边角装饰 */}
          <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t-2 border-l-2 border-emerald-400" />
          <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t-2 border-r-2 border-emerald-400" />
          <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b-2 border-l-2 border-emerald-400" />
          <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b-2 border-r-2 border-emerald-400" />

          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold tracking-wider">{laneStatusText}</span>
          </div>
          <span className="text-[9px] tracking-widest text-emerald-300/80 uppercase font-mono mt-0.5">
            LANE CHANGE
          </span>
        </div>

        {/* 实时性能监控胶囊按钮 */}
        {onTogglePerf && (
          <button
            onClick={onTogglePerf}
            className={`group relative flex items-center gap-2 px-3.5 py-2 rounded-xl backdrop-blur-md border transition-all duration-200 cursor-pointer shadow-xl active:scale-95 ${
              isPerfVisible
                ? 'bg-cyan-950/80 border-cyan-400/80 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.35)]'
                : 'bg-slate-950/70 border-slate-800/70 text-slate-300 hover:border-slate-700'
            }`}
            title="点击切换性能监控 HUD (快捷键 P)"
          >
            {/* 脉冲指示灯 */}
            <span className="flex h-2 w-2 relative">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  (fps ?? 60) >= 50 ? 'bg-cyan-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  (fps ?? 60) >= 50 ? 'bg-cyan-500' : 'bg-amber-500'
                }`}
              />
            </span>

            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-sm font-extrabold tracking-tight">
                {fps ?? 60}
              </span>
              <span className="text-[10px] text-slate-400">FPS</span>
            </div>

            <div className="w-[1px] h-3 bg-slate-700/60" />

            <span className="text-xs font-mono text-slate-400">
              {frameTime !== undefined ? `${frameTime}ms` : '16.6ms'}
            </span>

            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800/90 text-slate-400 border border-slate-700">
              P
            </span>
          </button>
        )}
      </div>
    </header>
  );
};
