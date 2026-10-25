import { compressImageToTarget } from './image.js';
const form = document.querySelector('#tool-form');
const fileInput = document.querySelector('#file');
const targetInput = document.querySelector('#target');
const output = document.querySelector('#result');
const status = document.querySelector('#status');
const download = document.querySelector('#download');
const btn = form.querySelector('button[type=submit]');
let currentURL = null;
let generation = 0;
let controller = null;
let busy = false;
const lang = document.documentElement.lang.split('-')[0];
const messages = {
  en: {need:'Choose an image first.',fail:'Could not process that file.',out:'Result',notReached:'Target not reached; this is the smallest output found.'},
  pt: {need:'Escolha uma imagem primeiro.',fail:'Não foi possível processar o arquivo.',out:'Resultado',notReached:'Limite não atingido; este é o menor resultado encontrado.'},
  es: {need:'Primero elige una imagen.',fail:'No se pudo procesar el archivo.',out:'Resultado',notReached:'No se alcanzó el límite; este es el resultado más pequeño.'}
}[lang];
function release() {
  if (currentURL) URL.revokeObjectURL(currentURL);
  currentURL = null;
  download.hidden = true;
  download.removeAttribute('href');
}
function invalidate() {
  generation++;
  controller?.abort();
  release();
  status.textContent = '';
  output.textContent = '';
}
fileInput.addEventListener('change', invalidate);
targetInput.addEventListener('input', invalidate);
window.addEventListener('pagehide', invalidate);
form.addEventListener('submit', async e => {
  e.preventDefault();
  if (busy) return; // Native canvas/decode work already running cannot be preempted.
  invalidate();
  const myGeneration = generation;
  const f = fileInput.files?.[0];
  if (!f) { status.textContent = messages.need; return; }
  const targetKB = Number(targetInput.value);
  if (!Number.isFinite(targetKB) || targetKB < 1 || targetKB > 20480) {status.textContent = messages.fail;return;}
  controller = new AbortController();
  busy = true;
  btn.disabled = true;
  status.textContent = form.dataset.working;
  try {
    const result = await compressImageToTarget(f, targetKB * 1024, {signal:controller.signal});
    if (myGeneration !== generation || controller.signal.aborted) return;
    currentURL = URL.createObjectURL(result.blob);
    download.href = currentURL;
    download.download = 'compressed-image.jpg';
    download.hidden = false;
    const format = n => Math.round(n / 1024).toLocaleString(lang) + ' KB';
    output.textContent = `${messages.out}: ${format(f.size)} → ${format(result.blob.size)}${result.reachedTarget ? '' : ' · ' + messages.notReached}`;
    status.textContent = '';
  } catch (error) {
    if (myGeneration === generation && error?.name !== 'AbortError') status.textContent = messages.fail;
  } finally {
    busy = false;
    btn.disabled = false;
    if (myGeneration === generation) controller = null;
  }
});
