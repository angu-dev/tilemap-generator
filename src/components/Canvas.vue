<script setup>
import { useConfigStore } from '@/stores/configs';
import { storeToRefs } from 'pinia';
import { onMounted, onUnmounted, useTemplateRef, watch } from 'vue';

const configs = useConfigStore();

const { currentConfig } = storeToRefs(configs);

const props = defineProps(['settings', 'selectedTileId', 'eraserActive']);

const canvasElem = useTemplateRef('canvas-elem');

const imageCache = new Map();

let mouseGridPos = { x: 0, y: 0 };
let lastMouseEvent = null;
let canvas = null;
let ctx = null;
let isDrawing = false;
let lastDrawnPos = null;
let paintMode = null;
let isMouseOver = false;
let dpr = window.devicePixelRatio || 1;
let isErasing = false;

const getGridPos = (clientX, clientY) => {
  const rect = canvasElem.value.getBoundingClientRect();
  const canvasX = clientX - rect.left;
  const canvasY = clientY - rect.top;

  const relX = canvasX / props.settings.camera.scale + props.settings.camera.x;
  const relY = canvasY / props.settings.camera.scale + props.settings.camera.y;

  if (props.eraserActive) {
    // Nutze exakte Weltkoordinaten fürs Hit-Testing, aber merke Pixel für den Cursor
    return { x: relX, y: relY, drawX: Math.floor(relX), drawY: Math.floor(relY) };
  }

  const tile = currentConfig.value.tiles?.find((t) => t.id === props.selectedTileId);
  if (!tile) return null;

  if (tile.snapGrid) {
    const stepX = currentConfig.value.x;
    const stepY = currentConfig.value.y;
    return {
      x: Math.floor(relX / stepX) * stepX,
      y: Math.floor(relY / stepY) * stepY,
    };
  } else {
    return {
      x: Math.round(relX),
      y: Math.round(relY),
    };
  }
};

const getOrLoadImage = (src) => {
  if (imageCache.has(src)) return imageCache.get(src);

  const img = new Image();
  img.src = src;
  img.onload = () => {
    render();
  };
  imageCache.set(src, img);
  return img;
};

const eraseAt = (point) => {
  const cfg = currentConfig.value;
  if (!cfg?.layers?.length || !cfg?.tiles?.length) return false;

  for (let li = cfg.layers.length - 1; li >= 0; li--) {
    const layer = cfg.layers[li];
    if (layer.hidden || !layer.tileIds?.length) continue;

    for (let ti = layer.tileIds.length - 1; ti >= 0; ti--) {
      const tile = cfg.tiles.find((t) => t.id === layer.tileIds[ti]);
      if (!tile || tile.hidden || !tile.positions?.length) continue;

      const idx = tile.positions.findIndex((p) => point.x >= p.x && point.x < p.x + tile.width && point.y >= p.y && point.y < p.y + tile.height);

      if (idx !== -1) {
        tile.positions.splice(idx, 1);
        configs.update();
        return true;
      }
    }
  }
  return false;
};

const drawEraserCursor = () => {
  if (!props.eraserActive || !isMouseOver || !mouseGridPos) return;
  const scale = props.settings.camera.scale;
  const size = 1 * scale;
  const baseX = mouseGridPos.drawX ?? mouseGridPos.x;
  const baseY = mouseGridPos.drawY ?? mouseGridPos.y;
  const screenX = (baseX - props.settings.camera.x) * scale;
  const screenY = (baseY - props.settings.camera.y) * scale;
  ctx.save();
  ctx.strokeStyle = 'rgba(150, 150, 255, 0.8)';
  ctx.fillStyle = 'rgba(150, 150, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.fillRect(screenX, screenY, size, size);
  ctx.strokeRect(screenX, screenY, size, size);
  ctx.restore();
};

const drawTilePreview = () => {
  if (props.eraserActive) return;
  if (!props.selectedTileId || !isMouseOver) return;
  const tile = currentConfig.value.tiles?.find((t) => t.id === props.selectedTileId);
  if (!tile || !tile.src || !mouseGridPos) return;

  const scale = props.settings.camera.scale;
  const tileWidth = tile.width * scale;
  const tileHeight = tile.height * scale;

  const screenX = (mouseGridPos.x - props.settings.camera.x) * scale;
  const screenY = (mouseGridPos.y - props.settings.camera.y) * scale;

  const dx = -tileWidth / 2;
  const dy = -tileHeight / 2;
  const dw = tileWidth;
  const dh = tileHeight;

  ctx.save();
  ctx.translate(screenX + tileWidth / 2, screenY + tileHeight / 2);

  if (tile.rotation) ctx.rotate((tile.rotation * Math.PI) / 180);
  ctx.scale(tile.mirrored?.x ? -1 : 1, tile.mirrored?.y ? -1 : 1);

  const img = getOrLoadImage(tile.src);
  if (img.complete) ctx.drawImage(img, dx, dy, dw, dh);

  if (props.settings.showHitboxes && tile.hitboxes) {
    const cellW = dw / tile.width;
    const cellH = dh / tile.height;
    const inset = Math.min(0.5, Math.min(cellW, cellH) * 0.2);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    tile.hitboxes.forEach((row, y) => {
      row.forEach((isHitbox, x) => {
        if (isHitbox) {
          const hx = dx + x * cellW;
          const hy = dy + y * cellH;
          ctx.fillRect(hx + inset, hy + inset, cellW - inset * 2, cellH - inset * 2);
        }
      });
    });
  }

  ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(dx, dy, dw, dh);
  ctx.restore();
};

const resizeCanvas = () => {
  dpr = window.devicePixelRatio || 1;
  const { clientWidth, clientHeight } = canvasElem.value;
  canvas.width = Math.round(clientWidth * dpr);
  canvas.height = Math.round(clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineWidth = 1;
  render();
};

const drawGrid = () => {
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;

  const scale = props.settings.camera.scale;
  const cellW = currentConfig.value.x * scale;
  const cellH = currentConfig.value.y * scale;

  const worldW = currentConfig.value.x;
  const worldH = currentConfig.value.y;

  const offX = ((props.settings.camera.x % worldW) + worldW) % worldW;
  const offY = ((props.settings.camera.y % worldH) + worldH) % worldH;

  for (let x = -offX * scale; x <= canvas.width; x += cellW) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = -offY * scale; y <= canvas.height; y += cellH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(0 + canvas.width, y);
    ctx.stroke();
  }
};

const drawPixels = () => {
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;

  const scale = props.settings.camera.scale;
  const step = 1 * scale;
  const worldStep = 1;

  const offX = ((props.settings.camera.x % worldStep) + worldStep) % worldStep;
  const offY = ((props.settings.camera.y % worldStep) + worldStep) % worldStep;

  for (let x = -offX * scale; x <= canvas.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = -offY * scale; y <= canvas.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
};

const drawPlacedTiles = () => {
  const cfg = currentConfig.value;
  if (!cfg?.layers?.length || !cfg?.tiles?.length) return;

  const scale = props.settings.camera.scale;

  for (const layer of cfg.layers) {
    if (layer.hidden || !layer.tileIds?.length) continue;

    for (const tileId of layer.tileIds) {
      const tile = cfg.tiles.find((t) => t.id === tileId);
      if (!tile || tile.hidden || !tile.src || !tile.positions?.length) continue;

      const img = getOrLoadImage(tile.src);
      if (!img.complete) continue;

      const tileWidth = tile.width * scale;
      const tileHeight = tile.height * scale;

      const dx = -tileWidth / 2;
      const dy = -tileHeight / 2;
      const dw = tileWidth;
      const dh = tileHeight;

      tile.positions.forEach((pos) => {
        const screenX = (pos.x - props.settings.camera.x) * scale;
        const screenY = (pos.y - props.settings.camera.y) * scale;

        ctx.save();
        ctx.translate(screenX + tileWidth / 2, screenY + tileHeight / 2);

        if (tile.rotation) ctx.rotate((tile.rotation * Math.PI) / 180);
        ctx.scale(tile.mirrored?.x ? -1 : 1, tile.mirrored?.y ? -1 : 1);

        ctx.drawImage(img, dx, dy, dw, dh);

        if (props.settings.showHitboxes && tile.hitboxes) {
          const cellW = dw / tile.width;
          const cellH = dh / tile.height;
          const inset = Math.min(0.5, Math.min(cellW, cellH) * 0.2);
          ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
          tile.hitboxes.forEach((row, y) => {
            row.forEach((isHitbox, x) => {
              if (isHitbox) {
                const hx = dx + x * cellW;
                const hy = dy + y * cellH;
                ctx.fillRect(hx + inset, hy + inset, cellW - inset * 2, cellH - inset * 2);
              }
            });
          });
        }

        ctx.restore();
      });
    }
  }
};

const render = () => {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (props.settings.showGrid) drawGrid();
  if (props.settings.showPixels) drawPixels();

  drawPlacedTiles();
  if (props.selectedTileId && !props.eraserActive) drawTilePreview();
  if (props.eraserActive) drawEraserCursor();
};

const handleCanvasMouseDown = (event) => {
  if (!props.selectedTileId && !props.eraserActive) return;
  isDrawing = false;
  isErasing = false;
  lastDrawnPos = null;
  paintMode = null;

  const pos = getGridPos(event.clientX, event.clientY);
  if (!pos) return;

  if (props.eraserActive) {
    isErasing = true;
    eraseAt(pos);
    lastDrawnPos = { ...pos };
    render();
    return;
  }

  isDrawing = true;
  const tile = currentConfig.value.tiles?.find((t) => t.id === props.selectedTileId);
  if (tile) {
    const existingIndex = tile.positions?.findIndex((p) => p.x === pos.x && p.y === pos.y) ?? -1;
    paintMode = existingIndex !== -1 ? 'remove' : 'add';
  }

  placeOrRemoveTile(pos);
  lastDrawnPos = { x: pos.x, y: pos.y };
};

const handleCanvasMouseUp = () => {
  isDrawing = false;
  isErasing = false;
  lastDrawnPos = null;
  paintMode = null;
};

const handleCanvasMouseMove = (event) => {
  lastMouseEvent = event;

  const pos = getGridPos(event.clientX, event.clientY);
  if (pos) mouseGridPos = pos;

  if (props.eraserActive && isErasing && pos) {
    if (!lastDrawnPos || lastDrawnPos.x !== pos.x || lastDrawnPos.y !== pos.y) {
      eraseAt(pos);
      lastDrawnPos = { ...pos };
    }
    render();
    return;
  }

  if (isDrawing && props.selectedTileId && pos) {
    if (!lastDrawnPos || lastDrawnPos.x !== pos.x || lastDrawnPos.y !== pos.y) {
      placeOrRemoveTile(pos);
      lastDrawnPos = { x: pos.x, y: pos.y };
    }
  }

  render();
};

const placeOrRemoveTile = (pos) => {
  if (!props.selectedTileId) return;

  const tile = currentConfig.value.tiles?.find((t) => t.id === props.selectedTileId);
  if (!tile) return;

  if (!tile.positions) tile.positions = [];

  const existingIndex = tile.positions.findIndex((p) => p.x === pos.x && p.y === pos.y);
  const exists = existingIndex !== -1;

  // Nutze paintMode statt zu togglen
  if (paintMode === 'add' && !exists) {
    tile.positions.push({ x: pos.x, y: pos.y });
  } else if (paintMode === 'remove' && exists) {
    tile.positions.splice(existingIndex, 1);
  }

  configs.update();
};

const handleCanvasMouseEnter = () => {
  isMouseOver = true;
};

const handleCanvasMouseLeave = () => {
  isMouseOver = false;
  render();
};

watch(
  [currentConfig, props.settings],
  () => {
    render();
  },
  {
    deep: true,
  },
);

watch(
  () => [props.settings.camera.x, props.settings.camera.y, props.settings.camera.scale],
  () => {
    if (lastMouseEvent) {
      const pos = getGridPos(lastMouseEvent.clientX, lastMouseEvent.clientY);
      if (pos) {
        mouseGridPos = pos;
      }
    }
    render();
  },
);

onMounted(() => {
  canvas = canvasElem.value;
  ctx = canvas.getContext('2d');

  resizeCanvas();

  window.addEventListener('resize', resizeCanvas);
  canvas.addEventListener('mousedown', handleCanvasMouseDown);
  canvas.addEventListener('mousemove', handleCanvasMouseMove);
  canvas.addEventListener('mouseup', handleCanvasMouseUp);
  canvas.addEventListener('mouseenter', handleCanvasMouseEnter);
  canvas.addEventListener('mouseleave', handleCanvasMouseLeave);
});

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas);
  canvas.removeEventListener('mousedown', handleCanvasMouseDown);
  canvas.removeEventListener('mousemove', handleCanvasMouseMove);
  canvas.removeEventListener('mouseup', handleCanvasMouseUp);
  canvas.removeEventListener('mouseenter', handleCanvasMouseEnter);
  canvas.removeEventListener('mouseleave', handleCanvasMouseLeave);
});
</script>

<template>
  <canvas ref="canvas-elem"></canvas>
</template>

<style lang="scss" scoped>
@use '@/styles/variables';

canvas {
  background-color: variables.$dark;
  height: 100%;
  width: 100%;
}
</style>
