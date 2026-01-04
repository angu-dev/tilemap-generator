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

  for (let x = 0; x <= canvas.width; x += currentConfig.value.x * 2) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += currentConfig.value.y * 2) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
    ctx.stroke();
  }
};

const drawPixels = () => {
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;

  for (let x = 0; x <= canvas.width; x += 2) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += 2) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
    ctx.stroke();
  }
};

const render = () => {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (props.settings.showGrid) drawGrid();
  if (props.settings.showPixels) drawPixels();
};

watch([currentConfig, props.settings], () => {
  render();
});

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
