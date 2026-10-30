import * as mediabunny from './pinned-build/mediabunny.min.mjs';
import {registerMp3Encoder} from './pinned-build/isolated-encoder.mjs';
import {convertCandidate} from './adapter.mjs';

// One file per worker. The page owns lifetime, deadline and all native workers.
self.onmessage = async ({data: {file, mobile}}) => {
  self.onmessage = null;
  try {
    const result = await convertCandidate(file, {
      mediabunny, registerMp3Encoder, mobile,
      onStage: stage => self.postMessage({type: 'stage', stage}),
    });
    self.postMessage({type: 'result', result});
  } catch (error) {
    self.postMessage({type: 'failure', name: error.name, message: error.message});
  }
};
