// 다시 붙기 간격 모의 실험 (docs/reconnect.md) — node scripts/sim-reconnect-herd.mjs
// 화면 N개가 t=0 에 한꺼번에 끊기고 서버가 DOWN ms 뒤 돌아온다. 서버가 꺼져 있는 동안의 접속 시도는 바로 실패한다고 본다.
// 간격 계산은 src/lib/reconnectingSocket.ts 의 backoffDelay 와 같다.
const equal = (base, max) => (a, r) => {
  const c = Math.min(max, base * 2 ** a);
  return c / 2 + (r * c) / 2;
};
const full = (base, max) => (a, r) => r * Math.min(max, base * 2 ** a);

function run(N, DOWN, delay, seed = 7) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const tries = [];
  const back = [];
  for (let i = 0; i < N; i++) {
    let t = 0;
    let a = 0;
    for (;;) {
      t += delay(a++, rnd());
      tries.push(t);
      if (t >= DOWN) {
        back.push(t - DOWN);
        break;
      }
    }
  }
  const buckets = new Map();
  for (const t of tries) buckets.set(Math.floor(t / 100), (buckets.get(Math.floor(t / 100)) ?? 0) + 1);
  back.sort((x, y) => x - y);
  return {
    tries: tries.length,
    peakPer100ms: Math.max(...buckets.values()),
    recoverMedianS: +(back[N >> 1] / 1000).toFixed(1),
    recoverMaxS: +(back[N - 1] / 1000).toFixed(1),
  };
}

const policies = {
  "고정 3초 (전)": () => 3000,
  "equal 0.5~10초": equal(500, 10_000),
  "full 0.5~10초": full(500, 10_000),
  "equal 1~10초 (지금)": equal(1000, 10_000),
  "full 1~10초": full(1000, 10_000),
  "equal 1~30초": equal(1000, 30_000),
};
for (const down of [2000, 15_000, 60_000]) {
  console.log(`\n화면 300개, 서버 ${down / 1000}초 꺼짐`);
  console.table(Object.fromEntries(Object.entries(policies).map(([k, f]) => [k, run(300, down, f)])));
}
