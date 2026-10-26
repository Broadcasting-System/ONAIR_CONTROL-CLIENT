import type { QueryClient, QueryKey } from "@tanstack/react-query";

/** 장비 조작 낙관적 업데이트의 되돌릴 자리 — onMutate 가 돌려주면 onError 의 세 번째 인자로 온다 */
export type Snapshot<T> = { prev: T | undefined };

/** onMutate 맨 앞에서 — 진행 중인 다시 읽기를 멈추고(고친 값을 덮지 않게) 고치기 전 캐시를 잡아 둔다 */
export async function snapshot<T>(qc: QueryClient, key: QueryKey): Promise<Snapshot<T>> {
  await qc.cancelQueries({ queryKey: key });
  return { prev: qc.getQueryData<T>(key) };
}

/** onError 에서 — 고치기 전 값으로 되돌리고 서버 값을 다시 읽는다.
 *  다시 읽기만 하면 서버까지 끊겼을 때(명령도 다시 읽기도 실패) 장비는 그대로인데 화면만 바뀐 채로 남는다 */
export function rollback<T>(qc: QueryClient, key: QueryKey, ctx?: Snapshot<T>) {
  if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev);
  void qc.invalidateQueries({ queryKey: key });
}
