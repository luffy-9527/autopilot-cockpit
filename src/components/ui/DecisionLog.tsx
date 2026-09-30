import React from 'react';
import type { DecisionLogItem } from '../../types/cockpit';

interface DecisionLogProps {
  logs: DecisionLogItem[];
}

export const DecisionLog: React.FC<DecisionLogProps> = ({ logs }) => {
  return (
    <aside className="absolute left-5 top-28 z-20 w-80 pointer-events-none">
      <div className="relative p-3.5 bg-slate-950/75 backdrop-blur-md border border-slate-800/80 rounded-xl shadow-2xl pointer-events-auto">
        {/* 科技风格边角修饰符 */}
        <div className="absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 border-cyan-500/60" />
        <div className="absolute top-1 right-1 w-2 h-2 border-t-2 border-r-2 border-cyan-500/60" />
        <div className="absolute bottom-1 left-1 w-2 h-2 border-b-2 border-l-2 border-cyan-500/60" />
        <div className="absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 border-cyan-500/60" />

        {/* 标题 */}
        <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-800/60 text-xs font-semibold text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span>决策日志 · DECISION LOG</span>
        </div>

        {/* 日志列表 */}
        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1 text-[11px] font-mono leading-relaxed">
          {logs.map((log) => {
            const isChange = log.text.includes('变道');
            return (
              <div key={log.id} className="flex items-start gap-2 hover:bg-slate-900/50 p-1 rounded transition-colors">
                <span className="text-cyan-400/90 shrink-0 font-medium">{log.time}</span>
                <span
                  className={
                    isChange
                      ? 'text-emerald-300/95 font-sans font-medium'
                      : 'text-slate-300 font-sans'
                  }
                >
                  {log.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
