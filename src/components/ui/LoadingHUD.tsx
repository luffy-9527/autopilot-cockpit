import React, { useEffect, useState } from 'react';
import { ShieldCheck, Cpu, Radio } from 'lucide-react';

interface LoadingHUDProps {
  progress: number;
  isLoaded: boolean;
  stageText?: string;
}

export const LoadingHUD: React.FC<LoadingHUDProps> = ({
  progress,
  isLoaded,
  stageText = '正在加载 3D 高精数字孪生模型与感知图层...',
}) => {
  const [shouldRender, setShouldRender] = useState(true);
  const [displayedPercent, setDisplayedPercent] = useState(0);

  // 平滑插值显示百分比，防止网络跳变造成突兀感
  useEffect(() => {
    const target = Math.min(100, Math.max(0, progress));
    const interval = setInterval(() => {
      setDisplayedPercent((prev) => {
        if (prev >= target) {
          clearInterval(interval);
          return target;
        }
        return Math.min(target, prev + Math.max(1, Math.round((target - prev) * 0.25)));
      });
    }, 25);
    return () => clearInterval(interval);
  }, [progress]);

  // 当加载完成时，等待 650ms 优雅淡出动画结束后彻底卸载 DOM
  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [isLoaded]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#02040b]/88 backdrop-blur-md transition-opacity duration-700 ease-out select-none ${
        isLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* 科技背景全屏微网格底纹 */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#38bdf8 1px, transparent 1px), linear-gradient(90deg, #38bdf8 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* 核心 HUD 卡片容器 */}
      <div className="relative w-[92vw] max-w-[480px] p-6 rounded-2xl bg-gradient-to-b from-[#0b1329]/90 to-[#030712]/95 border border-cyan-500/25 shadow-[0_0_50px_rgba(6,182,212,0.18)]">
        {/* 四角高精 HUD 标定刻度线 */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />

        {/* 顶部状态与指示徽章 */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-cyan-900/40">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-xs font-semibold tracking-widest text-cyan-400 uppercase">
              COCKPIT DIGITAL TWIN
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-[10px] text-cyan-300 font-mono">
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span>DRACO 3.86MB</span>
          </div>
        </div>

        {/* 标题与车型信息 */}
        <div className="mb-5 text-center">
          <h2 className="text-lg font-bold tracking-wide text-white">
            BMW M4 Competition
          </h2>
          <p className="mt-1 text-xs text-slate-400 font-sans">
            {stageText}
          </p>
        </div>

        {/* 科技发光进度条 */}
        <div className="relative w-full h-2.5 mb-3 overflow-hidden rounded-full bg-slate-900/90 border border-cyan-800/50 p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-150 ease-out shadow-[0_0_12px_rgba(6,182,212,0.7)]"
            style={{ width: `${displayedPercent}%` }}
          />
        </div>

        {/* 百分比数值与状态描述 */}
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            {displayedPercent === 100 ? '资源校验完毕' : '几何流式解压缩'}
          </span>
          <span className="text-base font-bold text-cyan-300 tracking-wider">
            {displayedPercent}%
          </span>
        </div>

        {/* 底部微型装载提示 */}
        <div className="mt-4 pt-3 border-t border-cyan-950/50 flex items-center justify-between text-[11px] text-slate-400">
          <span>高精三维模型已就绪</span>
          <span className="text-cyan-400/80 font-mono">FCP &lt; 1.5s</span>
        </div>
      </div>
    </div>
  );
};
