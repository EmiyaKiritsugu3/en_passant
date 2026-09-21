import { enqueue } from "./queue";

// POST JSON to a coach Route Handler with one retry, throwing on failure.
export async function postCoachJson<T>(path: string, payload: unknown): Promise<T> {
  const doFetch = async (): Promise<T> => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  };

  try {
    return await doFetch();
  } catch {
    return await doFetch(); // retry 1x
  }
}

// postCoachJson with offline fallback: queue the payload and return local data.
export async function postCoachWithQueue<T>(
  path: string,
  payload: object,
  makeFallback: () => T
): Promise<T> {
  try {
    return await postCoachJson<T>(path, payload);
  } catch {
    enqueue(payload);
    return makeFallback();
  }
}
