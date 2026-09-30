export type CameraView = 'chase' | 'top' | 'cockpit' | 'free';

export type TimeOfDay = 'day' | 'night';

export interface PerfStats {
  fps: number;
  frameTime: number; // ms
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  memoryMB?: number;
}

export interface LayerVisibility {
  path: boolean;        // 规划路径
  box: boolean;         // 3D目标检测框
  sensor: boolean;      // 传感器雷达波束
  pointCloud: boolean;  // 激光雷达点云
}

export interface SurroundingVehicle {
  id: string;
  type: 'car' | 'truck' | 'suv';
  label: '同向车' | '对向车';
  distance: number;     // 距离自车 (米)
  speed: number;        // 速度 (km/h)
  lane: number;         // 车道索引 (-2: 对向快, -1: 对向慢, 0: 本车道, 1: 右侧慢车道)
  x: number;            // 3D 相对横向位置
  z: number;            // 3D 相对纵向位置
  screenPos?: { x: number; y: number; visible: boolean }; // 投影到屏幕 2D 坐标
}

export interface DecisionLogItem {
  id: string;
  time: string;
  text: string;
  type: 'info' | 'success' | 'warn';
}

export interface CockpitState {
  targetSpeed: number;        // 设定车速 (km/h)
  currentSpeed: number;       // 实际车速 (km/h)
  gear: 'P' | 'R' | 'N' | 'D';
  accActive: boolean;
  followDistanceBars: number; // 跟车时距档位 (1-4)
  ttc: string;                // 碰撞前时间 TTC (s)
  frontCarDistance: number | null; // 前车车距
  batteryPercent: number;     // 电池电量 77%
  remainingRangeKm: number;   // 续航里程 428km
  energyConsumption: number;  // 13.1 kWh/100km
  cabinTemp: number;          // 23.5 °C
  cameraView: CameraView;
  timeOfDay: TimeOfDay;
  layers: LayerVisibility;
  laneStatusText: string;     // 变道中 LANE CHANGE
  decisionLogs: DecisionLogItem[];
  turnDistanceMeters: number; // 300米
}
