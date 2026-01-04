<script setup>
import { useConfigStore } from '@/stores/configs';
import { storeToRefs } from 'pinia';
import { onMounted, onUnmounted, useTemplateRef, watch } from 'vue';

const configs = useConfigStore();

const { currentConfig } = storeToRefs(configs);

const props = defineProps(['settings']);

const canvasElem = useTemplateRef('canvas-elem');

let canvas = null;
let ctx = null;

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

  const offsetX = ((props.settings.camera.x % cellWidth) + cellWidth) % cellWidth;
  const offsetY = ((props.settings.camera.y % cellHeight) + cellHeight) % cellHeight;

  let x = -offsetX;
  while (x <= canvas.width) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, canvas.height);
    ctx.stroke();
    x += cellWidth;
  }

  let y = -offsetY;
  while (y <= canvas.height) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(canvas.width, Math.round(y) + 0.5);
    ctx.stroke();
    y += cellHeight;
  }
};

const drawPixels = () => {
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;

  const step = 2 * props.settings.camera.scale;

  const offsetX = ((props.settings.camera.x % step) + step) % step;
  const offsetY = ((props.settings.camera.y % step) + step) % step;

  for (let x = -offsetX; x <= canvas.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, canvas.height);
    ctx.stroke();
  }

  for (let y = -offsetY; y <= canvas.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(canvas.width, Math.round(y) + 0.5);
    ctx.stroke();
  }
};

const render = () => {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (props.settings.showGrid) drawGrid();
  if (props.settings.showPixels) drawPixels();
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

onMounted(() => {
  canvas = canvasElem.value;
  ctx = canvas.getContext('2d');

  resizeCanvas();

  window.addEventListener('resize', resizeCanvas);
});

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas);
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
