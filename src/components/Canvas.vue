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

const getGridPos = (clientX, clientY) => {
  const rect = canvasElem.value.getBoundingClientRect();
  const canvasX = clientX - rect.left;
  const canvasY = clientY - rect.top;

  // World-Koordinaten (unabhängig von Scale)
  const relX = canvasX / props.settings.camera.scale + props.settings.camera.x;
  const relY = canvasY / props.settings.camera.scale + props.settings.camera.y;

  const tile = currentConfig.value.tiles?.find((t) => t.id === props.selectedTileId);
  if (!tile) return null;

  if (tile.snapGrid) {
    const worldCellSizeX = currentConfig.value.x * 2;
    const worldCellSizeY = currentConfig.value.y * 2;
    return {
      x: Math.floor(relX / worldCellSizeX) * worldCellSizeX,
      y: Math.floor(relY / worldCellSizeY) * worldCellSizeY,
    };
  } else {
    return {
      x: Math.floor(relX / 2) * 2,
      y: Math.floor(relY / 2) * 2,
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
  if (!tile || !tile.src) return;

  const pos = mouseGridPos;
  if (!pos) return;

  const tileWidth = Math.floor(tile.width * props.settings.camera.scale * 2);
  const tileHeight = Math.floor(tile.height * props.settings.camera.scale * 2);

  const screenX = Math.floor((pos.x - props.settings.camera.x) * props.settings.camera.scale);
  const screenY = Math.floor((pos.y - props.settings.camera.y) * props.settings.camera.scale);

  ctx.save();

  const centerX = screenX + tileWidth / 2;
  const centerY = screenY + tileHeight / 2;
  ctx.translate(centerX, centerY);

  if (tile.rotation) {
    ctx.rotate((tile.rotation * Math.PI) / 180);
  }

  const scaleX = tile.mirrored?.x ? -1 : 1;
  const scaleY = tile.mirrored?.y ? -1 : 1;
  ctx.scale(scaleX, scaleY);

  const img = getOrLoadImage(tile.src);
  if (img.complete) {
    ctx.drawImage(img, -tileWidth / 2, -tileHeight / 2, tileWidth, tileHeight);
  }

  // Zeichne Hitboxes
  if (props.settings.showHitboxes && tile.hitboxes) {
    const cellWidth = tileWidth / tile.width;
    const cellHeight = tileHeight / tile.height;

    ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
    ctx.lineWidth = 1;

    tile.hitboxes.forEach((row, y) => {
      row.forEach((isHitbox, x) => {
        if (isHitbox) {
          const hx = -tileWidth / 2 + x * cellWidth;
          const hy = -tileHeight / 2 + y * cellHeight;
          ctx.strokeRect(hx, hy, cellWidth, cellHeight);
        }
      });
    });
  }

  ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(-tileWidth / 2, -tileHeight / 2, tileWidth, tileHeight);

  ctx.restore();
};

const resizeCanvas = () => {
  canvas.width = canvasElem.value.clientWidth;
  canvas.height = canvasElem.value.clientHeight;

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
  if (!currentConfig.value.tiles) return;

  currentConfig.value.tiles.forEach((tile) => {
    if (!tile.src || !tile.positions || tile.positions.length === 0) return;

    // Skip wenn das Tile selbst hidden ist
    if (tile.hidden) return;

    // Prüfe ob der Tile in einem hidden Layer ist
    const tileLayer = currentConfig.value.layers?.find((layer) => layer.tileIds?.includes(tile.id));

    if (tileLayer?.hidden) return; // Skip wenn Layer hidden ist

    const img = getOrLoadImage(tile.src);
    if (!img.complete) return;

    tile.positions.forEach((pos) => {
      const tileWidth = Math.floor(tile.width * props.settings.camera.scale * 2);
      const tileHeight = Math.floor(tile.height * props.settings.camera.scale * 2);

      const screenX = Math.floor((pos.x - props.settings.camera.x) * props.settings.camera.scale);
      const screenY = Math.floor((pos.y - props.settings.camera.y) * props.settings.camera.scale);

      ctx.save();

      const centerX = screenX + tileWidth / 2;
      const centerY = screenY + tileHeight / 2;
      ctx.translate(centerX, centerY);

      if (tile.rotation) {
        ctx.rotate((tile.rotation * Math.PI) / 180);
      }

      const scaleX = tile.mirrored?.x ? -1 : 1;
      const scaleY = tile.mirrored?.y ? -1 : 1;
      ctx.scale(scaleX, scaleY);

      ctx.drawImage(img, -tileWidth / 2, -tileHeight / 2, tileWidth, tileHeight);

      // Zeichne Hitboxes
      if (props.settings.showHitboxes && tile.hitboxes) {
        const cellWidth = tileWidth / tile.width;
        const cellHeight = tileHeight / tile.height;

        ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
        ctx.lineWidth = 1;

        tile.hitboxes.forEach((row, y) => {
          row.forEach((isHitbox, x) => {
            if (isHitbox) {
              const hx = -tileWidth / 2 + x * cellWidth;
              const hy = -tileHeight / 2 + y * cellHeight;
              ctx.strokeRect(hx, hy, cellWidth, cellHeight);
            }
          });
        });
      }

      ctx.restore();
    });
  });
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
