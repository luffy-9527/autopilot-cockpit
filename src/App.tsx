import { useState, useEffect, useRef } from 'react';
import { AutopilotScene } from './components/scene/AutopilotScene';
import { TopNavBar } from './components/ui/TopNavBar';
import { DecisionLog } from './components/ui/DecisionLog';
import { Speedometer } from './components/ui/Speedometer';
import { RightPanel } from './components/ui/RightPanel';
import { BottomControls } from './components/ui/BottomControls';
import { PerformanceHUD } from './components/ui/PerformanceHUD';
import type {
  CameraView,
  CockpitState,
  LayerVisibility,
  SurroundingVehicle,
  TimeOfDay,
  PerfStats,
} from './types/cockpit';

export function App() {
  // 性能监视器状态 (默认展开，可按 P 键或点击右上角胶囊收起)
  const [perfStats, setPerfStats] = useState<PerfStats | null>(null);
  const [showPerfHUD, setShowPerfHUD] = useState<boolean>(true);

  // 1. 核心自动驾驶与座舱状态
  const [cockpitState, setCockpitState] = useState<CockpitState>({
    targetSpeed: 120,
    currentSpeed: 120,
    gear: 'D',
    accActive: true,
    followDistanceBars: 2,
    ttc: '--',
    frontCarDistance: null,
    batteryPercent: 77,
    remainingRangeKm: 428,
    energyConsumption: 13.1,
    cabinTemp: 23.5,
    cameraView: 'chase',
    timeOfDay: 'day',
    layers: {
      path: true,
      box: true,
      sensor: true,
      pointCloud: true,
    },
    laneStatusText: '车道保持',
    egoLane: 0,
    autoLaneChange: true,
    turnDistanceMeters: 300,
    decisionLogs: [
      { id: '1', time: '09:19:55', text: 'NOA 领航辅助已激活，智能变道超车就绪', type: 'success' },
      { id: '2', time: '09:19:35', text: '变道完成，恢复正常车道保持', type: 'success' },
      { id: '3', time: '09:19:31', text: '目标车辆间距充足，准备向右变道', type: 'info' },
      { id: '4', time: '09:19:21', text: '毫米波与激光雷达多传感融合状态正常', type: 'info' },
    ],
  });

  // 辅助函数：生成当前时间戳 HH:mm:ss
  const getTimeStr = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
      2,
      '0'
    )}:${String(now.getSeconds()).padStart(2, '0')}`;
  };

  // 2. 车速平滑插值动画（当用户点击 60 / 80 / 100 / 120 时，平滑过渡）
  const targetSpeedRef = useRef(cockpitState.targetSpeed);
  targetSpeedRef.current = cockpitState.targetSpeed;

  useEffect(() => {
    let animId: number;
    const smoothSpeed = () => {
      setCockpitState((prev) => {
        const diff = targetSpeedRef.current - prev.currentSpeed;
        if (Math.abs(diff) < 0.2) {
          if (prev.currentSpeed === targetSpeedRef.current) return prev;
          return { ...prev, currentSpeed: targetSpeedRef.current };
        }
        return {
          ...prev,
          currentSpeed: prev.currentSpeed + diff * 0.05,
        };
      });
      animId = requestAnimationFrame(smoothSpeed);
    };
    animId = requestAnimationFrame(smoothSpeed);
    return () => cancelAnimationFrame(animId);
  }, []);

  // 3. 模拟环境感知日志动态追加
  useEffect(() => {
    const candidateTexts = [
      '毫米波雷达持续追踪周围 4 辆动态交通目标',
      '高精地图提示前方 300 米进入平直巡航路段',
      '多线束激光雷达点云配准正常，盲区无异常障碍物',
    ];

    let count = 0;
    const interval = setInterval(() => {
      const text = candidateTexts[count % candidateTexts.length];
      count++;

      setCockpitState((prev) => ({
        ...prev,
        decisionLogs: [
          {
            id: String(Date.now()),
            time: getTimeStr(),
            text,
            type: 'info',
          },
          ...prev.decisionLogs.slice(0, 5),
        ],
      }));
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  // 4. 车辆感知数据回传联动（更新前车距离与 TTC）
  const handleVehicleDataUpdate = (vehicles: SurroundingVehicle[]) => {
    // 寻找自车前方最近的同向车辆 (z < -3.8)
    const frontCars = vehicles.filter(
      (v) => (v.id === 'car-2' || v.id === 'truck-1') && v.z < -3.8
    );
    const frontCar = frontCars.sort((a, b) => a.distance - b.distance)[0];
    if (frontCar) {
      const dist = frontCar.distance;
      const relSpeed = Math.max(1, cockpitState.currentSpeed - frontCar.speed);
      const ttcVal = (dist / (relSpeed * (1000 / 3600))).toFixed(1);

      setCockpitState((prev) => {
        if (prev.frontCarDistance === dist && prev.ttc === `${ttcVal}s`) return prev;
        return {
          ...prev,
          frontCarDistance: dist,
          ttc: Number(ttcVal) > 0 && Number(ttcVal) < 15 ? `${ttcVal}s` : '--',
        };
      });
    } else {
      setCockpitState((prev) => {
        if (prev.frontCarDistance === null && prev.ttc === '--') return prev;
        return {
          ...prev,
          frontCarDistance: null,
          ttc: '--',
        };
      });
    }
  };

  // 5. 变道控制与自动驾驶事件处理
  const handleManualLaneChange = (direction: 'left' | 'right') => {
    setCockpitState((prev) => {
      const nextLane = (
        direction === 'left' ? Math.max(0, prev.egoLane - 1) : Math.min(2, prev.egoLane + 1)
      ) as 0 | 1 | 2;
      if (nextLane === prev.egoLane) return prev;
      const dirText = direction === 'left' ? '左' : '右';
      return {
        ...prev,
        egoLane: nextLane,
        laneStatusText: `向${dirText}变道中`,
        decisionLogs: [
          {
            id: String(Date.now()),
            time: getTimeStr(),
            text: `手动变道指令：确认${dirText}侧车道安全，开启${dirText}转向灯并执行变道`,
            type: 'info',
          },
          ...prev.decisionLogs.slice(0, 5),
        ],
      };
    });
  };

  const handleAutoLaneChangeTrigger = (targetLane: 0 | 1 | 2, reasonText: string) => {
    setCockpitState((prev) => {
      const dirText = targetLane < prev.egoLane ? '左' : '右';
      return {
        ...prev,
        egoLane: targetLane,
        laneStatusText: `向${dirText}变道中`,
        decisionLogs: [
          {
            id: String(Date.now()),
            time: getTimeStr(),
            text: reasonText,
            type: 'info',
          },
          ...prev.decisionLogs.slice(0, 5),
        ],
      };
    });
  };

  const handleLaneChangeComplete = (lane: 0 | 1 | 2) => {
    const laneNames = ['左侧快车道', '中间行车道', '右侧慢车道'];
    setCockpitState((prev) => ({
      ...prev,
      egoLane: lane,
      laneStatusText: '车道保持',
      decisionLogs: [
        {
          id: String(Date.now()),
          time: getTimeStr(),
          text: `变道完成，已平稳切入${laneNames[lane]}并恢复 LCC 居中保持`,
          type: 'success',
        },
        ...prev.decisionLogs.slice(0, 5),
      ],
    }));
  };

  const handleLaneChangeBlocked = (safeLane: 0 | 1 | 2, reasonText: string) => {
    setCockpitState((prev) => ({
      ...prev,
      egoLane: safeLane,
      laneStatusText: '车道保持',
      decisionLogs: [
        {
          id: String(Date.now()),
          time: getTimeStr(),
          text: reasonText,
          type: 'warning',
        },
        ...prev.decisionLogs.slice(0, 5),
      ],
    }));
  };

  const handleToggleAutoLaneChange = () => {
    setCockpitState((prev) => {
      const nextAuto = !prev.autoLaneChange;
      return {
        ...prev,
        autoLaneChange: nextAuto,
        decisionLogs: [
          {
            id: String(Date.now()),
            time: getTimeStr(),
            text: nextAuto
              ? 'NOA 智能自主变道超车已开启'
              : 'NOA 智能自主变道已关闭，切换为手动变道模式',
            type: nextAuto ? 'success' : 'warning',
          },
          ...prev.decisionLogs.slice(0, 5),
        ],
      };
    });
  };

  // 键盘 A/D 与 左右方向键 快捷触发左/右变道
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        handleManualLaneChange('left');
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        handleManualLaneChange('right');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleCameraViewChange = (view: CameraView) => {
    setCockpitState((prev) => ({ ...prev, cameraView: view }));
  };

  const handleToggleLayer = (layer: keyof LayerVisibility) => {
    setCockpitState((prev) => ({
      ...prev,
      layers: {
        ...prev.layers,
        [layer]: !prev.layers[layer],
      },
    }));
  };

  const handleSetSpeed = (speed: number) => {
    setCockpitState((prev) => ({ ...prev, targetSpeed: speed }));
  };

  const handleGearChange = (gear: 'P' | 'R' | 'N' | 'D') => {
    setCockpitState((prev) => ({
      ...prev,
      gear,
      targetSpeed: gear === 'D' ? 120 : 0,
    }));
  };

  const handleFollowDistanceChange = (bars: number) => {
    setCockpitState((prev) => ({ ...prev, followDistanceBars: bars }));
  };

  const handleToggleAcc = () => {
    setCockpitState((prev) => ({ ...prev, accActive: !prev.accActive }));
  };

  const handleTimeOfDayChange = (time: TimeOfDay) => {
    setCockpitState((prev) => ({ ...prev, timeOfDay: time }));
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#030712] font-sans">
      {/* 3D WebGL 自动驾驶数字孪生主场景 */}
      <AutopilotScene
        currentSpeed={cockpitState.currentSpeed}
        targetSpeed={cockpitState.targetSpeed}
        cameraView={cockpitState.cameraView}
        layers={cockpitState.layers}
        timeOfDay={cockpitState.timeOfDay}
        laneStatusText={cockpitState.laneStatusText}
        egoLane={cockpitState.egoLane}
        autoLaneChange={cockpitState.autoLaneChange}
        onVehicleDataUpdate={handleVehicleDataUpdate}
        onPerfUpdate={setPerfStats}
        onAutoLaneChangeTrigger={handleAutoLaneChangeTrigger}
        onLaneChangeComplete={handleLaneChangeComplete}
        onLaneChangeBlocked={handleLaneChangeBlocked}
      />

      {/* 2D 车机座舱 HUD 系统 UI 层 */}
      <TopNavBar
        laneStatusText={cockpitState.laneStatusText}
        fps={perfStats?.fps}
        frameTime={perfStats?.frameTime}
        isPerfVisible={showPerfHUD}
        onTogglePerf={() => setShowPerfHUD((prev) => !prev)}
      />
      <DecisionLog logs={cockpitState.decisionLogs} />
      <Speedometer
        currentSpeed={cockpitState.currentSpeed}
        gear={cockpitState.gear}
        onGearChange={handleGearChange}
      />
      <RightPanel
        state={cockpitState}
        onFollowDistanceChange={handleFollowDistanceChange}
        onToggleAcc={handleToggleAcc}
      />
      <BottomControls
        cameraView={cockpitState.cameraView}
        layers={cockpitState.layers}
        targetSpeed={cockpitState.targetSpeed}
        timeOfDay={cockpitState.timeOfDay}
        egoLane={cockpitState.egoLane}
        autoLaneChange={cockpitState.autoLaneChange}
        onCameraViewChange={handleCameraViewChange}
        onToggleLayer={handleToggleLayer}
        onSetSpeed={handleSetSpeed}
        onTimeOfDayChange={handleTimeOfDayChange}
        onLaneChange={handleManualLaneChange}
        onToggleAutoLaneChange={handleToggleAutoLaneChange}
      />

      {/* 实时性能 HUD 监控浮窗 */}
      <PerformanceHUD
        stats={perfStats}
        isVisible={showPerfHUD}
        onClose={() => setShowPerfHUD(false)}
        onToggle={() => setShowPerfHUD((prev) => !prev)}
      />
    </div>
  );
}

export default App;
