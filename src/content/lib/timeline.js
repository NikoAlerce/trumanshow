// Master timeline of the finale (loops every 42 s)
//
//  0.0  "cue the sun": the dome lights up, Truman is at the EXIT door
//  2.8  the sky darkens; 3.0 a light opens between the painted clouds
//  4.4  Christof speaks in that light (Truman looks up):
//         TRUMAN. / I PAINTED THIS SKY FOR YOU. / OUT THERE, NOTHING IS TRUE. / STAY.
// 15.2  the light closes; Truman waves
// 16.2  a skywriter answers for him with smoke:
//         good morning, / and in case I don't see ya, / good afternoon, good evening, / and good night!
// 27.0  the bow
// 30.2  he turns and walks out through the EXIT into the darkness
// 35.0  the broadcast is cut: static in Christof's control room, ON AIR off
// 37.0  the studio lights go down

export const LOOP = 42;
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const ramp = (t, a, b) => smooth(clamp01((t - a) / (b - a)));
const window01 = (t, a, b, fin = 0.6, fout = 0.6) => ramp(t, a, a + fin) * (1 - ramp(t, b - fout, b));

// Christof's words [start, end]
const WORDS = [[4.4, 6.6], [6.8, 9.6], [9.8, 12.4], [12.6, 14.4]];
// skywriting: start, write duration, fade start, fade end
const SMOKE = [
  { start: 16.2, dur: 2.2, f0: 20.4, f1: 22.3 },
  { start: 18.8, dur: 3.0, f0: 23.6, f1: 25.8 },
  { start: 22.4, dur: 3.2, f0: 30.5, f1: 33.0 },
  { start: 26.0, dur: 2.2, f0: 31.5, f1: 34.0 },
];

export function createTimeline(THREE, { truman, skyVoice, uniforms, sun, hemi, roomCtl }) {
  const baseSun = sun.intensity;
  const baseHemi = hemi.intensity;
  const noon = sun.color.clone();
  const dusk = new THREE.Color(1.0, 0.50, 0.26);
  const nightSky = new THREE.Color(0.10, 0.16, 0.38);
  const daySky = hemi.color.clone();

  const studioLight = (t) => {
    let L = 1;
    if (t < 2.0) L = 0.1 + 0.9 * ramp(t, 0.0, 2.0);                       // cue the sun
    else if (t < 16.0) L = 1 - 0.45 * ramp(t, 2.8, 4.0) * (1 - ramp(t, 14.4, 16.0));   // Christof dims the dome
    else if (t >= 37.0) L = 1 - 0.9 * ramp(t, 37.0, 39.4);                // lights down
    return L;
  };

  let offset = 0;
  let last = 0;
  let frozen = null;
  const voice = { open: 0, christof: [0, 0, 0, 0], smoke: [null, null, null, null], plane: null };

  return {
    loop: LOOP,
    seek(t) { offset = t - last; },
    freeze(t) { frozen = t; },
    current() { return frozen !== null ? frozen : (((last + offset) % LOOP) + LOOP) % LOOP; },
    update(time) {
      last = time;
      const t = frozen !== null ? frozen : (((time + offset) % LOOP) + LOOP) % LOOP;

      // ---------------------------------------------------- the dome's light
      const L = studioLight(t);
      uniforms.uLight.value = 0.10 + 0.90 * L;
      sun.intensity = baseSun * L;
      hemi.intensity = baseHemi * (0.25 + 0.75 * L);
      const sunrise = t < 2.0 ? 1 - ramp(t, 0.6, 2.0) : 0;
      const sunset = t >= 37.0 ? ramp(t, 37.0, 38.6) : 0;
      sun.color.copy(noon).lerp(dusk, Math.max(sunrise, sunset) * 0.85);
      hemi.color.copy(daySky).lerp(nightSky, 1 - L);

      // ---------------------------------------------------- Christof in the sky
      voice.open = ramp(t, 3.0, 4.4) * (1 - ramp(t, 14.0, 15.2));
      for (let k = 0; k < WORDS.length; k++) voice.christof[k] = window01(t, WORDS[k][0], WORDS[k][1]);
      if (roomCtl.setMic) roomCtl.setMic(t >= 3.8 && t < 14.4 ? 1 : 0);

      // ---------------------------------------------------- Truman's answer, written in smoke
      voice.plane = null;
      SMOKE.forEach((s, k) => {
        const age = t - s.start;
        if (age < 0 || t > s.f1) { voice.smoke[k] = null; return; }
        voice.smoke[k] = { on: true, age, dur: s.dur, fade: ramp(t, s.f0, s.f1) };
      });
      SMOKE.forEach((s, k) => {
        const u = (t - s.start) / s.dur;
        if (!voice.plane && u > -0.08 && u < 1.08) {
          // the plane comes out of the depth of the painted sky and goes back into it
          voice.plane = { line: k, u, s: ramp(u, -0.08, 0.0) * (1 - ramp(u, 1.0, 1.08)) };
        }
      });
      skyVoice.update(voice, time);

      // ---------------------------------------------------- Truman
      const st = { clipTime: 0, bow: 0, walk: -1, turn: 0, visible: true, look: 0 };
      st.look = ramp(t, 3.4, 4.4) * (1 - ramp(t, 14.2, 15.2));
      if (t >= 15.6 && t < 20.87) st.clipTime = t - 15.6;
      else if (t >= 20.87) st.clipTime = 5.2;
      if (t >= 27.0 && t < 30.0) st.bow = t < 28.2 ? ramp(t, 27.0, 28.2) : (t < 28.8 ? 1 : 1 - ramp(t, 28.8, 30.0));
      if (t >= 30.2) st.turn = ramp(t, 30.2, 31.0);
      if (t >= 31.0 && t < 39.4) st.walk = clamp01((t - 31.0) / 3.5);
      if (t >= 39.4) { st.walk = -1; st.turn = 0; st.clipTime = 0; st.visible = t >= 40.2; }
      truman.setState(st);

      // ---------------------------------------------------- the broadcast
      const live = t >= 0.5 && t < 35.0;
      if (roomCtl.setSignal) roomCtl.setSignal(live ? 1 : 0, t);
    },
  };
}
