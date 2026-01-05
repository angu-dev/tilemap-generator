<script setup>
import { useConfigStore } from '@/stores/configs';
import { storeToRefs } from 'pinia';
import { onMounted, onUnmounted, useTemplateRef, watch } from 'vue';

const configs = useConfigStore();

const { currentConfig } = storeToRefs(configs);

const props = defineProps(['settings', 'selectedTileId']);

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

const getGridPos = (clientX, clientY) => {
  const rect = canvasElem.value.getBoundingClientRect();
  const canvasX = clientX - rect.left;
  const canvasY = clientY - rect.top;

  const relX = canvasX / props.settings.camera.scale + props.settings.camera.x;
  const relY = canvasY / props.settings.camera.scale + props.settings.camera.y;

  const tile = currentConfig.value.tiles?.find((t) => t.id === props.selectedTileId);
  if (!tile) return null;

  if (tile.snapGrid) {
    const stepX = currentConfig.value.x * 2;
    const stepY = currentConfig.value.y * 2;
    return {
      x: Math.floor(relX / stepX) * stepX,
      y: Math.floor(relY / stepY) * stepY,
    };
  } else {
    return {
      x: Math.round(relX / 2) * 2,
      y: Math.round(relY / 2) * 2,
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

const drawTilePreview = () => {
  if (!props.selectedTileId || !isMouseOver) return;
  const tile = currentConfig.value.tiles?.find((t) => t.id === props.selectedTileId);
  if (!tile || !tile.src || !mouseGridPos) return;

  const scale = props.settings.camera.scale;
  const tileWidth = Math.round(tile.width * 2 * scale);
  const tileHeight = Math.round(tile.height * 2 * scale);

  const screenX = Math.floor((mouseGridPos.x - props.settings.camera.x) * scale);
  const screenY = Math.floor((mouseGridPos.y - props.settings.camera.y) * scale);

  const dx = Math.floor(-tileWidth / 2) - 0.5;
  const dy = Math.floor(-tileHeight / 2) - 0.5;
  const dw = tileWidth + 1;
  const dh = tileHeight + 1;

  ctx.save();
  const centerX = screenX + tileWidth / 2;
  const centerY = screenY + tileHeight / 2;
  ctx.translate(centerX, centerY);

  if (tile.rotation) ctx.rotate((tile.rotation * Math.PI) / 180);
  ctx.scale(tile.mirrored?.x ? -1 : 1, tile.mirrored?.y ? -1 : 1);

  const img = getOrLoadImage(tile.src);
  if (img.complete) {
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  if (props.settings.showHitboxes && tile.hitboxes) {
    const cellW = dw / tile.width;
    const cellH = dh / tile.height;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
    ctx.lineWidth = 1;
    tile.hitboxes.forEach((row, y) => {
      row.forEach((isHitbox, x) => {
        if (isHitbox) {
          const hx = dx + x * cellW;
          const hy = dy + y * cellH;
          ctx.strokeRect(Math.floor(hx), Math.floor(hy), Math.ceil(cellW), Math.ceil(cellH));
        }
      });
    });
  }

  ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(dx, dy, dw, dh);
  ctx.restore();
};

const resizeCanvas = () => {
  dpr = window.devicePixelRatio || 1;
  const { clientWidth, clientHeight } = canvasElem.value;
  canvas.width = Math.round(clientWidth * dpr);
  canvas.height = Math.round(clientHeight * dpr);
  // zurück auf CSS-Size skalieren
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
};

const drawGrid = () => {
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;

  const cellWidth = currentConfig.value.x * 2 * props.settings.camera.scale;
  const cellHeight = currentConfig.value.y * 2 * props.settings.camera.scale;

  const worldCellWidth = currentConfig.value.x * 2;
  const worldCellHeight = currentConfig.value.y * 2;

  const offsetX = ((props.settings.camera.x % worldCellWidth) + worldCellWidth) % worldCellWidth;
  const offsetY = ((props.settings.camera.y % worldCellHeight) + worldCellHeight) % worldCellHeight;

  let x = -offsetX * props.settings.camera.scale;
  while (x <= canvas.width) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x), 0);
    ctx.lineTo(Math.round(x), canvas.height);
    ctx.stroke();
    x += cellWidth;
  }

  let y = -offsetY * props.settings.camera.scale;
  while (y <= canvas.height) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y));
    ctx.lineTo(canvas.width, Math.round(y));
    ctx.stroke();
    y += cellHeight;
  }
};

const drawPixels = () => {
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;

  const step = 2 * props.settings.camera.scale;
  const worldStep = 2;

  const offsetX = ((props.settings.camera.x % worldStep) + worldStep) % worldStep;
  const offsetY = ((props.settings.camera.y % worldStep) + worldStep) % worldStep;

  let x = -offsetX * props.settings.camera.scale;
  while (x <= canvas.width) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x), 0);
    ctx.lineTo(Math.round(x), canvas.height);
    ctx.stroke();
    x += step;
  }

  let y = -offsetY * props.settings.camera.scale;
  while (y <= canvas.height) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y));
    ctx.lineTo(canvas.width, Math.round(y));
    ctx.stroke();
    y += step;
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

      const tileWidth = Math.round(tile.width * 2 * scale);
      const tileHeight = Math.round(tile.height * 2 * scale);

      const dx = Math.floor(-tileWidth / 2) - 0.5;
      const dy = Math.floor(-tileHeight / 2) - 0.5;
      const dw = tileWidth + 1;
      const dh = tileHeight + 1;

      tile.positions.forEach((pos) => {
        const screenX = Math.floor((pos.x - props.settings.camera.x) * scale);
        const screenY = Math.floor((pos.y - props.settings.camera.y) * scale);

        ctx.save();
        const centerX = screenX + tileWidth / 2;
        const centerY = screenY + tileHeight / 2;
        ctx.translate(centerX, centerY);

        if (tile.rotation) ctx.rotate((tile.rotation * Math.PI) / 180);
        ctx.scale(tile.mirrored?.x ? -1 : 1, tile.mirrored?.y ? -1 : 1);

        ctx.drawImage(img, dx, dy, dw, dh);

        if (props.settings.showHitboxes && tile.hitboxes) {
          const cellW = dw / tile.width;
          const cellH = dh / tile.height;
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
          ctx.lineWidth = 1;
          tile.hitboxes.forEach((row, y) => {
            row.forEach((isHitbox, x) => {
              if (isHitbox) {
                const hx = dx + x * cellW;
                const hy = dy + y * cellH;
                ctx.strokeRect(Math.floor(hx), Math.floor(hy), Math.ceil(cellW), Math.ceil(cellH));
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
  if (props.selectedTileId) drawTilePreview();
};

const handleCanvasMouseDown = (event) => {
  if (!props.selectedTileId) return;
  isDrawing = true;
  lastDrawnPos = null;
  paintMode = null;

  const pos = getGridPos(event.clientX, event.clientY);
  if (pos) {
    const tile = currentConfig.value.tiles?.find((t) => t.id === props.selectedTileId);
    if (tile) {
      const existingIndex = tile.positions?.findIndex((p) => p.x === pos.x && p.y === pos.y) ?? -1;
      paintMode = existingIndex !== -1 ? 'remove' : 'add';
    }

    placeOrRemoveTile(pos);
    lastDrawnPos = { x: pos.x, y: pos.y };
  }
};

const handleCanvasMouseUp = () => {
  isDrawing = false;
  lastDrawnPos = null;
  paintMode = null;
};

const handleCanvasMouseMove = (event) => {
  lastMouseEvent = event;

  const pos = getGridPos(event.clientX, event.clientY);

  if (pos) {
    mouseGridPos = pos;
  }

  // Wenn gedrückt und die Position hat sich geändert -> Tile platzieren
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
