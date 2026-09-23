export type AmbientAudio = { stop: () => Promise<void> };

export async function startAmbientAudio(): Promise<AmbientAudio> {
  const AudioContextClass = window.AudioContext;
  const context = new AudioContextClass();
  await context.resume();

  const seconds = 3;
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const output = buffer.getChannelData(0);
  let b0 = 0; let b1 = 0; let b2 = 0; let b3 = 0; let b4 = 0; let b5 = 0; let b6 = 0;
  for (let index = 0; index < output.length; index += 1) {
    const white = Math.random() * 2 - 1;
    b0 = .99886 * b0 + white * .0555179;
    b1 = .99332 * b1 + white * .0750759;
    b2 = .969 * b2 + white * .153852;
    b3 = .8665 * b3 + white * .3104856;
    b4 = .55 * b4 + white * .5329522;
    b5 = -.7616 * b5 - white * .016898;
    output[index] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * .5362) * .075;
    b6 = white * .115926;
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  source.loop = true;
  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.Q.value = .35;
  gain.gain.value = .045;
  source.connect(filter).connect(gain).connect(context.destination);
  source.start();

  return {
    stop: async () => {
      try { source.stop(); } catch { /* already stopped */ }
      await context.close().catch(() => undefined);
    },
  };
}