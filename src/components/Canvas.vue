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

  const cellWidth = currentConfig.value.x * 2 * props.settings.scale;
  const cellHeight = currentConfig.value.y * 2 * props.settings.scale;

  const startX = Math.floor(props.settings.camera.x / cellWidth) * cellWidth - props.settings.camera.x;
  const startY = Math.floor(props.settings.camera.y / cellHeight) * cellHeight - props.settings.camera.y;

  for (let x = startX; x <= canvas.width + props.settings.camera.x; x += cellWidth) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }

  for (let y = startY; y <= canvas.height + props.settings.camera.y; y += cellHeight) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
    ctx.stroke();
  }
};

const drawPixels = () => {
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;

  for (let x = 0; x <= canvas.width; x += 2 * props.settings.scale) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += 2 * props.settings.scale) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
    ctx.stroke();
  }
};

const render = () => {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  //   ctx.save();
  //   ctx.translate(props.settings.camera.x, props.settings.camera.y);

  if (props.settings.showGrid) drawGrid();
  if (props.settings.showPixels) drawPixels();

  //   ctx.restore();
};

watch(
  [currentConfig, props.settings],
  () => {
    render();

    console.log(props.settings.camera);
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
