import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const SmartTrap3DScene: React.FC<{ className?: string }> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mutable refs for Three.js state
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const uvLightRef = useRef<THREE.PointLight | null>(null);
  const insectsRef = useRef<{
    mesh: THREE.Group;
    wingL: THREE.Mesh;
    wingR: THREE.Mesh;
    angle: number;
    radius: number;
    height: number;
    speed: number;
    spiralSpeed: number;
    wobblePhase: number;
    isTrapped: boolean;
    trappedTimer: number;
    initialRadius: number;
  }[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Detect Software WebGL
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // Scene setup with cohesive dark evergreen (#132A13) background matching CSS
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x132a13);
    scene.fog = new THREE.FogExp2(0x132a13, 0.045);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    // Position camera so trap is well framed
    const isDesktop = width >= 1024;
    if (isDesktop) {
      camera.position.set(3.2, 3.0, 5.2);
    } else {
      camera.position.set(0, 3.2, 6.2);
    }
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true,
    });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x132a13, 1.0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // Studio Environment Reflection
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    } catch {
      // Fallback
    }

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2.0;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI / 2 + 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6; // Gentle ambient rotation
    controls.target.set(0, 2.05, 0);

    // Stop auto-rotate when user drags
    controls.addEventListener('start', () => {
      controls.autoRotate = false;
    });

    // Lighting (Warm twilight sunset + glowing UV purple phototaxis light)
    const sunLight = new THREE.DirectionalLight(0xf59e0b, 1.8);
    sunLight.position.set(-8, 5, -5);
    sunLight.castShadow = !isSoftwareGl;
    if (sunLight.shadow) {
      sunLight.shadow.mapSize.width = isSoftwareGl ? 512 : 1024;
      sunLight.shadow.mapSize.height = isSoftwareGl ? 512 : 1024;
      sunLight.shadow.bias = -0.0005;
    }
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x2d6a4f, 0x132a13, 1.4);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    // Dynamic glowing UV Point Light
    const uvLight = new THREE.PointLight(0xa855f7, 3.2, 9, 1.6);
    uvLight.position.set(0, 2.65, 0);
    uvLightRef.current = uvLight;
    scene.add(uvLight);

    // Trap Group
    const trapGroup = new THREE.Group();
    scene.add(trapGroup);

    // Ground: Mud & Water rice paddy field
    const groundGeo = new THREE.CylinderGeometry(9, 9.5, 0.4, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x132a13,
      roughness: 0.85,
      metalness: 0.1,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.y = -0.2;
    groundMesh.receiveShadow = !isSoftwareGl;
    scene.add(groundMesh);

    // Water puddle reflection plane
    const waterGeo = new THREE.CircleGeometry(8.2, 40);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0c1e16,
      roughness: 0.05,
      metalness: 0.9,
      transparent: true,
      opacity: 0.9,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = 0.02;
    waterMesh.receiveShadow = !isSoftwareGl;
    scene.add(waterMesh);

    // Rice Stalk Clumps
    const stalkGeo = new THREE.CylinderGeometry(0.015, 0.025, 0.75, 4);
    const leafGeo = new THREE.ConeGeometry(0.04, 0.9, 3);
    const ricePlantMat = new THREE.MeshStandardMaterial({
      color: 0x2d6a4f,
      roughness: 0.6,
      metalness: 0.05,
    });
    const goldenGrainMat = new THREE.MeshStandardMaterial({
      color: 0xa3b146,
      roughness: 0.7,
    });

    const isMobile = width < 768;
    const plantClumpCount = isMobile ? 26 : 56;

    for (let i = 0; i < plantClumpCount; i++) {
      const clump = new THREE.Group();
      const angle = (i / plantClumpCount) * Math.PI * 2 + Math.random() * 0.25;
      const dist = 1.9 + Math.random() * 5.2;
      const cx = Math.cos(angle) * dist;
      const cz = Math.sin(angle) * dist;

      const stalksInClump = 4;
      for (let s = 0; s < stalksInClump; s++) {
        const stalk = new THREE.Mesh(stalkGeo, ricePlantMat);
        stalk.position.set((Math.random() - 0.5) * 0.12, 0.38, (Math.random() - 0.5) * 0.12);
        stalk.rotation.z = (Math.random() - 0.5) * 0.25;
        stalk.rotation.x = (Math.random() - 0.5) * 0.25;
        clump.add(stalk);

        const leaf = new THREE.Mesh(leafGeo, Math.random() > 0.4 ? ricePlantMat : goldenGrainMat);
        leaf.position.set(stalk.position.x, 0.7, stalk.position.z);
        leaf.rotation.z = (Math.random() - 0.5) * 0.5;
        leaf.scale.set(0.8, 1, 0.3);
        clump.add(leaf);
      }

      clump.position.set(cx, 0, cz);
      scene.add(clump);
    }

    // Smart Light Trap Hardware Assembly
    // Concrete Base Pad
    const basePadGeo = new THREE.CylinderGeometry(0.38, 0.44, 0.12, 16);
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x2b302c, roughness: 0.9 });
    const basePad = new THREE.Mesh(basePadGeo, concreteMat);
    basePad.position.y = 0.06;
    basePad.castShadow = !isSoftwareGl;
    trapGroup.add(basePad);

    // Vertical Structural Pole (Galvanized Steel)
    const poleGeo = new THREE.CylinderGeometry(0.045, 0.045, 3.8, 16);
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      metalness: 0.85,
      roughness: 0.25,
    });
    const pole = new THREE.Mesh(poleGeo, steelMat);
    pole.position.y = 1.9;
    pole.castShadow = !isSoftwareGl;
    trapGroup.add(pole);

    // Weatherproof Enclosure (ESP32-S3 IP65)
    const encGeo = new THREE.BoxGeometry(0.34, 0.46, 0.24);
    const encMat = new THREE.MeshStandardMaterial({
      color: 0xedf2f7,
      metalness: 0.2,
      roughness: 0.4,
    });
    const enclosure = new THREE.Mesh(encGeo, encMat);
    enclosure.position.set(0, 0.8, -0.16);
    enclosure.castShadow = !isSoftwareGl;
    trapGroup.add(enclosure);

    // Status LED bezels
    const ledGlowGeo = new THREE.SphereGeometry(0.015, 8, 8);
    const greenLedMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 2.0 });
    const greenLed = new THREE.Mesh(ledGlowGeo, greenLedMat);
    greenLed.position.set(-0.08, 0.93, -0.035);
    trapGroup.add(greenLed);

    const blueLedMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 1.8 });
    const blueLed = new THREE.Mesh(ledGlowGeo, blueLedMat);
    blueLed.position.set(-0.03, 0.93, -0.035);
    trapGroup.add(blueLed);

    // Water inlet & drain hose
    const hoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.06, 0.7, -0.1),
      new THREE.Vector3(0.12, 1.0, -0.05),
      new THREE.Vector3(0.08, 1.25, 0.08),
    ]);
    const hoseGeo = new THREE.TubeGeometry(hoseCurve, 12, 0.012, 8, false);
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x1b4332, roughness: 0.5 });
    const hose = new THREE.Mesh(hoseGeo, hoseMat);
    trapGroup.add(hose);

    // Water Collection Basin / Tray Assembly
    const trayOuterGeo = new THREE.CylinderGeometry(0.5, 0.38, 0.2, 32);
    const trayMat = new THREE.MeshStandardMaterial({
      color: 0x1a365d,
      roughness: 0.25,
      metalness: 0.45,
    });
    const tray = new THREE.Mesh(trayOuterGeo, trayMat);
    tray.position.y = 1.35;
    tray.castShadow = !isSoftwareGl;
    trapGroup.add(tray);

    // Inner Water Surface in tray
    const trayWaterGeo = new THREE.CircleGeometry(0.47, 32);
    const trayWaterMat = new THREE.MeshStandardMaterial({
      color: 0x3182ce,
      roughness: 0.04,
      metalness: 0.9,
      transparent: true,
      opacity: 0.88,
    });
    const trayWater = new THREE.Mesh(trayWaterGeo, trayWaterMat);
    trayWater.rotation.x = -Math.PI / 2;
    trayWater.position.y = 1.43;
    trapGroup.add(trayWater);

    // Solenoid drain valve at bottom
    const valveGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.12, 12);
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.3 });
    const valve = new THREE.Mesh(valveGeo, brassMat);
    valve.position.set(0, 1.2, 0);
    trapGroup.add(valve);

    // Funnel Collector Cone (Corong pandu serangga)
    const funnelGeo = new THREE.ConeGeometry(0.48, 0.32, 32, 1, true);
    const funnelMat = new THREE.MeshStandardMaterial({
      color: 0xf7fafc,
      roughness: 0.2,
      metalness: 0.1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const funnel = new THREE.Mesh(funnelGeo, funnelMat);
    funnel.rotation.x = Math.PI;
    funnel.position.y = 1.63;
    trapGroup.add(funnel);

    // UV Light Chamber
    const strutGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.75, 12);
    const acrylicMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.45,
    });
    const strutRadius = 0.26;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const strut = new THREE.Mesh(strutGeo, acrylicMat);
      strut.position.set(Math.cos(a) * strutRadius, 2.62, Math.sin(a) * strutRadius);
      trapGroup.add(strut);
    }

    const capGeo = new THREE.CylinderGeometry(0.29, 0.29, 0.03, 24);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x2d3748, metalness: 0.7, roughness: 0.3 });
    const bottomCap = new THREE.Mesh(capGeo, capMat);
    bottomCap.position.y = 2.25;
    trapGroup.add(bottomCap);

    const topCap = new THREE.Mesh(capGeo, capMat);
    topCap.position.y = 3.0;
    trapGroup.add(topCap);

    // Dual UV Glowing Lamp Tubes
    const uvTubeGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.65, 16);
    const uvTubeMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x9333ea,
      emissiveIntensity: 2.8,
      roughness: 0.15,
    });

    const uvTube1 = new THREE.Mesh(uvTubeGeo, uvTubeMat);
    uvTube1.position.set(-0.035, 2.62, 0);
    trapGroup.add(uvTube1);

    const uvTube2 = new THREE.Mesh(uvTubeGeo, uvTubeMat);
    uvTube2.position.set(0.035, 2.62, 0);
    trapGroup.add(uvTube2);

    // Computer Vision Camera Module (OV5640 Mount)
    const camArmGroup = new THREE.Group();
    const armPoleGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.42, 8);
    const armPole = new THREE.Mesh(armPoleGeo, steelMat);
    armPole.rotation.z = Math.PI / 4;
    armPole.position.set(0.18, 0.12, 0);
    camArmGroup.add(armPole);

    const camBodyGeo = new THREE.BoxGeometry(0.08, 0.06, 0.06);
    const camBodyMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, metalness: 0.5, roughness: 0.4 });
    const camBody = new THREE.Mesh(camBodyGeo, camBodyMat);
    camBody.position.set(0.32, 0.26, 0);
    camBody.rotation.z = -Math.PI / 3;
    camArmGroup.add(camBody);

    const lensGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.03, 16);
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.9, roughness: 0.1 });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(0.31, 0.23, 0);
    lens.rotation.z = -Math.PI / 3;
    camArmGroup.add(lens);

    camArmGroup.position.set(0, 1.9, 0.15);
    trapGroup.add(camArmGroup);

    // Solar Panel 50Wp Assembly (15-degree tilt)
    const solarGroup = new THREE.Group();
    solarGroup.position.set(0, 3.65, 0);

    const bracketGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.16, 12);
    const bracket = new THREE.Mesh(bracketGeo, steelMat);
    bracket.position.y = 0.08;
    solarGroup.add(bracket);

    const panelFrameGeo = new THREE.BoxGeometry(0.88, 0.03, 0.68);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x718096,
      metalness: 0.9,
      roughness: 0.2,
    });
    const panelFrame = new THREE.Mesh(panelFrameGeo, frameMat);
    panelFrame.rotation.x = THREE.MathUtils.degToRad(15);
    panelFrame.position.y = 0.18;
    panelFrame.castShadow = !isSoftwareGl;
    solarGroup.add(panelFrame);

    // Solar Cell Canvas Texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0a192f';
      ctx.fillRect(0, 0, 512, 384);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      for (let x = 16; x < 512; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 384);
        ctx.stroke();
      }
      for (let y = 16; y < 384; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }
    }
    const solarTex = new THREE.CanvasTexture(canvas);
    solarTex.colorSpace = THREE.SRGBColorSpace;
    solarTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const cellMat = new THREE.MeshStandardMaterial({
      map: solarTex,
      metalness: 0.75,
      roughness: 0.15,
    });
    const solarCellsGeo = new THREE.PlaneGeometry(0.82, 0.62);
    const solarCells = new THREE.Mesh(solarCellsGeo, cellMat);
    solarCells.rotation.x = -Math.PI / 2 + THREE.MathUtils.degToRad(15);
    solarCells.position.set(0, 0.2, 0);
    solarGroup.add(solarCells);

    trapGroup.add(solarGroup);

    // Procedural Flying Insects (Moths & Planthoppers) with phototaxis spiral
    const insectCount = isMobile ? 22 : 50;
    const insectsList: typeof insectsRef.current = [];

    const insectBodyGeo = new THREE.CapsuleGeometry(0.015, 0.045, 4, 8);
    const mothMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.8 });
    const wingGeo = new THREE.ConeGeometry(0.025, 0.06, 3);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.3,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < insectCount; i++) {
      const insectMesh = new THREE.Group();

      const body = new THREE.Mesh(insectBodyGeo, mothMat);
      body.rotation.x = Math.PI / 2;
      insectMesh.add(body);

      const wingL = new THREE.Mesh(wingGeo, wingMat);
      wingL.position.set(-0.025, 0.01, 0);
      wingL.rotation.z = Math.PI / 3;
      wingL.scale.set(0.8, 1, 0.15);
      insectMesh.add(wingL);

      const wingR = new THREE.Mesh(wingGeo, wingMat);
      wingR.position.set(0.025, 0.01, 0);
      wingR.rotation.z = -Math.PI / 3;
      wingR.scale.set(0.8, 1, 0.15);
      insectMesh.add(wingR);

      const startAngle = Math.random() * Math.PI * 2;
      const startRadius = 1.2 + Math.random() * 3.0;
      const startHeight = 1.8 + Math.random() * 1.6;

      insectMesh.position.set(
        Math.cos(startAngle) * startRadius,
        startHeight,
        Math.sin(startAngle) * startRadius
      );
      scene.add(insectMesh);

      insectsList.push({
        mesh: insectMesh,
        wingL,
        wingR,
        angle: startAngle,
        radius: startRadius,
        initialRadius: startRadius,
        height: startHeight,
        speed: 0.85 + Math.random() * 0.9,
        spiralSpeed: 0.16 + Math.random() * 0.25,
        wobblePhase: Math.random() * Math.PI * 2,
        isTrapped: false,
        trappedTimer: 0,
      });
    }
    insectsRef.current = insectsList;

    // Animation Loop
    const clock = new THREE.Clock();
    let frameId = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      controls.update();

      // UV Light soft breathing pulse
      if (uvLightRef.current) {
        uvLightRef.current.intensity = 3.2 + Math.sin(elapsed * 4.0) * 0.25;
      }

      // Animate insect swarm
      insectsRef.current.forEach((ins) => {
        if (ins.isTrapped) {
          ins.trappedTimer += delta;
          ins.mesh.position.y -= delta * 0.04;
          if (ins.trappedTimer > 3.0) {
            ins.isTrapped = false;
            ins.trappedTimer = 0;
            ins.radius = 2.4 + Math.random() * 2.2;
            ins.height = 1.9 + Math.random() * 1.4;
            ins.angle = Math.random() * Math.PI * 2;
          }
          return;
        }

        const flap = Math.sin(elapsed * 45 * ins.speed) * 0.65;
        ins.wingL.rotation.z = Math.PI / 3 + flap;
        ins.wingR.rotation.z = -Math.PI / 3 - flap;

        ins.angle += ins.speed * delta * 0.85;
        const wobble = Math.sin(elapsed * 3 + ins.wobblePhase) * 0.15;

        // Spiral inward toward UV lamp
        ins.radius -= ins.spiralSpeed * delta * 0.24;
        ins.height += (2.65 - ins.height) * delta * 0.6;

        if (ins.radius < 0.28) {
          if (Math.random() > 0.45) {
            ins.isTrapped = true;
            ins.mesh.position.set(
              (Math.random() - 0.5) * 0.35,
              1.43,
              (Math.random() - 0.5) * 0.35
            );
            return;
          } else {
            ins.radius = 1.5 + Math.random() * 1.2;
          }
        }

        const x = Math.cos(ins.angle) * ins.radius;
        const z = Math.sin(ins.angle) * ins.radius;
        const y = ins.height + wobble;

        const nextAngle = ins.angle + 0.05;
        const nextX = Math.cos(nextAngle) * ins.radius;
        const nextZ = Math.sin(nextAngle) * ins.radius;
        ins.mesh.position.set(x, y, z);
        ins.mesh.lookAt(nextX, y, nextZ);
      });

      renderer.render(scene, camera);
    };

    frameId = requestAnimationFrame(animate);

    // Responsive Resize Handler
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);

      if (controlsRef.current) {
        controlsRef.current.target.set(0, 2.05, 0);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
        rendererRef.current.dispose();
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full cursor-grab active:cursor-grabbing select-none ${className}`}
    />
  );
};
