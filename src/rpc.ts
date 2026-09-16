export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export function text(s: string, isError = false): ToolResult {
  return { content: [{ type: "text", text: s }], ...(isError ? { isError: true } : {}) };
}

export function guard<A>(fn: (args: A) => Promise<ToolResult | string>) {
  return async (args: A): Promise<ToolResult> => {
    try {
      const r = await fn(args);
      return typeof r === "string" ? text(r) : r;
    } catch (e) {
      return text(`Error: ${e instanceof Error ? e.message : String(e)}`, true);
    }
  };
}
