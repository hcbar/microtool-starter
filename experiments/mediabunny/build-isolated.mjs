// Local/CI-only packaging from the already verified immutable upstream checkout.
// Change only worker ownership/packaging, not encoder/decoder/LAME source.
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
const [upstreamArg, outputArg] = process.argv.slice(2);
if (!upstreamArg || !outputArg) throw Error('Expected upstream checkout and ephemeral output directory');
const upstream = resolve(upstreamArg), outdir = resolve(outputArg);
const {build} = await import(pathToFileURL(join(upstream, 'node_modules/esbuild/lib/main.js')));
await build({
  entryPoints: [join(upstream, 'packages/mp3-encoder/src/encode.worker.ts')],
  outfile: join(outdir, 'encode.worker.js'), bundle: true, format: 'esm',
  target: 'es2017', define: {'import.meta.url': '""'},
});
await build({
  entryPoints: [join(upstream, 'packages/mp3-encoder/src/index.ts')],
  outfile: join(outdir, 'isolated-encoder.mjs'), bundle: true, format: 'esm',
  plugins: [{name: 'page-owned-encoder-worker', setup(build) {
    build.onResolve({filter: /^mediabunny$/}, () => ({path: './mediabunny.min.mjs', external: true}));
    build.onResolve({filter: /encode\.worker$/}, () => ({path: 'page-owned-worker', namespace: 'factory'}));
    build.onLoad({filter: /.*/, namespace: 'factory'}, () => ({
      contents: "export {createEncoderWorker as default} from '../worker-bridge.mjs';", loader: 'js',
    }));
    build.onResolve({filter: /^\.\.\/worker-bridge\.mjs$/}, () => ({path: '../worker-bridge.mjs', external: true}));
  }}],
});
