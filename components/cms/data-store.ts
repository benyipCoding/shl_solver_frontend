// One store per authenticated CMS session. Never persist administrative data to disk.
export interface Resource<T> {
  data?: T;
  error: string | null;
  loading: boolean;
  query: string;
  updatedAt: number;
}

export class CmsStore {
  private resources = new Map<string, Resource<unknown>>();
  private listeners = new Set<() => void>();
  private pending = new Map<
    string,
    { query: string; promise: Promise<void> }
  >();
  private generations = new Map<string, number>();
  private views = new Map<string, unknown>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  get<T>(key: string): Resource<T> {
    if (!this.resources.has(key)) {
      this.resources.set(key, {
        loading: true,
        error: null,
        query: "",
        updatedAt: 0,
      });
    }
    return this.resources.get(key) as Resource<T>;
  }

  private publish<T>(key: string, resource: Resource<T>) {
    this.resources.set(key, resource);
    this.listeners.forEach((listener) => listener());
  }

  getView<T>(key: string, fallback: T): T {
    return (this.views.get(key) as T | undefined) ?? fallback;
  }

  setView<T>(key: string, value: T) {
    this.views.set(key, value);
  }

  invalidate() {
    // Ignore responses started before a mutation, including inactive lists.
    for (const [key, value] of this.resources) {
      this.generations.set(key, (this.generations.get(key) ?? 0) + 1);
      this.resources.set(key, { ...value, updatedAt: 0, loading: false });
    }
    this.pending.clear();
    this.listeners.forEach((listener) => listener());
  }

  load<T>(
    key: string,
    query: string,
    loader: () => Promise<T>,
    force = false,
  ): Promise<void> {
    const pending = this.pending.get(key);
    if (!force && pending?.query === query) return pending.promise;
    const current = this.get<T>(key);
    if (
      !force &&
      current.query === query &&
      Date.now() - current.updatedAt < 30_000
    ) {
      return Promise.resolve();
    }
    const generation = (this.generations.get(key) ?? 0) + 1;
    this.generations.set(key, generation);
    this.publish(key, { ...current, loading: true, error: null, query });
    const promise = Promise.resolve()
      .then(loader)
      .then((data) => {
        if (this.generations.get(key) !== generation) return;
        this.publish(key, {
          data,
          query,
          error: null,
          loading: false,
          updatedAt: Date.now(),
        });
      })
      .catch((error: unknown) => {
        if (this.generations.get(key) !== generation) return;
        this.publish(key, {
          ...this.get<T>(key),
          loading: false,
          updatedAt: 0,
          error: error instanceof Error ? error.message : "加载失败，请重试",
        });
      })
      .finally(() => {
        if (this.generations.get(key) === generation) this.pending.delete(key);
      });
    this.pending.set(key, { query, promise });
    return promise;
  }
}
