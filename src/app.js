import {convertToMP3, validateInput} from './audio.js';
const form = document.querySelector('#tool-form');
const fileInput = document.querySelector('#file');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const download = document.querySelector('#download');
const preview = document.querySelector('#preview');
const cancel = document.querySelector('#cancel');
const progress = document.querySelector('#progress');
const submit = form.querySelector('[type=submit]');
const inputInfo = document.querySelector('#input-info');
const lang = document.documentElement.lang.split('-')[0];
const mobile = matchMedia('(max-width: 767px)').matches || navigator.maxTouchPoints > 0;
let messages;
try {
  messages = (await (await fetch('/assets/messages.json')).json())[lang];
} catch {
  status.textContent = {en:'Could not load. Reload the page.',pt:'Não foi possível carregar. Recarregue a página.',es:'No se pudo cargar. Recarga la página.'}[lang];
  submit.disabled = true;
}
let selected = null, controller = null, generation = 0, url = null;
const size = n => (n / 1024 ** 2).toLocaleString(lang,{maximumFractionDigits:2}) + ' MiB';
function invalidate() {
  generation++;
  controller?.abort();controller = null;
  preview.pause();preview.removeAttribute('src');preview.load();preview.hidden = true;
  if (url) URL.revokeObjectURL(url);url = null;
  download.hidden = true;download.removeAttribute('href');
  result.textContent = '';status.textContent = '';
  progress.hidden = true;cancel.hidden = true;submit.disabled = !messages;
}
function select(files) {
  invalidate();selected = null;inputInfo.textContent = '';
  if (!messages) return;
  if (files.length !== 1) {status.textContent = messages.one;return;}
  try {
    validateInput(files[0],mobile);selected = files[0];
    inputInfo.textContent = `${selected.name} · ${size(selected.size)}`;
  } catch (e) {status.textContent = messages[e.message] || messages.error;}
}
fileInput.addEventListener('change', () => select(fileInput.files));
const zone = document.querySelector('#drop-zone');
zone.addEventListener('dragover', e => {e.preventDefault();});
zone.addEventListener('drop', e => {e.preventDefault();fileInput.value = '';select(e.dataTransfer.files);});
cancel.addEventListener('click', () => {invalidate();status.textContent = messages.cancelled;});
window.addEventListener('pagehide', () => {invalidate();selected = null;fileInput.value = '';});
form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!messages || controller) return;
  invalidate();
  if (!selected) {status.textContent = messages.need;return;}
  const file = selected, mine = generation;
  const job = new AbortController();controller = job;
  submit.disabled = true;cancel.hidden = false;progress.hidden = false;
  try {
    const out = await convertToMP3(file, {signal:job.signal,mobile,onStage:stage => {
      if (mine === generation) status.textContent = messages[stage];
    }});
    if (mine !== generation || job.signal.aborted) return;
    url = URL.createObjectURL(out.blob);download.href = url;download.type = out.blob.type;
    download.download = (file.name.replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N} _-]/gu,'_').slice(0,90) || 'audio') + '.mp3';
    download.hidden = false;preview.src = url;preview.hidden = false;
    result.textContent = `${size(file.size)} → ${size(out.blob.size)} · ${out.duration.toFixed(1)} s · audio/mpeg`;
    status.textContent = messages.ready;
  } catch (error) {
    if (mine === generation) status.textContent = error?.name === 'AbortError' ? messages.cancelled : messages[error?.message] || messages.invalid;
  } finally {
    if (mine === generation) {controller = null;submit.disabled = false;cancel.hidden = true;progress.hidden = true;}
  }
});
