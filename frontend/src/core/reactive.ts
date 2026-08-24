type Effect = () => void;

let activeEffect: Effect | null = null;
const effectStack: Effect[] = [];

export interface Signal<T> {
  (): T;
  set(value: T): void;
  update(fn: (current: T) => T): void;
}

export function signal<T>(initial: T): Signal<T> {
  let value = initial;
  const subscribers = new Set<Effect>();

  const read = (() => {
    if (activeEffect) {
      subscribers.add(activeEffect);
    }
    return value;
  }) as Signal<T>;

  read.set = (next: T) => {
    if (Object.is(next, value)) return;
    value = next;
    for (const sub of [...subscribers]) sub();
  };

  read.update = (fn: (current: T) => T) => {
    read.set(fn(value));
  };

  return read;
}

/** Runs `fn` without registering any signal it reads as a dependency of the active effect. */
export function untrack<T>(fn: () => T): T {
  effectStack.push(null as unknown as Effect);
  activeEffect = null;
  try {
    return fn();
  } finally {
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1] ?? null;
  }
}

/** Runs `fn` immediately and re-runs it whenever any signal it read changes. */
export function effect(fn: Effect): () => void {
  const wrapped: Effect = () => {
    effectStack.push(wrapped);
    activeEffect = wrapped;
    try {
      fn();
    } finally {
      effectStack.pop();
      activeEffect = effectStack[effectStack.length - 1] ?? null;
    }
  };
  wrapped();
  return () => {
    // No explicit unsubscribe list per-signal; relying on GC of the effect closure
    // once callers stop referencing the returned disposer and the DOM node is removed.
  };
}

export function computed<T>(fn: () => T): Signal<T> {
  const internal = signal<T>(undefined as unknown as T);
  effect(() => internal.set(fn()));
  const read = (() => internal()) as Signal<T>;
  read.set = () => {
    throw new Error("cannot set a computed signal directly");
  };
  read.update = () => {
    throw new Error("cannot update a computed signal directly");
  };
  return read;
}
