import React from 'react';
import type { CockpitState } from '../../types/cockpit';

interface RightPanelProps {
  state: CockpitState;
  onFollowDistanceChange?: (bars: number) => void;
  onToggleAcc?: () => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  state,
  onFollowDistanceChange,
  onToggleAcc,
}) => {
  return (
    <aside className="absolute right-5 top-28 z-20 w-72 flex flex-col gap-3 pointer-events-none select-none">
      {/* 1. 纵向控制 · ACC / AEB */}
      <div className="relative p-3.5 bg-slate-950/75 backdrop-blur-md border border-slate-800/80 rounded-xl shadow-2xl pointer-events-auto">
        {/* 顶部标题与状态 */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/60">
          <span className="text-xs font-semibold text-slate-300">纵向控制 · ACC / AEB</span>
          <button
            type="button"
            onClick={onToggleAcc}
            className={`text-[10px] px-2 py-0.5 rounded border font-mono font-medium transition-all ${
              state.accActive
                ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            {state.accActive ? '巡航激活' : '已暂停'}
          </button>
        </div>

        {/* 速度与前车参数 */}
        <div className="grid grid-cols-2 gap-y-1.5 text-xs">
          <div className="text-slate-400">设定车速</div>
          <div className="text-right font-mono font-bold text-white">{state.targetSpeed} km/h</div>

          <div className="text-slate-400">实际车速</div>
          <div className="text-right font-mono font-bold text-cyan-400">
            {Math.round(state.currentSpeed)} km/h
          </div>

          <div className="text-slate-400">前车车距</div>
          <div className="text-right font-mono text-slate-300">
            {state.frontCarDistance !== null ? `${state.frontCarDistance} m` : '-- m'}
          </div>

          <div className="text-slate-400">碰撞时间 TTC</div>
          <div className="text-right font-mono text-slate-300">{state.ttc}</div>
        </div>

        {/* 跟车时距滑块标尺 */}
        <div className="mt-3 pt-2 border-t border-slate-800/60">
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mb-1">
            <span>0</span>
            <span className="text-slate-400">安全车距</span>
            <span>60m</span>
          </div>
          <div className="flex items-center gap-1.5 h-2">
            {[1, 2, 3, 4].map((bar) => (
              <div
                key={bar}
                onClick={() => onFollowDistanceChange && onFollowDistanceChange(bar)}
                className={`flex-1 h-1.5 rounded-full cursor-pointer transition-colors ${
                  bar <= state.followDistanceBars ? 'bg-cyan-400' : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 2. 车辆状态 · VEHICLE */}
      <div className="relative p-3.5 bg-slate-950/75 backdrop-blur-md border border-slate-800/80 rounded-xl shadow-2xl pointer-events-auto">
        <div className="text-xs font-semibold text-slate-300 pb-2 mb-2 border-b border-slate-800/60">
          车辆状态 · VEHICLE
        </div>

        {/* 动力电池电量与高科技彩色进度条 */}
        <div className="mb-2.5">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">动力电池</span>
            <span className="font-mono font-bold text-cyan-400">{state.batteryPercent}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.6)] transition-all duration-300"
              style={{ width: `${state.batteryPercent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-y-1.5 text-xs">
          <div className="text-slate-400">续航里程</div>
          <div className="text-right font-mono font-medium text-slate-200">
            {state.remainingRangeKm} km
          </div>

          <div className="text-slate-400">能耗</div>
          <div className="text-right font-mono font-medium text-slate-200">
            {state.energyConsumption} kWh/100km
          </div>

          <div className="text-slate-400">车内温度</div>
          <div className="text-right font-mono font-medium text-slate-200">
            {state.cabinTemp} °C
          </div>
        </div>
      </div>

      {/* 3. 感知系统 · PERCEPTION */}
      <div className="relative p-3.5 bg-slate-950/75 backdrop-blur-md border border-slate-800/80 rounded-xl shadow-2xl pointer-events-auto">
        <div className="text-xs font-semibold text-slate-300 pb-2 mb-2 border-b border-slate-800/60">
          感知系统 · PERCEPTION
        </div>

        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">激光雷达 x3</span>
            </div>
            <span className="text-emerald-400 text-[11px] font-mono">正常</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">毫米波雷达 x5</span>
            </div>
            <span className="text-emerald-400 text-[11px] font-mono">正常</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">前视摄像头 x3</span>
            </div>
            <span className="text-emerald-400 text-[11px] font-mono">正常</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span className="text-slate-400">高精定位 RTK</span>
            </div>
            <span className="text-cyan-400 text-[11px] font-mono">厘米级</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span className="text-slate-400">V2X 车路协同</span>
            </div>
            <span className="text-cyan-400 text-[11px] font-mono">已连接</span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 mt-0.5">
            <span className="text-slate-400">目标探测数</span>
            <span className="font-mono font-bold text-white">4</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
