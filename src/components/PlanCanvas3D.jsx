import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PlanEngine } from '../lib/br-engine/index.js';

export default function PlanCanvas3D({ data, rotation, zoom, planHelpers, numberValue }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xedf5f1, 1);
    mount.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 100);
    camera.position.set(4.6, 3.2, 5.2);
    camera.lookAt(0, 0.8, 0);
    camera.zoom = Math.max(0.75, Math.min(1.25, Number(zoom) / 100));
    camera.updateProjectionMatrix();

    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const light = new THREE.DirectionalLight(0xffffff, 2.2);
    light.position.set(4, 8, 6);
    scene.add(light);

    const grid = new THREE.GridHelper(9, 18, 0xbdd8ce, 0xd8e7df);
    grid.position.y = -0.02;
    scene.add(grid);

    const group = new THREE.Group();
    group.rotation.x = -0.12;
    group.rotation.y = THREE.MathUtils.degToRad(Number(rotation) || 0);
    scene.add(group);

    const items = PlanEngine.planItemsFromForm(data, planHelpers);
    const totalWidth = items.reduce((sum, item) => sum + Math.max(item.ancho, 1) / 100, 0);
    let cursor = -totalWidth / 2;

    items.forEach((item, index) => {
      const width = Math.max(0.12, item.ancho / 100);
      const height = Math.max(0.12, item.alto / 100);
      const depth = Math.max(0.08, (item.fondo || 8) / 100);
      const geometry = new THREE.BoxGeometry(width, height, depth);
      const itemColor = item.forma === 'Vidrio'
        ? 0xc9eef2
        : item.forma === 'Marco / riel'
          ? 0x8fa4a0
          : item.forma === 'Cajón'
            ? 0xd69b63
            : item.forma === 'Puerta'
              ? 0xe9bd80
              : (index % 2 ? 0xf0c98f : 0xf6dfb5);
      const material = new THREE.MeshStandardMaterial({
        color: data.giro === 'Vidriería' ? (item.forma === 'Vidrio' ? 0xc9eef2 : 0xa8bbb7) : itemColor,
        roughness: 0.58,
        metalness: data.giro === 'Vidriería' ? 0.14 : 0.04,
        transparent: item.forma === 'Vidrio',
        opacity: item.forma === 'Vidrio' ? 0.48 : 1,
      });
      const mesh = new THREE.Mesh(geometry, material);
      const hasCustomPosition = item.posX !== '' || item.posY !== '' || item.posZ !== '';
      mesh.position.set(
        hasCustomPosition ? numberValue(item.posX) / 100 : cursor + width / 2,
        hasCustomPosition ? Math.max(0.02, numberValue(item.posY) / 100) : height / 2,
        hasCustomPosition ? numberValue(item.posZ) / 100 : 0,
      );
      group.add(mesh);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: data.giro === 'Vidriería' ? 0x2b7580 : 0x5f4630 }),
      );
      edges.position.copy(mesh.position);
      group.add(edges);

      if (!hasCustomPosition) cursor += width + 0.16;
    });

    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    group.position.x -= center.x;

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      const safeWidth = Math.max(320, width);
      const safeHeight = Math.max(280, height);
      renderer.setSize(safeWidth, safeHeight, false);
      const aspect = safeWidth / safeHeight;
      camera.left = -3.8 * aspect;
      camera.right = 3.8 * aspect;
      camera.top = 3;
      camera.bottom = -3;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    let dragging = false;
    let lastX = 0;
    const render = () => renderer.render(scene, camera);
    const onPointerDown = (event) => {
      dragging = true;
      lastX = event.clientX;
      renderer.domElement.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event) => {
      if (!dragging) return;
      group.rotation.y += (event.clientX - lastX) * 0.01;
      lastX = event.clientX;
      render();
    };
    const onPointerUp = () => {
      dragging = false;
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointerleave', onPointerUp);

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    return () => {
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerleave', onPointerUp);
      renderer.dispose();
      mount.replaceChildren();
    };
  }, [data, rotation, zoom, planHelpers, numberValue]);

  return (
    <div className="plan-canvas-3d" ref={mountRef} role="img" aria-label="Modelo 3D editable del plano">
      <span>Cargando vista 3D</span>
    </div>
  );
}
