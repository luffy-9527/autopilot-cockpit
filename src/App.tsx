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
    laneStatusText: '变道中',
    turnDistanceMeters: 300,
    decisionLogs: [
      { id: '1', time: '09:19:55', text: '目标车辆间距充足，准备向右变道', type: 'info' },
      { id: '2', time: '09:19:35', text: '变道完成，恢复正常车道保持', type: 'success' },
      { id: '3', time: '09:19:31', text: '目标车辆间距充足，准备向右变道', type: 'info' },
      { id: '4', time: '09:19:21', text: '变道完成，恢复正常车道保持', type: 'success' },
      { id: '5', time: '09:19:17', text: '目标车辆间距充足，准备向右变道', type: 'info' },
    ],
  });

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

  // 3. 模拟实时决策流动态追加（每隔 8 秒随机推送一条真实感知策略日志）
  useEffect(() => {
    const candidateTexts = [
      '监测到右侧车道后方有货车接近，保持安全车距',
      '目标车道间距充足，执行自主变道策略',
      '毫米波雷达确认盲区无障碍物，开启右转向信号',
      '变道完成，平稳恢复 LCC 智能车道居中保持',
      '高精地图提示前方 300 米向右驶入匝道',
    ];

    let count = 0;
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      const text = candidateTexts[count % candidateTexts.length];
      count++;

      setCockpitState((prev) => ({
        ...prev,
        decisionLogs: [
          {
            id: String(Date.now()),
            time: timeStr,
            text,
            type: text.includes('完成') ? 'success' : 'info',
          },
          ...prev.decisionLogs.slice(0, 5),
        ],
      }));
    }, 9000);

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

  // 5. 事件处理
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
        onVehicleDataUpdate={handleVehicleDataUpdate}
        onPerfUpdate={setPerfStats}
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
        onCameraViewChange={handleCameraViewChange}
        onToggleLayer={handleToggleLayer}
        onSetSpeed={handleSetSpeed}
        onTimeOfDayChange={handleTimeOfDayChange}
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
