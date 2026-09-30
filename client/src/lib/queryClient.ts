import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function authHeaders(hasJsonBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (hasJsonBody) headers["Content-Type"] = "application/json";
  return headers;
}

/** Supports both (method, url, data) and legacy (url, method, data) call sites. */
export async function apiRequest(
  methodOrUrl: string,
  urlOrMethod: string,
  data?: unknown | undefined,
): Promise<Response> {
  let method: string;
  let url: string;
  if (methodOrUrl.startsWith("/") || methodOrUrl.startsWith("http")) {
    url = methodOrUrl;
    method = urlOrMethod;
  } else {
    method = methodOrUrl;
    url = urlOrMethod;
  }

  const res = await fetch(url, {
    method,
    headers: authHeaders(data !== undefined),
    body: data !== undefined ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      headers: authHeaders(false),
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
