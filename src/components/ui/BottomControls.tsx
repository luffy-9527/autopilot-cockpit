import React, { useEffect, useState } from 'react';
import type { CameraView, LayerVisibility, TimeOfDay } from '../../types/cockpit';

interface BottomControlsProps {
  cameraView: CameraView;
  layers: LayerVisibility;
  targetSpeed: number;
  timeOfDay: TimeOfDay;
  egoLane: 0 | 1 | 2;
  autoLaneChange: boolean;
  onCameraViewChange: (view: CameraView) => void;
  onToggleLayer: (layer: keyof LayerVisibility) => void;
  onSetSpeed: (speed: number) => void;
  onTimeOfDayChange: (time: TimeOfDay) => void;
  onLaneChange: (direction: 'left' | 'right') => void;
  onToggleAutoLaneChange: () => void;
}

export const BottomControls: React.FC<BottomControlsProps> = ({
  cameraView,
  layers,
  targetSpeed,
  timeOfDay,
  egoLane,
  autoLaneChange,
  onCameraViewChange,
  onToggleLayer,
  onSetSpeed,
  onTimeOfDayChange,
  onLaneChange,
  onToggleAutoLaneChange,
}) => {
  // 实时系统时间状态
  const [currentTime, setCurrentTime] = useState({
    timeStr: '09:19',
    dateStr: '9月30日 周三',
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const week = weekDays[now.getDay()];

      setCurrentTime({
        timeStr: `${hours}:${minutes}`,
        dateStr: `${month}月${day}日 ${week}`,
      });
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <footer className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between px-5 py-2.5 bg-slate-950/80 backdrop-blur-md border border-slate-800/80 rounded-2xl shadow-2xl pointer-events-auto select-none">
      {/* 边角修饰符 */}
      <div className="absolute top-1 left-2 w-2 h-2 border-t border-l border-cyan-500/40" />
      <div className="absolute top-1 right-2 w-2 h-2 border-t border-r border-cyan-500/40" />

      {/* 左侧控制功能区：视角、图层、车速 */}
      <div className="flex items-center gap-6 text-xs">
        {/* 1. 视角切换 */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">视角</span>
          <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-800">
            {(
              [
                { id: 'chase', label: '跟车' },
                { id: 'top', label: '俯视' },
                { id: 'cockpit', label: '驾驶' },
                { id: 'free', label: '自由' },
              ] as const
            ).map((item) => {
              const isActive = cameraView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onCameraViewChange(item.id)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-cyan-400 text-slate-950 font-bold shadow-[0_0_10px_rgba(6,182,212,0.6)]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. 业务图层显隐开关 */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">业务层</span>
          <div className="flex items-center gap-1.5">
            {[
              { id: 'path' as const, label: '规划路径' },
              { id: 'box' as const, label: '检测框' },
              { id: 'sensor' as const, label: '传感器' },
              { id: 'pointCloud' as const, label: '点云' },
            ].map((layer) => {
              const active = layers[layer.id];
              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => onToggleLayer(layer.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-all ${
                    active
                      ? 'bg-cyan-950/70 border-cyan-400/80 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                      : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {layer.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. 车速快捷预设 */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">车速</span>
          <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-800">
            {[60, 80, 100, 120].map((spd) => {
              const isSelected = targetSpeed === spd;
              return (
                <button
                  key={spd}
                  type="button"
                  onClick={() => onSetSpeed(spd)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-all ${
                    isSelected
                      ? 'bg-cyan-400 text-slate-950 font-bold shadow-[0_0_10px_rgba(6,182,212,0.6)]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {spd}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. 自动变道与手动变道控制 */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">变道</span>
          <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              disabled={egoLane === 0}
              onClick={() => onLaneChange('left')}
              title="向左变道 (快捷键 A / ←)"
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                egoLane === 0
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-cyan-300 active:scale-95'
              }`}
            >
              ◀ 左变道
            </button>
            <button
              type="button"
              onClick={onToggleAutoLaneChange}
              title="开启/关闭遇到前车时自动感知变道超车"
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                autoLaneChange
                  ? 'bg-emerald-500/20 border border-emerald-400/70 text-emerald-300 font-bold shadow-[0_0_8px_rgba(16,185,129,0.35)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              智能变道
            </button>
            <button
              type="button"
              disabled={egoLane === 2}
              onClick={() => onLaneChange('right')}
              title="向右变道 (快捷键 D / →)"
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                egoLane === 2
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-cyan-300 active:scale-95'
              }`}
            >
              右变道 ▶
            </button>
          </div>
        </div>

        {/* 5. 白天/夜间环境切换 */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">环境</span>
          <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => onTimeOfDayChange('day')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all ${
                timeOfDay === 'day'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-[0_0_10px_rgba(251,191,36,0.6)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>☀️</span>
              <span>白天</span>
            </button>
            <button
              type="button"
              onClick={() => onTimeOfDayChange('night')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all ${
                timeOfDay === 'night'
                  ? 'bg-cyan-400 text-slate-950 font-bold shadow-[0_0_10px_rgba(6,182,212,0.6)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🌙</span>
              <span>夜间</span>
            </button>
          </div>
        </div>
      </div>

      {/* 中部车道示意小地图与图例说明（对齐原图） */}
      <div className="flex items-center gap-4 px-4 py-1 bg-slate-900/60 rounded-xl border border-slate-800/80">
        {/* 车道简易微缩示意图 */}
        <div className="relative w-9 h-7 bg-slate-950/90 rounded border border-slate-700/80 flex items-center justify-around px-0.5">
          <div className="w-[1px] h-full bg-amber-500/80" />
          <div className="w-[1px] h-full border-r border-dashed border-slate-600" />
          <div className="w-[1px] h-full border-r border-dashed border-slate-600" />
          {/* 自车小点（随车道 0 / 1 / 2 平滑移动） */}
          <div
            className="absolute w-2 h-2.5 rounded-sm bg-cyan-400 bottom-1 transition-all duration-500 shadow-[0_0_6px_rgba(6,182,212,0.9)]"
            style={{ left: `${7 + egoLane * 9}px` }}
          />
          {/* 前车小点 */}
          <div className="absolute w-2 h-3 rounded-sm bg-amber-400 top-1 right-1" />
        </div>

        {/* 图例 */}
        <div className="flex flex-col text-[10px] leading-tight">
          <div className="flex items-center gap-1.5 text-cyan-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span>本车</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>同向车辆</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>对向车辆</span>
          </div>
        </div>
      </div>

      {/* 右下角真实系统时钟（对齐原图） */}
      <div className="flex flex-col items-end">
        <span className="text-xl font-black font-mono tracking-tight text-white leading-none">
          {currentTime.timeStr}
        </span>
        <span className="text-[11px] text-slate-400 font-medium mt-0.5">
          {currentTime.dateStr}
        </span>
      </div>
    </footer>
  );
};
