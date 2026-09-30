import * as THREE from 'three';

/**
 * 将 3D 世界坐标转换为屏幕像素坐标 (2D)
 */
export function toScreenPosition(
  obj: THREE.Vector3,
  camera: THREE.Camera,
  rendererWidth: number,
  rendererHeight: number
): { x: number; y: number; visible: boolean } {
  const vector = obj.clone();
  
  // 投影到归一化设备坐标 (NDC)
  vector.project(camera);

  // 如果在相机后方，不可见
  const isBehindCamera = vector.z > 1;

  // 转化为屏幕像素坐标
  const halfWidth = rendererWidth / 2;
  const halfHeight = rendererHeight / 2;

  const x = Math.round(vector.x * halfWidth + halfWidth);
  const y = Math.round(-vector.y * halfHeight + halfHeight);

  // 检查是否在可视屏幕范围内
  const visible =
    !isBehindCamera &&
    x >= -100 &&
    x <= rendererWidth + 100 &&
    y >= -50 &&
    y <= rendererHeight + 50;

  return { x, y, visible };
}

/**
 * 格式化两位数
 */
export function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}
