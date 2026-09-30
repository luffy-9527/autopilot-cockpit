import React, { useEffect } from 'react';
import type { PerfStats } from '../../types/cockpit';

interface PerformanceHUDProps {
  stats: PerfStats | null;
  isVisible: boolean;
  onClose: () => void;
  onToggle: () => void;
}

export const PerformanceHUD: React.FC<PerformanceHUDProps> = ({
  stats,
  isVisible,
  onClose,
  onToggle,
}) => {
  // 监听键盘快捷键 [P] 快速切换显隐
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggle]);

  if (!isVisible) {
    return null;
  }

  const fps = stats?.fps ?? 60;
  const frameTime = stats?.frameTime ?? 16.6;
  const drawCalls = stats?.drawCalls ?? 0;
  const triangles = stats?.triangles ?? 0;
  const geometries = stats?.geometries ?? 0;
  const textures = stats?.textures ?? 0;
  const memoryMB = stats?.memoryMB;

  // 评级计算
  let gradeText = 'S 级 · 极佳';
  let gradeColor = 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40';
  let fpsColor = 'text-emerald-400';

  if (fps >= 58) {
    gradeText = 'S 级 · 极佳 (60FPS满帧)';
    gradeColor = 'text-cyan-300 border-cyan-400/40 bg-cyan-950/40';
    fpsColor = 'text-cyan-300';
  } else if (fps >= 45) {
    gradeText = 'A 级 · 流畅运行';
    gradeColor = 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40';
    fpsColor = 'text-emerald-400';
  } else if (fps >= 30) {
    gradeText = 'B 级 · 稍有波动';
    gradeColor = 'text-amber-400 border-amber-500/40 bg-amber-950/40';
    fpsColor = 'text-amber-400';
  } else {
    gradeText = 'C 级 · 渲染负载偏高';
    gradeColor = 'text-rose-400 border-rose-500/40 bg-rose-950/40';
    fpsColor = 'text-rose-400';
  }

  return (
    <div className="absolute top-20 right-5 z-30 w-80 select-none animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-auto">
      <div className="relative rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-slate-700/60 shadow-[0_12px_40px_rgba(0,0,0,0.65)] overflow-hidden font-sans">
        {/* 顶部高光条与科技边角 */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80" />
        <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-400" />

        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="text-xs font-bold tracking-wider text-slate-200">
              PERFORMANCE HUD
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              [P]
            </span>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-800/60"
            title="关闭监视器 (快捷键 P)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 状态评级徽章 */}
        <div className="px-4 pt-3 pb-1">
          <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-mono font-medium ${gradeColor}`}>
            <span className="font-sans font-semibold">健康评级</span>
            <span>{gradeText}</span>
          </div>
        </div>

        {/* 核心指标 2x2 网格 */}
        <div className="p-4 grid grid-cols-2 gap-2.5">
          {/* FPS */}
          <div className="flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              实时帧率 FPS
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-2xl font-extrabold font-mono ${fpsColor}`}>
                {fps}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">/ 60</span>
            </div>
          </div>

          {/* Frame Time */}
          <div className="flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              帧渲染耗时
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold font-mono text-slate-100">
                {frameTime}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">ms</span>
            </div>
          </div>

          {/* Draw Calls */}
          <div className="flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Draw Calls
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold font-mono text-cyan-300">
                {drawCalls}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">calls</span>
            </div>
          </div>

          {/* Triangles */}
          <div className="flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              渲染三角面
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold font-mono text-amber-300">
                {triangles >= 1000 ? `${(triangles / 1000).toFixed(1)}k` : triangles}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">tris</span>
            </div>
          </div>
        </div>

        {/* 详细指标清单 */}
        <div className="px-4 pb-3.5 pt-1 border-t border-slate-800/60 space-y-1.5 text-xs font-mono">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[11px] font-sans">网格几何体 (Geometries)</span>
            <span className="text-slate-200 font-bold">{geometries}</span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[11px] font-sans">GPU 纹理 (Textures)</span>
            <span className="text-slate-200 font-bold">{textures}</span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[11px] font-sans">JS 堆内存 (Heap)</span>
            <span className="text-slate-200 font-bold">
              {memoryMB !== undefined ? `${memoryMB} MB` : 'Browser Protected'}
            </span>
          </div>
        </div>

        {/* 底部贴心小提示 */}
        <div className="px-4 py-2 bg-slate-900/70 border-t border-slate-800/80 text-[10px] text-slate-500 flex justify-between items-center">
          <span>Three.js WebGL 硬件加速</span>
          <span>按 P 键快速隐藏</span>
        </div>
      </div>
    </div>
  );
};
