// 安全 JSON 序列化：对 Error/Map/Set/BigInt 等特殊对象做可读化处理，并避免循环引用崩溃。
type SafeJsonOptions = {
  space?: number;
};

// Error 对象默认不可完整序列化，转换成稳定可读结构。
function toErrorLike(value: unknown): Record<string, unknown> | null {
  if (!(value instanceof Error)) return null;
  const anyErr = value as any;
  return {
    name: value.name,
    message: value.message,
    stack: typeof value.stack === "string" ? value.stack : undefined,
    cause: anyErr?.cause,
    code: anyErr?.code,
  };
}

// 处理 JSON.stringify 不友好的内建对象类型。
function toSpecialObject(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : "InvalidDate";
  if (value instanceof RegExp) return value.toString();
  if (value instanceof Map) return { __type: "Map", entries: Array.from(value.entries()) };
  if (value instanceof Set) return { __type: "Set", values: Array.from(value.values()) };
  return value;
}

// 在调试场景下安全序列化任意对象，避免循环引用或特殊类型导致崩溃。
export function safeJsonStringify(value: unknown, options: SafeJsonOptions = {}): string {
  const seen = new WeakSet<object>();
  const space = typeof options.space === "number" ? options.space : 2;
  try {
    return JSON.stringify(
      value,
      (_key, v) => {
        if (typeof v === "bigint") return `${v}n`;
        if (typeof v === "function") return `[Function ${v.name || "anonymous"}]`;
        if (typeof v === "symbol") return v.toString();
        const errLike = toErrorLike(v);
        if (errLike) return errLike;
        const special = toSpecialObject(v);
        if (special && typeof special === "object") {
          const obj = special as object;
          // 循环结构输出占位符，避免 stringify 抛错。
          if (seen.has(obj)) return "[Circular]";
          seen.add(obj);
        }
        return special;
      },
      space
    );
  } catch (e) {
    const err = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return `\"[Unserializable: ${err}]\"`;
  }
}
