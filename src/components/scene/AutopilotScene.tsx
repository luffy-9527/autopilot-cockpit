import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CameraView, LayerVisibility, SurroundingVehicle, TimeOfDay, PerfStats } from '../../types/cockpit';
import { toScreenPosition } from '../../utils/math';

interface AutopilotSceneProps {
  currentSpeed: number;
  targetSpeed: number;
  cameraView: CameraView;
  layers: LayerVisibility;
  timeOfDay?: TimeOfDay;
  onVehicleDataUpdate?: (vehicles: SurroundingVehicle[]) => void;
  onPerfUpdate?: (stats: PerfStats) => void;
}

export const AutopilotScene: React.FC<AutopilotSceneProps> = ({
  currentSpeed,
  cameraView,
  layers,
  timeOfDay = 'day',
  onVehicleDataUpdate,
  onPerfUpdate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [projectedVehicles, setProjectedVehicles] = useState<SurroundingVehicle[]>([]);

  const onPerfUpdateRef = useRef(onPerfUpdate);
  onPerfUpdateRef.current = onPerfUpdate;

  const speedRef = useRef(currentSpeed);
  speedRef.current = currentSpeed;

  const viewRef = useRef(cameraView);
  viewRef.current = cameraView;

  const layersRef = useRef(layers);
  layersRef.current = layers;

  const timeOfDayRef = useRef<TimeOfDay>(timeOfDay);
  timeOfDayRef.current = timeOfDay;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. 初始化场景、相机与高性能渲染器
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const isInitialDay = timeOfDay === 'day';
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isInitialDay ? 0x60a5fa : 0x02040b);
    scene.fog = new THREE.FogExp2(isInitialDay ? 0x93c5fd : 0x02040b, isInitialDay ? 0.0035 : 0.010);

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 900);
    // 跟车基准视角
    camera.position.set(-0.2, 4.8, 8.8);
    camera.lookAt(0.2, 1.2, -22);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 2. 环境灯光系统
    const ambientLight = new THREE.AmbientLight(isInitialDay ? 0xffffff : 0x283b58, isInitialDay ? 3.2 : 2.2);
    scene.add(ambientLight);

    const moonLight = new THREE.DirectionalLight(isInitialDay ? 0xfffbeb : 0x60a5fa, isInitialDay ? 3.6 : 1.6);
    moonLight.position.set(isInitialDay ? 45 : 30, isInitialDay ? 85 : 60, isInitialDay ? 20 : 30);
    scene.add(moonLight);

    const blueRimLight = new THREE.DirectionalLight(isInitialDay ? 0xbae6fd : 0x38bdf8, isInitialDay ? 1.8 : 1.4);
    blueRimLight.position.set(-25, 30, -20);
    scene.add(blueRimLight);

    // 半球环境光 (赋予车身与金属曲面丰富的上下天光/地光环境漫反射，彻底杜绝日间车漆背光死黑)
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x334155, isInitialDay ? 2.0 : 0.4);
    scene.add(hemiLight);

    // 3. 辅助贴图生成器
    // 3.1 车辆底部柔和接触阴影 (Contact Shadow)
    function createContactShadowTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createRadialGradient(64, 64, 15, 64, 64, 60);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
      grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.5)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(canvas);
    }
    const shadowTexture = createContactShadowTexture();
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });

    // 3.2 真实车机级双大灯地面铺光贴图 (向外微锥形扩散展开，平整清透，绝无圆框与实心钻头感)
    function createHeadlightGroundTexture() {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 1024;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, 512, 1024);

      // 绘制单道向外微锥形扩散的大灯前照光轨 (双层平滑羽化，向外微张，纯平直梯形无圆弧)
      const drawConicalBeam = (
        originX: number,
        targetX: number,
        startCoreW: number,
        endCoreW: number,
        startOuterW: number,
        endOuterW: number
      ) => {
        // 1. 外层柔和羽化光晕层 (向外微扩散梯形，平滑消融在路面)
        const outerGrad = ctx.createLinearGradient(0, 1024, 0, 0);
        outerGrad.addColorStop(0, 'rgba(240, 249, 255, 0.6)');
        outerGrad.addColorStop(0.12, 'rgba(224, 242, 254, 0.45)');
        outerGrad.addColorStop(0.45, 'rgba(186, 230, 253, 0.22)');
        outerGrad.addColorStop(0.8, 'rgba(147, 197, 253, 0.06)');
        outerGrad.addColorStop(1, 'rgba(147, 197, 253, 0)');

        ctx.fillStyle = outerGrad;
        ctx.beginPath();
        ctx.moveTo(originX - startOuterW / 2, 1024);
        ctx.lineTo(targetX - endOuterW / 2, 0);
        ctx.lineTo(targetX + endOuterW / 2, 0);
        ctx.lineTo(originX + startOuterW / 2, 1024);
        ctx.closePath();
        ctx.fill();

        // 2. 核心聚光高亮主光束 (向外微展的直射聚光芯，清晰照亮路面标线)
        const coreGrad = ctx.createLinearGradient(0, 1024, 0, 0);
        coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        coreGrad.addColorStop(0.1, 'rgba(255, 255, 255, 0.78)');
        coreGrad.addColorStop(0.35, 'rgba(240, 249, 255, 0.52)');
        coreGrad.addColorStop(0.7, 'rgba(224, 242, 254, 0.18)');
        coreGrad.addColorStop(1, 'rgba(224, 242, 254, 0)');

        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.moveTo(originX - startCoreW / 2, 1024);
        ctx.lineTo(targetX - endCoreW / 2, 0);
        ctx.lineTo(targetX + endCoreW / 2, 0);
        ctx.lineTo(originX + startCoreW / 2, 1024);
        ctx.closePath();
        ctx.fill();
      };

      // 左大灯向外微锥形扩散光束 (车头 x=180 出发，向左前方微展开至 x=125)
      // 宽度从 32px 锥形展开至 96px (外层从 64px 展开至 160px)
      drawConicalBeam(180, 125, 32, 96, 64, 160);

      // 右大灯向外微锥形扩散光束 (车头 x=332 出发，向右前方微展开至 x=387)
      // 宽度从 32px 锥形展开至 96px (外层从 64px 展开至 160px)
      drawConicalBeam(332, 387, 32, 96, 64, 160);

      const tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      return tex;
    }
    const headlightGroundTex = createHeadlightGroundTexture();
    const headlightGroundMat = new THREE.MeshBasicMaterial({
      map: headlightGroundTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    // 3.3 汽车灯具透镜光晕贴图 (白光大灯光晕与红光尾灯光晕)
    function createLightFlareTexture(colorType: 'white' | 'red') {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext('2d')!;
      const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);

      if (colorType === 'white') {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        grad.addColorStop(0.25, 'rgba(240, 249, 255, 0.7)');
        grad.addColorStop(0.55, 'rgba(186, 230, 253, 0.3)');
        grad.addColorStop(1, 'rgba(186, 230, 253, 0)');
      } else {
        grad.addColorStop(0, 'rgba(255, 80, 80, 0.95)');
        grad.addColorStop(0.25, 'rgba(239, 68, 68, 0.75)');
        grad.addColorStop(0.55, 'rgba(185, 28, 28, 0.35)');
        grad.addColorStop(1, 'rgba(185, 28, 28, 0)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(64, 64, 60, 0, Math.PI * 2);
      ctx.fill();

      const tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      return tex;
    }
    const whiteFlareMat = new THREE.MeshBasicMaterial({
      map: createLightFlareTexture('white'),
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const redFlareMat = new THREE.MeshBasicMaterial({
      map: createLightFlareTexture('red'),
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    // 3.4 斜射空气柔光薄片贴图 (杜绝实体三角锥与钻头感，轻柔夜雾光束)
    function createSlantedBeamTexture() {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 512;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, 128, 512);

      const grad = ctx.createLinearGradient(0, 512, 0, 0);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
      grad.addColorStop(0.2, 'rgba(224, 242, 254, 0.35)');
      grad.addColorStop(0.65, 'rgba(186, 230, 253, 0.12)');
      grad.addColorStop(1, 'rgba(186, 230, 253, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(48, 512);
      ctx.lineTo(16, 0);
      ctx.lineTo(112, 0);
      ctx.lineTo(80, 512);
      ctx.closePath();
      ctx.fill();

      const tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      return tex;
    }
    const slantedBeamTex = createSlantedBeamTexture();
    const slantedBeamMat = new THREE.MeshBasicMaterial({
      map: slantedBeamTex,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    // 3.2 动态夜景/日景楼宇建筑生成（Canvas 科技发光窗格贴图 / 现代商务玻璃幕墙）
    function createBuildingTexture(isDay: boolean) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      if (isDay) {
        // 白天写字楼现代浅蓝灰玻璃幕墙风格
        ctx.fillStyle = '#475569';
        ctx.fillRect(0, 0, 256, 512);

        const cols = 8;
        const rows = 28;
        const padX = 5;
        const padY = 4;
        const w = (256 - padX * (cols + 1)) / cols;
        const h = (512 - padY * (rows + 1)) / rows;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const rand = Math.random();
            if (rand > 0.65) {
              ctx.fillStyle = '#cbd5e1';
            } else if (rand > 0.35) {
              ctx.fillStyle = '#94a3b8';
            } else {
              ctx.fillStyle = '#334155';
            }
            const x = padX + c * (w + padX);
            const y = padY + r * (h + padY);
            ctx.fillRect(x, y, w, h);
          }
        }
      } else {
        // 夜景科技霓虹窗格
        ctx.fillStyle = '#070a14';
        ctx.fillRect(0, 0, 256, 512);

        const cols = 8;
        const rows = 28;
        const padX = 6;
        const padY = 4;
        const w = (256 - padX * (cols + 1)) / cols;
        const h = (512 - padY * (rows + 1)) / rows;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const rand = Math.random();
            if (rand > 0.42) {
              if (rand > 0.86) {
                ctx.fillStyle = '#fffbeb';
              } else if (rand > 0.62) {
                ctx.fillStyle = '#f59e0b';
              } else {
                ctx.fillStyle = '#38bdf8';
              }
            } else {
              ctx.fillStyle = '#0d1322';
            }
            const x = padX + c * (w + padX);
            const y = padY + r * (h + padY);
            ctx.fillRect(x, y, w, h);
          }
        }
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      return texture;
    }

    const buildingNightTex = createBuildingTexture(false);
    const buildingDayTex = createBuildingTexture(true);
    const buildingMat = new THREE.MeshStandardMaterial({
      map: buildingNightTex,
      roughness: 0.25,
      metalness: 0.35,
      emissive: 0x1e293b,
      emissiveIntensity: 0.5,
    });

    const buildingsGroup = new THREE.Group();
    const buildingGeom = new THREE.BoxGeometry(1, 1, 1);

    for (let i = 0; i < 48; i++) {
      const isLeft = i % 2 === 0;
      const zPos = -220 + i * 10 + Math.random() * 6;
      const xDistance = isLeft ? -(26 + Math.random() * 20) : 26 + Math.random() * 20;
      const bHeight = 30 + Math.random() * 55;
      const bWidth = 12 + Math.random() * 10;
      const bDepth = 14 + Math.random() * 12;

      const building = new THREE.Mesh(buildingGeom, buildingMat);
      building.scale.set(bWidth, bHeight, bDepth);
      building.position.set(xDistance, bHeight / 2 - 0.5, zPos);
      buildingsGroup.add(building);
    }
    scene.add(buildingsGroup);

    // 4. 道路系统与高精度标线
    const roadGroup = new THREE.Group();
    const ROAD_WIDTH = 32;
    const ROAD_LENGTH = 450;

    // 沥青路面
    const roadGeom = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH, 1, 1);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x080c16,
      roughness: 0.85,
      metalness: 0.15,
    });
    const roadMesh = new THREE.Mesh(roadGeom, roadMat);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.set(0, 0, -ROAD_LENGTH / 4);
    roadGroup.add(roadMesh);

    // 两侧防护栏
    const guardrailMat = new THREE.MeshStandardMaterial({
      color: 0x334455,
      metalness: 0.85,
      roughness: 0.25,
    });
    const guardrailGeom = new THREE.BoxGeometry(0.35, 0.85, ROAD_LENGTH);
    const leftGuard = new THREE.Mesh(guardrailGeom, guardrailMat);
    leftGuard.position.set(-ROAD_WIDTH / 2, 0.42, -ROAD_LENGTH / 4);
    roadGroup.add(leftGuard);

    const rightGuard = new THREE.Mesh(guardrailGeom, guardrailMat);
    rightGuard.position.set(ROAD_WIDTH / 2, 0.42, -ROAD_LENGTH / 4);
    roadGroup.add(rightGuard);

    // 护栏夜间反光立柱片 (Delineators)
    const delineatorGroup = new THREE.Group();
    const delinGeom = new THREE.BoxGeometry(0.08, 0.18, 0.05);
    const delinMatL = new THREE.MeshBasicMaterial({ color: 0xef4444 }); // 左侧红反光
    const delinMatR = new THREE.MeshBasicMaterial({ color: 0xffffff }); // 右侧白反光

    for (let d = 0; d < 35; d++) {
      const zP = -d * 12;
      const dl = new THREE.Mesh(delinGeom, delinMatL);
      dl.position.set(-ROAD_WIDTH / 2 + 0.25, 0.65, zP);
      const dr = new THREE.Mesh(delinGeom, delinMatR);
      dr.position.set(ROAD_WIDTH / 2 - 0.25, 0.65, zP);
      delineatorGroup.add(dl, dr);
    }
    roadGroup.add(delineatorGroup);

    // 中间双黄实线
    const yellowLineMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const doubleYellow1 = new THREE.Mesh(new THREE.PlaneGeometry(0.18, ROAD_LENGTH), yellowLineMat);
    doubleYellow1.rotation.x = -Math.PI / 2;
    doubleYellow1.position.set(-1.85, 0.02, -ROAD_LENGTH / 4);
    roadGroup.add(doubleYellow1);

    const doubleYellow2 = new THREE.Mesh(new THREE.PlaneGeometry(0.18, ROAD_LENGTH), yellowLineMat);
    doubleYellow2.rotation.x = -Math.PI / 2;
    doubleYellow2.position.set(-1.55, 0.02, -ROAD_LENGTH / 4);
    roadGroup.add(doubleYellow2);

    // 动态白色虚线分道线
    const whiteLineMat = new THREE.MeshBasicMaterial({ color: 0xdbeafe });
    const dashedLinesGroup = new THREE.Group();
    const dashLength = 4.5;
    const dashGap = 6.5;
    const totalDashes = Math.floor(ROAD_LENGTH / (dashLength + dashGap));

    const laneDividers = [-9.8, -5.8, 2.6, 6.8, 11.0];
    laneDividers.forEach((xLane) => {
      for (let d = 0; d < totalDashes; d++) {
        const dashGeom = new THREE.PlaneGeometry(0.16, dashLength);
        const dash = new THREE.Mesh(dashGeom, whiteLineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(xLane, 0.02, -d * (dashLength + dashGap));
        dashedLinesGroup.add(dash);
      }
    });
    roadGroup.add(dashedLinesGroup);

    // 地面喷漆标线
    function createGroundMarkingTexture(type: 'speed80' | 'turnRight' | 'straight') {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, 128, 256);
      ctx.strokeStyle = '#e2e8f0';
      ctx.fillStyle = '#e2e8f0';
      ctx.lineWidth = 11;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (type === 'speed80') {
        ctx.font = 'bold 85px "Arial Black", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('80', 64, 128);
      } else if (type === 'turnRight') {
        ctx.beginPath();
        ctx.moveTo(64, 215);
        ctx.lineTo(64, 115);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(64, 115);
        ctx.quadraticCurveTo(64, 75, 95, 75);
        ctx.lineTo(105, 75);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(105, 55);
        ctx.lineTo(125, 75);
        ctx.lineTo(105, 95);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(64, 215);
        ctx.lineTo(64, 65);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(40, 80);
        ctx.lineTo(64, 45);
        ctx.lineTo(88, 80);
        ctx.closePath();
        ctx.fill();
      }

      return new THREE.CanvasTexture(c);
    }

    const markingsGroup = new THREE.Group();
    const speed80Mat = new THREE.MeshBasicMaterial({
      map: createGroundMarkingTexture('speed80'),
      transparent: true,
      opacity: 0.85,
    });
    const turnRightMat = new THREE.MeshBasicMaterial({
      map: createGroundMarkingTexture('turnRight'),
      transparent: true,
      opacity: 0.85,
    });
    const straightMat = new THREE.MeshBasicMaterial({
      map: createGroundMarkingTexture('straight'),
      transparent: true,
      opacity: 0.85,
    });

    const markingPositions = [
      { mat: speed80Mat, x: 0.5, z: -18, scaleX: 3.2, scaleY: 6.2 },
      { mat: turnRightMat, x: 4.8, z: -35, scaleX: 2.5, scaleY: 5.5 },
      { mat: straightMat, x: 0.5, z: -65, scaleX: 2.2, scaleY: 5 },
      { mat: speed80Mat, x: 0.5, z: -110, scaleX: 3.2, scaleY: 6.2 },
      { mat: turnRightMat, x: 4.8, z: -125, scaleX: 2.5, scaleY: 5.5 },
    ];

    markingPositions.forEach((item) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(item.scaleX, item.scaleY), item.mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(item.x, 0.03, item.z);
      markingsGroup.add(mesh);
    });
    roadGroup.add(markingsGroup);

    // ==========================================================
    // 5. 真实路灯与高架指示牌系统 (Streetlights & Gantry Signs)
    // ==========================================================

    // 5.1 道路路灯系统 (中央分隔带双挑翼展式高速公路一体化 LED 路灯)
    const streetLightGroup = new THREE.Group();

    // 镀锌钢主杆与挑臂材质（银灰金属色，日照下反光自然，告别死黑质感）
    const streetLightMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.72,
      roughness: 0.28,
    });

    // 铝合金流线型灯具外壳材质
    const luminaireHousingMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.65,
      roughness: 0.32,
    });

    // 中央水泥防撞基座材质
    const concretePierMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.88,
      metalness: 0.08,
    });

    // 基座反光警示黄条
    const baseReflectorMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
    });

    // 暖白发光灯板材质（昼夜联动）
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfff7ed });

    // 地面路灯柔和照亮光斑贴图
    function createGroundLightPoolTexture() {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext('2d')!;
      const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
      g.addColorStop(0, 'rgba(255, 247, 237, 0.35)');
      g.addColorStop(0.5, 'rgba(255, 247, 237, 0.15)');
      g.addColorStop(1, 'rgba(255, 247, 237, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    }
    const groundLightPoolMat = new THREE.MeshBasicMaterial({
      map: createGroundLightPoolTexture(),
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // 共享几何体以保证极致性能与 60FPS 帧率 (Vercel React Best Practices)
    // 1. 混凝土防撞底墩与反光黄标
    const pierGeom = new THREE.BoxGeometry(0.42, 0.52, 1.3);
    const pierStripeGeom = new THREE.PlaneGeometry(0.422, 0.14);

    // 2. 钢结构底座法兰盘
    const flangeGeom = new THREE.CylinderGeometry(0.2, 0.22, 0.08, 16);

    // 3. 变径主立柱（上细下粗渐变，高度 8.2m）
    const mastGeom = new THREE.CylinderGeometry(0.085, 0.14, 8.2, 16);
    const mastCapGeom = new THREE.CylinderGeometry(0.095, 0.085, 0.22, 16);

    // 4. 一体化贯通式双挑翼展主挑臂（左右完全连为一体，无缝连续曲面管道贯通两侧）
    const mainArmCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.3, 8.95, 0),
      new THREE.Vector3(-1.65, 9.65, 0),
      new THREE.Vector3(0, 8.55, 0),
      new THREE.Vector3(1.65, 9.65, 0),
      new THREE.Vector3(3.3, 8.95, 0),
    ]);
    const mainArmGeom = new THREE.TubeGeometry(mainArmCurve, 40, 0.045, 12, false);

    // 5. 下部一体贯通式圆弧支撑架（从左臂 x=-2.3 连续向下穿过立柱 y=7.78，平滑延伸连入右臂 x=+2.3，左右整体相连，彻底告别分裂断开）
    const supportArchCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.3, 9.36, 0),
      new THREE.Vector3(-1.2, 8.35, 0),
      new THREE.Vector3(0, 7.78, 0),
      new THREE.Vector3(1.2, 8.35, 0),
      new THREE.Vector3(2.3, 9.36, 0),
    ]);
    const supportArchGeom = new THREE.TubeGeometry(supportArchCurve, 32, 0.032, 10, false);

    // 6. 中央一体化加固抱箍锁紧套环与双弦桁架垂直加劲拉杆
    const topCollarGeom = new THREE.CylinderGeometry(0.12, 0.11, 0.28, 16);
    const midCollarGeom = new THREE.CylinderGeometry(0.125, 0.115, 0.22, 16);
    const webPinGeom = new THREE.CylinderGeometry(0.02, 0.02, 1.15, 8);

    // 7. 流线型超薄微弧 LED 节能路灯灯头
    const luminaireBodyGeom = new THREE.BoxGeometry(0.28, 0.085, 0.88);
    const luminaireFinGeom = new THREE.BoxGeometry(0.05, 0.04, 0.65);
    const luminairePlateGeom = new THREE.PlaneGeometry(0.22, 0.76);

    // 8. 路面光斑
    const poolGeom = new THREE.PlaneGeometry(7.2, 12);

    const poleCount = 8;
    const poleSpacing = 36;
    const dynamicPoles: THREE.Group[] = [];

    // 高速公路中央隔离带标准基准线 X = -1.7（正中双黄线中央，彻底杜绝骑线或侵入对向快车道）
    const MEDIAN_CENTER_X = -1.7;

    for (let p = 0; p < poleCount; p++) {
      const poleItem = new THREE.Group();
      const zPos = -p * poleSpacing;

      // A. 中央防撞水泥基座与警示反光带
      const pier = new THREE.Mesh(pierGeom, concretePierMat);
      pier.position.set(0, 0.26, 0);

      const stripeFront = new THREE.Mesh(pierStripeGeom, baseReflectorMat);
      stripeFront.position.set(0, 0.26, 0.651);

      const stripeBack = new THREE.Mesh(pierStripeGeom, baseReflectorMat);
      stripeBack.rotation.y = Math.PI;
      stripeBack.position.set(0, 0.26, -0.651);
      poleItem.add(pier, stripeFront, stripeBack);

      // B. 钢制法兰盘底座
      const flange = new THREE.Mesh(flangeGeom, streetLightMat);
      flange.position.set(0, 0.54, 0);
      poleItem.add(flange);

      // C. 渐细主杆 (y: 0.54 -> 8.74)
      const mast = new THREE.Mesh(mastGeom, streetLightMat);
      mast.position.set(0, 4.64, 0);
      const mastCap = new THREE.Mesh(mastCapGeom, streetLightMat);
      mastCap.position.set(0, 8.75, 0);
      poleItem.add(mast, mastCap);

      // D. 一体贯通式双挑主挑臂（左右一体，无缝平滑）
      const mainArm = new THREE.Mesh(mainArmGeom, streetLightMat);
      poleItem.add(mainArm);

      // E. 下部一体贯通式圆弧支撑架（左右完全相连，彻底告别分裂断开）
      const supportArch = new THREE.Mesh(supportArchGeom, streetLightMat);
      poleItem.add(supportArch);

      // F. 中央锁紧抱箍套环与垂直加劲拉杆
      const topCollar = new THREE.Mesh(topCollarGeom, streetLightMat);
      topCollar.position.set(0, 8.55, 0);

      const midCollar = new THREE.Mesh(midCollarGeom, streetLightMat);
      midCollar.position.set(0, 7.78, 0);

      const webPinR = new THREE.Mesh(webPinGeom, streetLightMat);
      webPinR.position.set(1.18, 8.9, 0);

      const webPinL = new THREE.Mesh(webPinGeom, streetLightMat);
      webPinL.position.set(-1.18, 8.9, 0);

      poleItem.add(topCollar, midCollar, webPinR, webPinL);

      // F. 右侧（我方同向车道）LED 灯头
      const headR = new THREE.Group();
      headR.position.set(3.3, 8.92, 0);
      const bodyR = new THREE.Mesh(luminaireBodyGeom, luminaireHousingMat);
      const finR = new THREE.Mesh(luminaireFinGeom, luminaireHousingMat);
      finR.position.y = 0.055;
      const bulbPlateR = new THREE.Mesh(luminairePlateGeom, lampGlowMat);
      bulbPlateR.rotation.x = Math.PI / 2;
      bulbPlateR.position.y = -0.044;
      headR.add(bodyR, finR, bulbPlateR);

      // G. 左侧（对向来车车道）LED 灯头
      const headL = new THREE.Group();
      headL.position.set(-3.3, 8.92, 0);
      const bodyL = new THREE.Mesh(luminaireBodyGeom, luminaireHousingMat);
      const finL = new THREE.Mesh(luminaireFinGeom, luminaireHousingMat);
      finL.position.y = 0.055;
      const bulbPlateL = new THREE.Mesh(luminairePlateGeom, lampGlowMat);
      bulbPlateL.rotation.x = Math.PI / 2;
      bulbPlateL.position.y = -0.044;
      headL.add(bodyL, finL, bulbPlateL);

      poleItem.add(headR, headL);

      // H. 双向车道路面真实照射光斑 (向同向与对向分别柔和投射)
      const poolR = new THREE.Mesh(poolGeom, groundLightPoolMat);
      poolR.rotation.x = -Math.PI / 2;
      poolR.position.set(3.3, 0.032, 0);

      const poolL = new THREE.Mesh(poolGeom, groundLightPoolMat);
      poolL.rotation.x = -Math.PI / 2;
      poolL.position.set(-3.3, 0.032, 0);
      poleItem.add(poolR, poolL);

      // 整体置于中央隔离带
      poleItem.position.set(MEDIAN_CENTER_X, 0, zPos);
      streetLightGroup.add(poleItem);
      dynamicPoles.push(poleItem);
    }
    roadGroup.add(streetLightGroup);

    // 5.2 高架龙门架与自发光绿底高速指示牌 (Gantry Signboards)
    const gantryGroup = new THREE.Group();
    const gantryPoleMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.7,
      roughness: 0.4,
    });
    const gantryPoleGeom = new THREE.CylinderGeometry(0.22, 0.22, 7.8);
    const leftPole = new THREE.Mesh(gantryPoleGeom, gantryPoleMat);
    leftPole.position.set(-ROAD_WIDTH / 2 + 1, 3.9, -80);
    const rightPole = new THREE.Mesh(gantryPoleGeom, gantryPoleMat);
    rightPole.position.set(ROAD_WIDTH / 2 - 1, 3.9, -80);

    const crossBeamGeom = new THREE.BoxGeometry(ROAD_WIDTH - 2, 0.45, 0.45);
    const crossBeam = new THREE.Mesh(crossBeamGeom, gantryPoleMat);
    crossBeam.position.set(0, 7.4, -80);

    // 动态绘制高速路牌（华南快速干线 ↗ 右转驶入匝道）
    function createGantrySignTexture() {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 192;
      const ctx = c.getContext('2d')!;

      // 经典高速绿底
      ctx.fillStyle = '#065f46';
      ctx.fillRect(0, 0, 512, 192);

      // 外圈白色内边框
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.strokeRect(12, 12, 488, 168);

      // 中英文指示
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('华南快速干线', 35, 75);

      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = '#a7f3d0';
      ctx.fillText('SOUTH CHINA EXPRESSWAY', 35, 115);

      // 右侧分流与匝道箭头指示
      ctx.fillStyle = '#facc15'; // 警示黄
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('↗ 300m 驶入匝道', 235, 160);

      // 右侧车道限速 80 标志
      ctx.beginPath();
      ctx.arc(435, 75, 40, 0, Math.PI * 2);
      ctx.fillStyle = '#dc2626'; // 红圈
      ctx.fill();
      ctx.beginPath();
      ctx.arc(435, 75, 32, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 32px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('80', 435, 75);

      return new THREE.CanvasTexture(c);
    }

    const gantrySignTex = createGantrySignTexture();
    const gantrySignMat = new THREE.MeshBasicMaterial({ map: gantrySignTex });
    const signBoardMesh = new THREE.Mesh(new THREE.BoxGeometry(8.2, 3.1, 0.15), gantrySignMat);
    signBoardMesh.position.set(4.5, 7.1, -79.8);

    gantryGroup.add(leftPole, rightPole, crossBeam, signBoardMesh);
    roadGroup.add(gantryGroup);

    // 5.3 路侧发光指路牌 (小型路肩灯牌)
    const roadSignGroup = new THREE.Group();
    function createSideRoadSignTexture() {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 128;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#0284c7'; // 快速路蓝底
      ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, 244, 116);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('广州 / 深圳 ↗', 128, 55);
      ctx.font = '16px monospace';
      ctx.fillText('RAMP 500m', 128, 92);
      return new THREE.CanvasTexture(c);
    }
    const sideSignMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.2, 0.1),
      new THREE.MeshBasicMaterial({ map: createSideRoadSignTexture() })
    );
    sideSignMesh.position.set(13.8, 3.2, -45);
    const sideSignPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 3.2),
      streetLightMat
    );
    sideSignPole.position.set(13.8, 1.6, -45);
    roadSignGroup.add(sideSignMesh, sideSignPole);
    roadGroup.add(roadSignGroup);

    scene.add(roadGroup);

    // ==========================================================
    // 6. 车辆模型深度优化 (自车溜背跑车、重型货车、周围轿车)
    // ==========================================================

    const egoWheels: THREE.Group[] = [];
    const trafficWheels: THREE.Group[] = [];

    // 通用轮毂生成器（宝马 M 826M 双色双辐切削锻造轮毂 + 运动圆角宽胎 + 打孔刹车盘 + M 运动蓝色卡钳）
    function createWheel(radius = 0.36, width = 0.26, isRightSide = false) {
      const wheelGroup = new THREE.Group();
      const faceDir = isRightSide ? 1 : -1;

      // 1. 高性能深碳黑哑光橡胶宽胎（带圆润胎肩）
      const tireMat = new THREE.MeshStandardMaterial({
        color: 0x141416,
        roughness: 0.88,
        metalness: 0.05,
      });
      const tireGeom = new THREE.CylinderGeometry(radius, radius, width * 0.86, 32);
      const tire = new THREE.Mesh(tireGeom, tireMat);
      tire.rotation.z = Math.PI / 2;
      wheelGroup.add(tire);

      // 外侧与内侧圆润胎肩 (Rounded Tire Shoulders - 消除生硬圆柱直角)
      const shoulderTorusGeom = new THREE.TorusGeometry(radius - 0.024, 0.024, 10, 32);
      const shoulderOuter = new THREE.Mesh(shoulderTorusGeom, tireMat);
      shoulderOuter.rotation.y = Math.PI / 2;
      shoulderOuter.position.x = faceDir * (width * 0.42);
      const shoulderInner = new THREE.Mesh(shoulderTorusGeom, tireMat);
      shoulderInner.rotation.y = Math.PI / 2;
      shoulderInner.position.x = -faceDir * (width * 0.42);
      wheelGroup.add(shoulderOuter, shoulderInner);

      // 2. 轮毂深凹铝合金外圈与高光轮唇
      const rimSilverMat = new THREE.MeshStandardMaterial({
        color: 0xffffff, // 纯净高光亮银切削铝合金
        metalness: 0.85,
        roughness: 0.15,
        emissive: 0x94a3b8,
        emissiveIntensity: 0.16, // 微微提亮，确保即使在深色轮拱内也保持清晰高光
      });
      const rimDarkMat = new THREE.MeshStandardMaterial({
        color: 0x090d16, // 深黑色内壁金属质感
        metalness: 0.8,
        roughness: 0.35,
      });

      const rimLipGeom = new THREE.CylinderGeometry(radius * 0.80, radius * 0.74, 0.045, 32);
      const rimLip = new THREE.Mesh(rimLipGeom, rimSilverMat);
      rimLip.rotation.z = Math.PI / 2;
      rimLip.position.x = faceDir * (width * 0.47);
      wheelGroup.add(rimLip);

      // 轮辋内桶 (Inner Rim Barrel)
      const barrelGeom = new THREE.CylinderGeometry(radius * 0.74, radius * 0.74, width * 0.75, 24);
      const barrel = new THREE.Mesh(barrelGeom, rimDarkMat);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.x = faceDir * (width * 0.05);
      wheelGroup.add(barrel);

      // 3. 通风打孔复合刹车盘 (深嵌在轮毂内部)
      const rotorGeom = new THREE.CylinderGeometry(radius * 0.70, radius * 0.70, 0.025, 24);
      const rotorMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.95,
        roughness: 0.22,
      });
      const rotor = new THREE.Mesh(rotorGeom, rotorMat);
      rotor.rotation.z = Math.PI / 2;
      rotor.position.x = faceDir * (width * 0.16);
      wheelGroup.add(rotor);

      // 刹车盘中心黑化轴承盖座
      const rotorHatGeom = new THREE.CylinderGeometry(radius * 0.26, radius * 0.26, 0.03, 16);
      const rotorHat = new THREE.Mesh(rotorHatGeom, rimDarkMat);
      rotorHat.rotation.z = Math.PI / 2;
      rotorHat.position.x = faceDir * (width * 0.18);
      wheelGroup.add(rotorHat);

      // 4. 宝马 M 标志性运动蓝色多活塞卡钳 (BMW M Performance Blue Caliper)
      const caliperGeom = new THREE.BoxGeometry(0.065, radius * 0.42, 0.18);
      const caliperMat = new THREE.MeshStandardMaterial({
        color: 0x1d4ed8, // 宝马 M 经典运动蓝
        roughness: 0.20,
        metalness: 0.70,
        emissive: 0x2563eb,
        emissiveIntensity: 0.45, // 自发光高光，确保在轮辐间隙清晰明艳可见！
      });
      const caliper = new THREE.Mesh(caliperGeom, caliperMat);
      caliper.position.set(
        faceDir * (width * 0.18),
        radius * 0.40,
        -radius * 0.20
      );
      caliper.rotation.z = faceDir * 0.35;
      wheelGroup.add(caliper);

      // 卡钳上的 M 三色标细节
      const mStripeGeom = new THREE.BoxGeometry(0.068, 0.028, 0.06);
      const mStripe = new THREE.Mesh(mStripeGeom, new THREE.MeshBasicMaterial({ color: 0x00a3e0 }));
      mStripe.position.copy(caliper.position);
      mStripe.rotation.z = caliper.rotation.z;
      wheelGroup.add(mStripe);

      // 5. 宝马 M 826M 样式双五辐 Y 型切削轮辐组 (10 根切削双肋，构成 5 组锐利 Y 型星轮)
      const spokeGroup = new THREE.Group();
      spokeGroup.position.x = faceDir * (width * 0.48);
      const spokeGeom = new THREE.BoxGeometry(0.026, radius * 0.68, 0.035);

      for (let s = 0; s < 5; s++) {
        const baseAngle = (s * (Math.PI * 2)) / 5;
        // 双肋 Y 型分支
        [-0.09, 0.09].forEach((offsetAngle) => {
          const spoke = new THREE.Mesh(spokeGeom, rimSilverMat);
          spoke.rotation.x = baseAngle + offsetAngle;
          spokeGroup.add(spoke);
        });
      }

      // 宝马蓝白圆形中心盖 (BMW Roundel Wheel Center Cap)
      const hubCapGeom = new THREE.CylinderGeometry(radius * 0.20, radius * 0.20, 0.038, 20);
      const hubCap = new THREE.Mesh(hubCapGeom, rimDarkMat);
      hubCap.rotation.z = Math.PI / 2;
      hubCap.position.x = faceDir * 0.012;
      spokeGroup.add(hubCap);

      const hubRoundel = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.11, radius * 0.11, 0.040, 16),
        new THREE.MeshStandardMaterial({
          color: 0x0284c7, // 宝马蓝
          emissive: 0x0284c7,
          emissiveIntensity: 0.35,
          metalness: 0.8,
          roughness: 0.2,
        })
      );
      hubRoundel.rotation.z = Math.PI / 2;
      hubRoundel.position.x = faceDir * 0.014;

      const hubInner = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.06, radius * 0.06, 0.042, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      hubInner.rotation.z = Math.PI / 2;
      hubInner.position.x = faceDir * 0.016;

      spokeGroup.add(hubRoundel, hubInner);
      wheelGroup.add(spokeGroup);

      trafficWheels.push(wheelGroup);

      return wheelGroup;
    }

    // 6.1 【自车 (Ego Car)】宝马 M4 (BMW M4 Competition G82) 原厂高精度 3D 数字孪生模型
    let egoLidarDome: THREE.Mesh;
    let egoSpotLight: THREE.SpotLight | null = null;
    let egoCabinGroup: THREE.Group;
    function buildEgoCar(): THREE.Group {
      const car = new THREE.Group();

      // 0. 车底宽体接地软阴影面 (Contact Shadow)
      const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 5.2), shadowMat);
      contactShadow.rotation.x = -Math.PI / 2;
      contactShadow.position.set(0, 0.02, 0);
      car.add(contactShadow);

      // 隐藏式传感器基座（保障智驾雷达旋转与图层控制平稳运行）
      egoLidarDome = new THREE.Mesh(
        new THREE.BoxGeometry(0.001, 0.001, 0.001),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      egoLidarDome.position.set(0, 1.35, 0.8);
      car.add(egoLidarDome);

      // 大灯透镜晶莹光晕面片
      const flareL = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.48), whiteFlareMat);
      flareL.position.set(-0.68, 0.62, -2.25);
      const flareR = flareL.clone();
      flareR.position.x = 0.68;
      car.add(flareL, flareR);

      // 地面真实前照铺光面与斜射空气光锥
      const groundLightMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(5.8, 25),
        headlightGroundMat
      );
      groundLightMesh.rotation.x = -Math.PI / 2;
      groundLightMesh.position.set(0, 0.038, -14.62);
      groundLightMesh.renderOrder = 3;
      car.add(groundLightMesh);

      const createAirBeam = (posX: number, angleOutward: number) => {
        const geom = new THREE.PlaneGeometry(1.3, 14);
        const mesh = new THREE.Mesh(geom, slantedBeamMat);
        mesh.rotation.x = -Math.PI / 2 + 0.045;
        mesh.rotation.z = angleOutward;
        mesh.position.set(posX + (posX < 0 ? -0.15 : 0.15), 0.35, -9.1);
        mesh.renderOrder = 4;
        return mesh;
      };
      const airBeamL = createAirBeam(-0.68, 0.038);
      const airBeamR = createAirBeam(0.68, -0.038);
      car.add(airBeamL, airBeamR);

      const spotLight = new THREE.SpotLight(0xffffff, 2.5, 45, Math.PI / 5, 0.5, 1.2);
      spotLight.position.set(0, 0.68, -2.25);
      const spotTarget = new THREE.Object3D();
      spotTarget.position.set(0, 0, -22);
      car.add(spotLight, spotTarget);
      spotLight.target = spotTarget;
      egoSpotLight = spotLight;

      // 尾部红色立体光晕
      const egoTailFlareL = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.42), redFlareMat);
      egoTailFlareL.position.set(-0.72, 0.72, 2.30);
      const egoTailFlareR = egoTailFlareL.clone();
      egoTailFlareR.position.x = 0.72;
      car.add(egoTailFlareL, egoTailFlareR);

      // 创建车体与座舱包裹容器
      const carWrapper = new THREE.Group();
      egoCabinGroup = carWrapper;
      car.add(carWrapper);

      // 加载原厂宝马 M4 Competition M Package 官方高精度 3D 模型
      const gltfLoader = new GLTFLoader();
      gltfLoader.load(
        '/bmw_m4.glb',
        (gltf) => {
          const model = gltf.scene;

          // 轮胎与轮毂动态旋转系统：将合并网格拆解为 4 个独立轮毂与轮胎并创建旋转中心
          model.updateMatrixWorld(true);
          const m33 = model.getObjectByName('Object_33') as THREE.Mesh;
          const m34 = model.getObjectByName('Object_34') as THREE.Mesh;

          if (m33 && m34) {
            const splitMeshInto4Wheels = (mesh: THREE.Mesh) => {
              const geom = mesh.geometry;
              const index = geom.index;
              const pos = geom.attributes.position;
              const norm = geom.attributes.normal;
              const uv = geom.attributes.uv;
              if (!index || !pos) return [];

              const quadIndices: number[][] = [[], [], [], []];
              const v = new THREE.Vector3();

              for (let i = 0; i < index.count; i += 3) {
                const a = index.getX(i);
                v.fromBufferAttribute(pos, a).applyMatrix4(mesh.matrixWorld);
                const q = (v.x >= -0.67 ? 1 : 0) + (v.z >= -0.65 ? 2 : 0);
                quadIndices[q].push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
              }

              const wheelMeshes: { mesh: THREE.Mesh; center: THREE.Vector3; q: number }[] = [];
              for (let q = 0; q < 4; q++) {
                const idxArr = quadIndices[q];
                const usedVerts = new Map<number, number>();
                const newPos: number[] = [];
                const newNorm: number[] = [];
                const newUv: number[] = [];
                const newIdx: number[] = [];

                for (let j = 0; j < idxArr.length; j++) {
                  const oldIdx = idxArr[j];
                  if (!usedVerts.has(oldIdx)) {
                    const newId = newPos.length / 3;
                    usedVerts.set(oldIdx, newId);
                    v.fromBufferAttribute(pos, oldIdx).applyMatrix4(mesh.matrixWorld);
                    newPos.push(v.x, v.y, v.z);
                    if (norm) {
                      const n = new THREE.Vector3().fromBufferAttribute(norm, oldIdx);
                      n.transformDirection(mesh.matrixWorld);
                      newNorm.push(n.x, n.y, n.z);
                    }
                    if (uv) {
                      newUv.push(uv.getX(oldIdx), uv.getY(oldIdx));
                    }
                  }
                  newIdx.push(usedVerts.get(oldIdx)!);
                }

                const subGeom = new THREE.BufferGeometry();
                subGeom.setAttribute('position', new THREE.Float32BufferAttribute(newPos, 3));
                if (norm) subGeom.setAttribute('normal', new THREE.Float32BufferAttribute(newNorm, 3));
                if (uv) subGeom.setAttribute('uv', new THREE.Float32BufferAttribute(newUv, 2));
                subGeom.setIndex(newIdx);

                subGeom.computeBoundingBox();
                const center = new THREE.Vector3();
                if (subGeom.boundingBox) {
                  subGeom.boundingBox.getCenter(center);
                  subGeom.translate(-center.x, -center.y, -center.z);
                }

                const subMesh = new THREE.Mesh(subGeom, mesh.material);
                wheelMeshes.push({ mesh: subMesh, center, q });
              }
              return wheelMeshes;
            };

            const wheels33 = splitMeshInto4Wheels(m33);
            const wheels34 = splitMeshInto4Wheels(m34);

            if (m33.parent) m33.parent.remove(m33);
            if (m34.parent) m34.parent.remove(m34);

            for (let q = 0; q < 4; q++) {
              if (wheels33[q] && wheels34[q]) {
                const wheelGroup = new THREE.Group();
                wheelGroup.position.copy(wheels33[q].center);
                wheelGroup.add(wheels33[q].mesh);
                wheelGroup.add(wheels34[q].mesh);
                model.add(wheelGroup);
                egoWheels.push(wheelGroup);
              }
            }
          }

          // 计算原始边界盒以实现毫米级物理尺度归一化
          const rawBox = new THREE.Box3().setFromObject(model);
          const rawSize = new THREE.Vector3();
          rawBox.getSize(rawSize);

          // 官方真车物理全长 4.794m，模型原始长轴 (Z) 为 ~19.79m
          const targetLength = 4.794;
          const scale = targetLength / rawSize.z;
          model.scale.set(scale, scale, scale);

          // 重新计算缩放后的几何中心，将四轮精确贴地于 y = 0
          const scaledBox = new THREE.Box3().setFromObject(model);
          const scaledCenter = new THREE.Vector3();
          scaledBox.getCenter(scaledCenter);

          model.position.x = -scaledCenter.x;
          model.position.y = -scaledBox.min.y; // 轮底紧贴沥青路面
          model.position.z = -scaledCenter.z;

          // 原始模型前大灯朝向 +Z，尾灯朝向 -Z；
          // 场景车流前进方向为 -Z，旋转 180° 使车头精确对准行进方向
          const innerPivot = new THREE.Group();
          innerPivot.add(model);
          innerPivot.rotation.y = Math.PI;

          // 深度遍历优化材质，完美对标用户参考图中的 2026 宝马 M4 布鲁克林灰 (Brooklyn Grey)
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              const mat = mesh.material as THREE.Material;
              if (mat) {
                const matName = mat.name.toLowerCase();

                // A. 车身外漆：2026 官方经典布鲁克林金属灰 (Brooklyn Grey Metallic)
                if (matName.includes('body') || matName.includes('paint')) {
                  mesh.material = new THREE.MeshPhysicalMaterial({
                    color: 0xc4c9d1, // 优雅纯正的布鲁克林金属灰
                    emissive: 0x1f242d, // 浅灰暗部底色，防止死黑
                    emissiveIntensity: 0.14,
                    roughness: 0.20,
                    metalness: 0.35,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.05,
                    reflectivity: 0.95,
                  });
                }
                // B. 竖直大双肾熏黑格栅 (Gloss Shadowline Pig Grill)
                else if (matName.includes('grill') || matName.includes('piggrill')) {
                  mesh.material = new THREE.MeshStandardMaterial({
                    color: 0x05070a,
                    roughness: 0.12,
                    metalness: 0.90,
                  });
                }
                // C. 碳纤维车顶与空气动力学 Shadowline 高光黑外饰件
                else if (matName.includes('black') || matName.includes('carbon') || matName.includes('pillar')) {
                  mesh.material = new THREE.MeshStandardMaterial({
                    color: 0x0a0d14,
                    roughness: 0.28,
                    metalness: 0.65,
                  });
                }
                // D. 防眩光高反光双曲率深色隐私车窗玻璃
                else if (matName.includes('window') || matName.includes('glass')) {
                  mesh.material = new THREE.MeshPhysicalMaterial({
                    color: 0x030712,
                    metalness: 0.95,
                    roughness: 0.04,
                    transmission: 0.32,
                    thickness: 0.5,
                    clearcoat: 1.0,
                  });
                }
                // E. 宝马 M 826M 双色双辐锻造轮毂 (Forged Bicolor Rim)
                else if (matName.includes('rim')) {
                  mesh.material = new THREE.MeshStandardMaterial({
                    color: 0xf1f5f9,
                    metalness: 0.92,
                    roughness: 0.14,
                  });
                }
                // F. 宝马 M 标志性运动蓝色多活塞卡钳 (M Sport Blue Caliper)
                else if (matName.includes('caliper')) {
                  mesh.material = new THREE.MeshStandardMaterial({
                    color: 0x1d4ed8,
                    roughness: 0.20,
                    metalness: 0.70,
                    emissive: 0x2563eb,
                    emissiveIntensity: 0.45,
                  });
                }
                // G. 激光双倒 L 天使眼大灯
                else if (matName.includes('headlight') || matName.includes('led')) {
                  mesh.material = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    emissive: 0xf8fafc,
                    emissiveIntensity: 2.8,
                    roughness: 0.1,
                  });
                }
                // H. 3D 倒 L 熏黑立体尾灯
                else if (matName.includes('tail') || matName.includes('redlight')) {
                  mesh.material = new THREE.MeshBasicMaterial({ color: 0xff1e1e });
                }
                // I. 金属镀铬件与大口径排气尾喉
                else if (matName.includes('chrome') || matName.includes('exhaust')) {
                  mesh.material = new THREE.MeshStandardMaterial({
                    color: 0xe2e8f0,
                    metalness: 0.96,
                    roughness: 0.10,
                  });
                }
              }
            }
          });

          carWrapper.add(innerPivot);
        },
        undefined,
        (error) => {
          console.error('Failed to load BMW M4 GLB model:', error);
        }
      );

      return car;
    }

    // 6.2 【重型厢式货车 (Heavy Box Truck)】升级
    function buildHeavyTruck(boxColor = 0xf59e0b): THREE.Group {
      const truck = new THREE.Group();

      const cabinMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.35,
        metalness: 0.6,
      });

      const containerMat = new THREE.MeshStandardMaterial({
        color: 0x182133,
        roughness: 0.45,
        metalness: 0.35,
      });

      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x020617,
        metalness: 0.9,
        roughness: 0.1,
      });

      // 货车接地阴影 (消除浮空)
      const truckShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 8.8), shadowMat);
      truckShadow.rotation.x = -Math.PI / 2;
      truckShadow.position.set(0, 0.02, 0);
      truck.add(truckShadow);

      // 底盘大梁
      const chassis = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 0.4, 7.8),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 })
      );
      chassis.position.y = 0.5;
      truck.add(chassis);

      // 银色油箱与侧防护网
      const tankGeom = new THREE.CylinderGeometry(0.3, 0.3, 1.8, 16);
      const tankMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85 });
      const tank = new THREE.Mesh(tankGeom, tankMat);
      tank.rotation.z = Math.PI / 2;
      tank.position.set(-1.18, 0.5, 0.2);
      truck.add(tank);

      // 驾驶室 (Tractor Cabin)
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.3, 2.1), cabinMat);
      cabin.position.set(0, 1.85, -2.6);
      truck.add(cabin);

      const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.08), glassMat);
      frontGlass.position.set(0, 2.1, -3.66);
      truck.add(frontGlass);

      const fairingGeom = new THREE.BoxGeometry(2.35, 0.65, 1.4);
      const fairing = new THREE.Mesh(fairingGeom, cabinMat);
      fairing.position.set(0, 3.2, -2.4);
      fairing.rotation.x = -0.22;
      truck.add(fairing);

      const bumper = new THREE.Mesh(
        new THREE.BoxGeometry(2.45, 0.45, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 })
      );
      bumper.position.set(0, 0.6, -3.65);
      truck.add(bumper);

      const truckHeadlight = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.15, 0.06),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      truckHeadlight.position.set(-0.85, 0.65, -3.81);
      const truckHeadlightR = truckHeadlight.clone();
      truckHeadlightR.position.x = 0.85;
      truck.add(truckHeadlight, truckHeadlightR);

      // 货车前照大灯透镜光晕与前方地面铺光
      const truckFlareL = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.45), whiteFlareMat);
      truckFlareL.position.set(-0.85, 0.65, -3.85);
      const truckFlareR = truckFlareL.clone();
      truckFlareR.position.x = 0.85;
      truck.add(truckFlareL, truckFlareR);

      const truckGroundLight = new THREE.Mesh(
        new THREE.PlaneGeometry(5.6, 22),
        headlightGroundMat
      );
      truckGroundLight.rotation.x = -Math.PI / 2;
      truckGroundLight.position.set(0, 0.035, -14.81);
      truckGroundLight.renderOrder = 3;
      truck.add(truckGroundLight);

      // 货箱侧面增加纵向加强筋细节
      const container = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.1, 5.4), containerMat);
      container.position.set(0, 2.3, 1.1);
      truck.add(container);

      // 加强筋立柱
      const ribMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
      for (let r = 0; r < 5; r++) {
        const ribZ = -1.2 + r * 1.1;
        const ribL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.9, 0.08), ribMat);
        ribL.position.set(-1.26, 2.3, ribZ);
        const ribR = ribL.clone();
        ribR.position.x = 1.26;
        truck.add(ribL, ribR);
      }

      // 尾部立体灯与防撞横梁
      const tailL = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.18, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      tailL.position.set(-0.95, 0.7, 3.82);
      const tailR = tailL.clone();
      tailR.position.x = 0.95;
      truck.add(tailL, tailR);

      // 醒目红光尾灯光晕 (Red Taillight Flares)
      const truckTailFlareL = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), redFlareMat);
      truckTailFlareL.position.set(-0.95, 0.7, 3.86);
      const truckTailFlareR = truckTailFlareL.clone();
      truckTailFlareR.position.x = 0.95;
      truck.add(truckTailFlareL, truckTailFlareR);

      // 货箱顶部高位红色示廓灯
      const topTailL = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.25), redFlareMat);
      topTailL.position.set(-1.18, 3.75, 3.82);
      const topTailR = topTailL.clone();
      topTailR.position.x = 1.18;
      truck.add(topTailL, topTailR);

      // 6 个重载卡车车轮
      const wFL = createWheel(0.48, 0.32);
      wFL.position.set(-1.18, 0.48, -2.6);
      const wFR = createWheel(0.48, 0.32);
      wFR.position.set(1.18, 0.48, -2.6);

      const wRL1 = createWheel(0.48, 0.32);
      wRL1.position.set(-1.18, 0.48, 1.2);
      const wRR1 = createWheel(0.48, 0.32);
      wRR1.position.set(1.18, 0.48, 1.2);

      const wRL2 = createWheel(0.48, 0.32);
      wRL2.position.set(-1.18, 0.48, 2.5);
      const wRR2 = createWheel(0.48, 0.32);
      wRR2.position.set(1.18, 0.48, 2.5);

      truck.add(wFL, wFR, wRL1, wRR1, wRL2, wRR2);

      // 金色发光 3D Bounding Box
      const boxW = 2.75;
      const boxH = 3.65;
      const boxD = 8.1;
      const boxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(boxW, boxH, boxD));
      const boxLineMat = new THREE.LineBasicMaterial({
        color: boxColor,
        linewidth: 2,
        transparent: true,
        opacity: 0.95,
      });
      const lineBox = new THREE.LineSegments(boxEdges, boxLineMat);
      lineBox.position.set(0, boxH / 2 + 0.05, -0.1);
      lineBox.name = 'boundingBox';
      truck.add(lineBox);

      return truck;
    }

    // 6.3 【周围标准轿车 (Surrounding Sedan)】
    function buildTrafficSedan(color: number, boxColor: number, isOncoming = false): THREE.Group {
      const car = new THREE.Group();

      const bodyMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0.7,
      });

      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x020617,
        metalness: 0.95,
        roughness: 0.1,
      });

      // 车底接地软阴影
      const carShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.8), shadowMat);
      carShadow.rotation.x = -Math.PI / 2;
      carShadow.position.set(0, 0.02, 0);
      car.add(carShadow);

      // 下半部流线车身 (带前倾低鼻锥与圆滑轮拱)
      const tShape = new THREE.Shape();
      tShape.moveTo(-2.15, 0.20);
      tShape.quadraticCurveTo(-2.18, 0.40, -2.05, 0.55);
      tShape.quadraticCurveTo(-1.85, 0.65, -0.80, 0.76);
      tShape.lineTo(1.80, 0.80);
      tShape.quadraticCurveTo(2.15, 0.80, 2.15, 0.55);
      tShape.quadraticCurveTo(2.10, 0.35, 1.95, 0.22);
      tShape.lineTo(1.65, 0.22);
      // 后轮拱圆弧
      tShape.quadraticCurveTo(1.65, 0.65, 1.25, 0.68);
      tShape.quadraticCurveTo(0.85, 0.65, 0.85, 0.22);
      tShape.lineTo(-0.85, 0.22);
      // 前轮拱圆弧
      tShape.quadraticCurveTo(-0.85, 0.65, -1.25, 0.68);
      tShape.quadraticCurveTo(-1.65, 0.65, -1.65, 0.22);
      tShape.lineTo(-2.15, 0.20);
      tShape.closePath();

      const tBodyGeom = new THREE.ExtrudeGeometry(tShape, {
        steps: 1,
        depth: 1.82,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.04,
        bevelSegments: 3,
      });
      tBodyGeom.rotateY(-Math.PI / 2);
      tBodyGeom.translate(1.82 / 2, 0, 0);
      tBodyGeom.computeVertexNormals();
      const lower = new THREE.Mesh(tBodyGeom, bodyMat);
      car.add(lower);

      // 流线座舱
      const tCabinShape = new THREE.Shape();
      tCabinShape.moveTo(-0.75, 0.75);
      tCabinShape.quadraticCurveTo(-0.35, 1.18, 0.0, 1.24);
      tCabinShape.lineTo(0.70, 1.23);
      tCabinShape.quadraticCurveTo(1.20, 1.14, 1.55, 0.79);
      tCabinShape.lineTo(1.55, 0.75);
      tCabinShape.lineTo(-0.75, 0.75);
      tCabinShape.closePath();

      const tCabinGeom = new THREE.ExtrudeGeometry(tCabinShape, {
        steps: 1,
        depth: 1.48,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.03,
        bevelSegments: 3,
      });
      tCabinGeom.rotateY(-Math.PI / 2);
      tCabinGeom.translate(1.48 / 2, 0, 0);
      tCabinGeom.computeVertexNormals();
      const cabin = new THREE.Mesh(tCabinGeom, glassMat);
      car.add(cabin);

      const wFL = createWheel(0.34, 0.22, false);
      wFL.position.set(-0.92, 0.34, -1.25);
      const wFR = createWheel(0.34, 0.22, true);
      wFR.position.set(0.92, 0.34, -1.25);
      const wRL = createWheel(0.34, 0.22, false);
      wRL.position.set(-0.92, 0.34, 1.25);
      const wRR = createWheel(0.34, 0.22, true);
      wRR.position.set(0.92, 0.34, 1.25);
      car.add(wFL, wFR, wRL, wRR);

      if (isOncoming) {
        // 对向来车：车头迎面驶来，配备明亮白光 LED 大灯与透镜光晕
        const headL = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.12, 0.05),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        headL.position.set(-0.68, 0.58, 2.12);
        const headR = headL.clone();
        headR.position.x = 0.68;
        car.add(headL, headR);

        // 对向车大灯透镜白光光晕 (White Lens Glow Flares)
        const oncomingFlareL = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.48), whiteFlareMat);
        oncomingFlareL.position.set(-0.68, 0.58, 2.16);
        const oncomingFlareR = oncomingFlareL.clone();
        oncomingFlareR.position.x = 0.68;
        car.add(oncomingFlareL, oncomingFlareR);

        // 对向车地面向前大灯铺光（向我方微锥形扩散展开，真实交会）
        const oncomingGroundBeam = new THREE.Mesh(
          new THREE.PlaneGeometry(5.2, 18),
          headlightGroundMat
        );
        oncomingGroundBeam.rotation.x = -Math.PI / 2;
        oncomingGroundBeam.rotation.z = Math.PI;
        oncomingGroundBeam.position.set(0, 0.035, 11.12);
        oncomingGroundBeam.renderOrder = 3;
        car.add(oncomingGroundBeam);

        // 对向车向外微展的斜射空气柔光薄片
        const oncomingAirGeom = new THREE.PlaneGeometry(1.0, 10);
        const oncomingAirL = new THREE.Mesh(oncomingAirGeom, slantedBeamMat);
        oncomingAirL.rotation.x = -Math.PI / 2 - 0.055;
        oncomingAirL.rotation.z = -0.035;
        oncomingAirL.position.set(-0.76, 0.32, 6.8);
        const oncomingAirR = new THREE.Mesh(oncomingAirGeom, slantedBeamMat);
        oncomingAirR.rotation.x = -Math.PI / 2 - 0.055;
        oncomingAirR.rotation.z = 0.035;
        oncomingAirR.position.set(0.76, 0.32, 6.8);
        car.add(oncomingAirL, oncomingAirR);
      } else {
        // 同向行驶的前车：车尾背向我们，配备鲜艳醒目的红色贯穿立体尾灯与光晕
        const tailL = new THREE.Mesh(
          new THREE.BoxGeometry(0.38, 0.12, 0.06),
          new THREE.MeshBasicMaterial({ color: 0xff1e1e })
        );
        tailL.position.set(-0.68, 0.58, 2.12);
        const tailR = tailL.clone();
        tailR.position.x = 0.68;
        car.add(tailL, tailR);

        // 贯穿式尾灯条
        const tailBar = new THREE.Mesh(
          new THREE.BoxGeometry(1.36, 0.05, 0.05),
          new THREE.MeshBasicMaterial({ color: 0xef4444 })
        );
        tailBar.position.set(0, 0.58, 2.12);
        car.add(tailBar);

        // 鲜艳红色尾灯发光光晕 (Red Taillight Flares)
        const tailFlareL = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.45), redFlareMat);
        tailFlareL.position.set(-0.68, 0.58, 2.16);
        const tailFlareR = tailFlareL.clone();
        tailFlareR.position.x = 0.68;
        car.add(tailFlareL, tailFlareR);

        // 前车向前大灯与路面铺光 (向外微锥形微展)
        const fHeadL = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.12, 0.05),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        fHeadL.position.set(-0.68, 0.58, -2.12);
        const fHeadR = fHeadL.clone();
        fHeadR.position.x = 0.68;
        car.add(fHeadL, fHeadR);

        const aheadGroundLight = new THREE.Mesh(
          new THREE.PlaneGeometry(5.2, 18),
          headlightGroundMat
        );
        aheadGroundLight.rotation.x = -Math.PI / 2;
        aheadGroundLight.position.set(0, 0.034, -11.12);
        aheadGroundLight.renderOrder = 3;
        car.add(aheadGroundLight);
      }

      // 3D Bounding Box
      const boxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(2.1, 1.6, 4.5));
      const boxLineMat = new THREE.LineBasicMaterial({
        color: boxColor,
        linewidth: 2,
        transparent: true,
        opacity: 0.95,
      });
      const lineBox = new THREE.LineSegments(boxEdges, boxLineMat);
      lineBox.position.y = 0.85;
      lineBox.name = 'boundingBox';
      car.add(lineBox);

      return car;
    }

    // 自车基准世界坐标（身位前移至 z = -3.8，确保完整车身尽收眼底）
    const EGO_POS_X = 0.5;
    const EGO_POS_Z = -3.8;

    // 实例化自车
    const egoCarGroup = buildEgoCar();
    egoCarGroup.position.set(EGO_POS_X, 0, EGO_POS_Z);
    scene.add(egoCarGroup);

    // 实例化周围交通车辆
    const trafficGroup = new THREE.Group();

    const truckGroup = buildHeavyTruck(0xf59e0b);
    truckGroup.position.set(4.8, 0, -20);
    trafficGroup.add(truckGroup);

    const carAheadGroup = buildTrafficSedan(0x1e293b, 0xf59e0b, false);
    carAheadGroup.position.set(4.5, 0, -45);
    trafficGroup.add(carAheadGroup);

    const oncoming1 = buildTrafficSedan(0x334155, 0x06b6d4, true);
    oncoming1.position.set(-5.8, 0, -95);
    trafficGroup.add(oncoming1);

    const oncoming2 = buildTrafficSedan(0x1e293b, 0x06b6d4, true);
    oncoming2.position.set(-9.8, 0, -35);
    trafficGroup.add(oncoming2);

    scene.add(trafficGroup);

    // ==========================================================
    // 7. 智能驾驶感知与变道规划轨迹图层 (Perception & Path)
    // ==========================================================
    const perceptionGroup = new THREE.Group();

    // 变道规划轨迹线（从自车身位优雅引向右侧匝道）
    const pathCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(EGO_POS_X, 0.05, EGO_POS_Z),
      new THREE.Vector3(0.6, 0.05, -13),
      new THREE.Vector3(1.8, 0.05, -27),
      new THREE.Vector3(3.8, 0.05, -45),
      new THREE.Vector3(4.8, 0.05, -68),
      new THREE.Vector3(4.8, 0.05, -105),
    ]);
    const pathPoints = pathCurve.getPoints(60);
    const pathGeom = new THREE.BufferGeometry().setFromPoints(pathPoints);
    const pathMat = new THREE.LineBasicMaterial({
      color: 0x10b981,
      linewidth: 4,
    });
    const trajectoryLine = new THREE.Line(pathGeom, pathMat);
    trajectoryLine.name = 'planningPath';
    perceptionGroup.add(trajectoryLine);

    const ribbonGeom = new THREE.PlaneGeometry(1.6, 100, 1, 40);
    const ribbonMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ribbonMesh = new THREE.Mesh(ribbonGeom, ribbonMat);
    ribbonMesh.rotation.x = -Math.PI / 2;
    ribbonMesh.position.set(2.8, 0.04, -53.5);
    ribbonMesh.name = 'planningRibbon';
    perceptionGroup.add(ribbonMesh);

    // 地面同心圆动态扩散雷达波纹（以自车为中心）
    const radarRingsGroup = new THREE.Group();
    radarRingsGroup.name = 'radarRings';
    const ringRadii = [6, 14, 24, 36];
    const ringMeshes: THREE.LineLoop[] = [];

    ringRadii.forEach((r) => {
      const ringGeom = new THREE.BufferGeometry();
      const pts: THREE.Vector3[] = [];
      const segments = 64;
      for (let s = 0; s <= segments; s++) {
        const theta = (s / segments) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(theta) * r, 0.05, Math.sin(theta) * r));
      }
      ringGeom.setFromPoints(pts);
      const ringMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.35,
      });
      const ring = new THREE.LineLoop(ringGeom, ringMat);
      radarRingsGroup.add(ring);
      ringMeshes.push(ring);
    });
    radarRingsGroup.position.set(EGO_POS_X, 0, EGO_POS_Z);
    perceptionGroup.add(radarRingsGroup);

    // 传感器层保持纯净同心圆动态扩散雷达波纹与点云（已彻底移除突兀三角框与扇形线框）

    // 细腻微粒激光雷达点云
    const particleCount = 700;
    const particleGeom = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let p = 0; p < particleCount; p++) {
      const pIndex = p * 3;
      particlePositions[pIndex] = (Math.random() - 0.5) * 36;
      particlePositions[pIndex + 1] = Math.random() * 2.2 + 0.1;
      particlePositions[pIndex + 2] = -Math.random() * 85;
    }
    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xa5f3fc,
      size: 0.09,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const pointCloud = new THREE.Points(particleGeom, particleMat);
    pointCloud.name = 'lidarPointCloud';
    perceptionGroup.add(pointCloud);

    scene.add(perceptionGroup);

    // ==========================================================
    // 8. 动画与仿真主循环
    // ==========================================================
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const vehicleDataList: SurroundingVehicle[] = [
      {
        id: 'truck-1',
        type: 'truck',
        label: '同向车',
        distance: 18,
        speed: 80,
        lane: 1,
        x: 4.8,
        z: -20,
      },
      {
        id: 'car-2',
        type: 'car',
        label: '同向车',
        distance: 42,
        speed: 99,
        lane: 1,
        x: 4.5,
        z: -45,
      },
      {
        id: 'oncoming-3',
        type: 'car',
        label: '对向车',
        distance: 95,
        speed: 87,
        lane: -1,
        x: -5.8,
        z: -95,
      },
      {
        id: 'oncoming-4',
        type: 'suv',
        label: '对向车',
        distance: 35,
        speed: 92,
        lane: -2,
        x: -9.8,
        z: -35,
      },
    ];

    // 自由视角鼠标拖拽 360 度环视交互状态
    let isMouseDown = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let freeTheta = 0.55; // 水平环绕角
    let freePhi = 0.38;   // 垂直俯仰角
    const freeDistance = 11.5;

    const handlePointerDown = (e: PointerEvent) => {
      if (viewRef.current !== 'free') return;
      isMouseDown = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isMouseDown || viewRef.current !== 'free') return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      freeTheta -= dx * 0.006;
      freePhi = Math.max(0.12, Math.min(Math.PI / 2.2, freePhi + dy * 0.006));
    };

    const handlePointerUp = () => {
      isMouseDown = false;
    };

    container.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    // 白天与夜间颜色与环境常量（避免在每帧渲染循环内频繁分配对象）
    const colorNightBg = new THREE.Color(0x02040b);
    const colorDayBg = new THREE.Color(0x60a5fa);

    const colorNightFog = new THREE.Color(0x02040b);
    const colorDayFog = new THREE.Color(0x93c5fd);

    const colorNightAmbient = new THREE.Color(0x283b58);
    const colorDayAmbient = new THREE.Color(0xffffff);

    const colorNightMoon = new THREE.Color(0x60a5fa);
    const colorDaySun = new THREE.Color(0xfffbeb);

    const colorNightRim = new THREE.Color(0x38bdf8);
    const colorDayRim = new THREE.Color(0xbae6fd);

    const colorNightRoad = new THREE.Color(0x080c16);
    const colorDayRoad = new THREE.Color(0x2d3a4d);

    const colorNightLamp = new THREE.Color(0xfff7ed);
    const colorDayLamp = new THREE.Color(0x475569);

    let currentDayRatio = timeOfDayRef.current === 'day' ? 1.0 : 0.0;

    let lastPerfTime = performance.now();
    let perfFrameCount = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const currentSpd = speedRef.current;
      const speedFactor = currentSpd / 120;

      // A. 虚线流动
      const flowDelta = delta * 42 * speedFactor;
      dashedLinesGroup.children.forEach((child) => {
        child.position.z += flowDelta;
        if (child.position.z > 20) {
          child.position.z -= ROAD_LENGTH;
        }
      });

      // B. 标线与反光立柱向后移动
      markingsGroup.children.forEach((child) => {
        child.position.z += flowDelta;
        if (child.position.z > 20) {
          child.position.z -= 170;
        }
      });

      delineatorGroup.children.forEach((child) => {
        child.position.z += flowDelta;
        if (child.position.z > 20) {
          child.position.z -= 35 * 12;
        }
      });

      // C. 路灯杆动态向后循环滚动 (营造真实公路夜间飞驰)
      dynamicPoles.forEach((p) => {
        p.position.z += flowDelta;
        if (p.position.z > 25) {
          p.position.z -= poleCount * poleSpacing;
        }
      });

      // D. 建筑、龙门架与指路牌流动
      buildingsGroup.children.forEach((b) => {
        b.position.z += flowDelta * 0.45;
        if (b.position.z > 60) {
          b.position.z -= 260;
        }
      });

      gantryGroup.position.z += flowDelta;
      if (gantryGroup.position.z > 40) {
        gantryGroup.position.z -= 240;
      }

      roadSignGroup.position.z += flowDelta;
      if (roadSignGroup.position.z > 40) {
        roadSignGroup.position.z -= 200;
      }

      // E. 自车车顶激光雷达高速旋转物理动效
      if (egoLidarDome) {
        egoLidarDome.rotation.y += delta * 12;
      }

      // E.1 轮胎动起来：自车轮毂与轮胎根据实时行驶车速物理滚动
      const currentSpeedMps = (currentSpd * 1000) / 3600;
      const egoWheelRadius = 0.37;
      const egoRotDelta = (currentSpeedMps / egoWheelRadius) * delta;
      egoWheels.forEach((w) => {
        w.rotation.x += egoRotDelta;
      });

      // 周围交通车辆轮胎也自然旋转滚动
      const trafficSpdMps = (85 * 1000) / 3600;
      const trafficRotDelta = (trafficSpdMps / 0.35) * delta;
      trafficWheels.forEach((w) => {
        w.rotation.x -= trafficRotDelta;
      });

      // F. 周围车辆相对位移
      const truckRelSpeed = (80 - currentSpd) * 0.25 * delta;
      truckGroup.position.z += truckRelSpeed;
      if (truckGroup.position.z > 15) truckGroup.position.z = -55;
      if (truckGroup.position.z < -65) truckGroup.position.z = -15;

      const carAheadRelSpeed = (99 - currentSpd) * 0.25 * delta;
      carAheadGroup.position.z += carAheadRelSpeed;
      if (carAheadGroup.position.z > 20) carAheadGroup.position.z = -65;
      if (carAheadGroup.position.z < -80) carAheadGroup.position.z = -25;

      oncoming1.position.z += (currentSpd + 87) * 0.3 * delta;
      if (oncoming1.position.z > 30) oncoming1.position.z = -160;

      oncoming2.position.z += (currentSpd + 92) * 0.3 * delta;
      if (oncoming2.position.z > 30) oncoming2.position.z = -140;

      // G. 雷达扩散波纹动画
      ringMeshes.forEach((ring, index) => {
        const scaleVal = 1 + ((clock.elapsedTime * 1.5 + index * 0.5) % 2) * 0.6;
        ring.scale.set(scaleVal, 1, scaleVal);
        const mat = ring.material as THREE.LineBasicMaterial;
        mat.opacity = Math.max(0, 0.45 - (scaleVal - 1) * 0.5);
      });

      // H. 点云粒子流动
      const posAttr = particleGeom.attributes.position;
      for (let i = 0; i < particleCount; i++) {
        let pz = posAttr.getZ(i) + flowDelta * 0.8;
        if (pz > 10) pz = -85;
        posAttr.setZ(i, pz);
      }
      posAttr.needsUpdate = true;

      // I. 图层显隐控制
      const currLayers = layersRef.current;
      trajectoryLine.visible = currLayers.path;
      ribbonMesh.visible = currLayers.path;
      radarRingsGroup.visible = currLayers.sensor;
      pointCloud.visible = currLayers.pointCloud;

      [truckGroup, carAheadGroup, oncoming1, oncoming2].forEach((veh) => {
        const b = veh.getObjectByName('boundingBox');
        if (b) b.visible = currLayers.box;
      });

      // J. 相机视角平滑控制（针对用户诉求：跟车与自由模式下车辆身位前移，完整看到整个车身）
      // J. 相机视角平滑控制与座舱显示联动
      const targetView = viewRef.current;

      // 驾驶视角下自动隐藏座舱顶盖与挡风玻璃以消除穿模黑色伪影，其他视角完整还原车身
      if (egoCabinGroup) {
        egoCabinGroup.visible = targetView !== 'cockpit';
      }

      if (targetView === 'chase') {
        // 跟车模式：自车在 z = -3.8，相机优化置于后上方 (0.5, 5.6, 6.2)，视线对准 (0.5, 1.1, -16)
        // 彻底杜绝底部车机面板遮挡车尾，整车身姿完整展现，车前宽幅大灯光毯与前方车流一览无余
        camera.position.lerp(new THREE.Vector3(0.5, 5.6, 6.2), 0.08);
        camera.lookAt(0.5, 1.1, -16);
      } else if (targetView === 'top') {
        // 俯视模式 (BEV)：自车在 z = -3.8，相机精准定位在 (0.5, 36, -8.0)，视线投向 (0.5, 0, -13.0)
        // 确保自车稳定清晰展现于画面中下部（完美避开底部 HUD 控制栏），前方车道标线、规划路径与车流尽收眼底
        camera.position.lerp(new THREE.Vector3(0.5, 36, -8.0), 0.08);
        camera.lookAt(0.5, 0, -13.0);
      } else if (targetView === 'cockpit') {
        // 驾驶第一人称视角：相机精准置于驾驶员前方视点 (0.5, 1.25, -4.2)，视线对准正前方远方道路 (0.5, 1.15, -34)
        // 隐藏座舱顶盖（彻底根除顶部黑色多边形穿模与错误渲染），下部清晰展现标志性深蓝引擎盖与全景路况
        camera.position.lerp(new THREE.Vector3(0.5, 1.25, -4.2), 0.08);
        camera.lookAt(0.5, 1.15, -34);
      } else {
        // 自由模式：以自车中心 (0.5, 0.9, -3.8) 为环绕原点，自车居中高亮完整展现，支持鼠标拖拽 360 度全方位环视
        const targetCamX = 0.5 + freeDistance * Math.cos(freePhi) * Math.sin(freeTheta);
        const targetCamY = 0.9 + freeDistance * Math.sin(freePhi);
        const targetCamZ = -3.8 + freeDistance * Math.cos(freePhi) * Math.cos(freeTheta);
        camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.08);
        camera.lookAt(0.5, 0.9, -3.8);
      }

      // K. 车辆 2D 悬浮 HUD 标签位置计算
      const updatedList = [
        {
          ...vehicleDataList[0],
          z: truckGroup.position.z,
          distance: Math.round(Math.abs(truckGroup.position.z - egoCarGroup.position.z)),
          screenPos: toScreenPosition(
            new THREE.Vector3(truckGroup.position.x, 3.8, truckGroup.position.z),
            camera,
            width,
            height
          ),
        },
        {
          ...vehicleDataList[1],
          z: carAheadGroup.position.z,
          distance: Math.round(Math.abs(carAheadGroup.position.z - egoCarGroup.position.z)),
          screenPos: toScreenPosition(
            new THREE.Vector3(carAheadGroup.position.x, 2.0, carAheadGroup.position.z),
            camera,
            width,
            height
          ),
        },
        {
          ...vehicleDataList[2],
          z: oncoming1.position.z,
          distance: Math.round(Math.abs(oncoming1.position.z - egoCarGroup.position.z)),
          screenPos: toScreenPosition(
            new THREE.Vector3(oncoming1.position.x, 1.9, oncoming1.position.z),
            camera,
            width,
            height
          ),
        },
        {
          ...vehicleDataList[3],
          z: oncoming2.position.z,
          distance: Math.round(Math.abs(oncoming2.position.z - egoCarGroup.position.z)),
          screenPos: toScreenPosition(
            new THREE.Vector3(oncoming2.position.x, 1.9, oncoming2.position.z),
            camera,
            width,
            height
          ),
        },
      ];

      setProjectedVehicles(updatedList);
      if (onVehicleDataUpdate) {
        onVehicleDataUpdate(updatedList);
      }

      // L. 白天与夜间模式平滑过渡插值系统 (Smooth Day/Night Lerp)
      const targetRatio = timeOfDayRef.current === 'day' ? 1.0 : 0.0;
      currentDayRatio += (targetRatio - currentDayRatio) * Math.min(1, delta * 3.5);

      // 背景与雾效平滑过渡
      (scene.background as THREE.Color).copy(colorNightBg).lerp(colorDayBg, currentDayRatio);
      if (scene.fog) {
        scene.fog.color.copy(colorNightFog).lerp(colorDayFog, currentDayRatio);
        (scene.fog as THREE.FogExp2).density = THREE.MathUtils.lerp(0.010, 0.0035, currentDayRatio);
      }

      // 环境光与主日光/月光
      ambientLight.color.copy(colorNightAmbient).lerp(colorDayAmbient, currentDayRatio);
      ambientLight.intensity = THREE.MathUtils.lerp(2.2, 3.2, currentDayRatio);

      moonLight.color.copy(colorNightMoon).lerp(colorDaySun, currentDayRatio);
      moonLight.intensity = THREE.MathUtils.lerp(1.6, 3.6, currentDayRatio);
      moonLight.position.set(
        THREE.MathUtils.lerp(30, 45, currentDayRatio),
        THREE.MathUtils.lerp(60, 85, currentDayRatio),
        THREE.MathUtils.lerp(30, 20, currentDayRatio)
      );

      blueRimLight.color.copy(colorNightRim).lerp(colorDayRim, currentDayRatio);
      blueRimLight.intensity = THREE.MathUtils.lerp(1.4, 1.8, currentDayRatio);

      hemiLight.intensity = THREE.MathUtils.lerp(0.4, 2.0, currentDayRatio);

      // 道路质感与颜色平滑调整
      roadMat.color.copy(colorNightRoad).lerp(colorDayRoad, currentDayRatio);

      // 车灯铺光与空气柔光片：白天自然隐去，夜间微锥形照亮
      headlightGroundMat.opacity = THREE.MathUtils.lerp(0.85, 0.0, currentDayRatio);
      slantedBeamMat.opacity = THREE.MathUtils.lerp(0.35, 0.0, currentDayRatio);
      groundLightPoolMat.opacity = THREE.MathUtils.lerp(0.22, 0.0, currentDayRatio);

      // 路灯灯泡颜色：白天熄灭变灰，夜间亮起暖白
      lampGlowMat.color.copy(colorNightLamp).lerp(colorDayLamp, currentDayRatio);

      // 车辆灯具光晕：白天呈现通透 LED 日行灯晶体，夜间呈现饱满透镜光晕
      whiteFlareMat.opacity = THREE.MathUtils.lerp(0.92, 0.25, currentDayRatio);
      redFlareMat.opacity = THREE.MathUtils.lerp(0.92, 0.35, currentDayRatio);

      if (egoSpotLight) {
        egoSpotLight.intensity = THREE.MathUtils.lerp(2.5, 0.0, currentDayRatio);
      }

      // 建筑材质与贴图在白天与夜景间平滑切换
      buildingMat.emissiveIntensity = THREE.MathUtils.lerp(0.5, 0.06, currentDayRatio);
      if (currentDayRatio > 0.5 && buildingMat.map !== buildingDayTex) {
        buildingMat.map = buildingDayTex;
        buildingMat.needsUpdate = true;
      } else if (currentDayRatio <= 0.5 && buildingMat.map !== buildingNightTex) {
        buildingMat.map = buildingNightTex;
        buildingMat.needsUpdate = true;
      }

      renderer.render(scene, camera);

      // 性能指标采样 (节流至每 300ms 更新一次，避免高频 React re-render)
      perfFrameCount++;
      const now = performance.now();
      const elapsed = now - lastPerfTime;
      if (elapsed >= 300) {
        const currentFps = Math.round((perfFrameCount * 1000) / elapsed);
        const frameTime = parseFloat((elapsed / perfFrameCount).toFixed(1));
        const mem = (performance as any).memory;
        const memoryMB = mem ? Math.round(mem.usedJSHeapSize / (1024 * 1024)) : undefined;

        if (onPerfUpdateRef.current) {
          onPerfUpdateRef.current({
            fps: currentFps,
            frameTime,
            drawCalls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            geometries: renderer.info.memory.geometries,
            textures: renderer.info.memory.textures,
            memoryMB,
          });
        }

        lastPerfTime = now;
        perfFrameCount = 0;
      }
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* 2D 目标车辆悬浮 HUD 标签层 */}
      {layers.box && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {projectedVehicles.map((v) => {
            if (!v.screenPos || !v.screenPos.visible) return null;

            const isWarning = v.distance < 15;
            const isOrange = v.label === '同向车' || v.id === 'truck-1';

            return (
              <div
                key={v.id}
                className="absolute transition-transform duration-75 ease-out"
                style={{
                  left: `${v.screenPos.x}px`,
                  top: `${v.screenPos.y}px`,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono font-medium tracking-wide border shadow-lg backdrop-blur-sm ${
                    isOrange
                      ? 'bg-amber-950/75 border-amber-500/90 text-amber-300'
                      : 'bg-cyan-950/75 border-cyan-400/90 text-cyan-300'
                  } ${isWarning ? 'animate-pulse' : ''}`}
                >
                  <span className="font-sans font-bold">{v.label}</span>
                  <span className="opacity-50">|</span>
                  <span>{v.distance}m</span>
                  <span className="opacity-50">|</span>
                  <span>{v.speed}km/h</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
