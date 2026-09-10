// A permissive stand-in for the service-role Supabase client: any query
// chain resolves to the rows registered for its table (or []), and every
// insert/update/upsert/rpc succeeds. Enough for route-level tests that only
// care about control flow; the sync jobs themselves are tested through their
// store interfaces.
export type FakeAdmin = {
  client: any;
  tables: Record<string, unknown[]>;
  rpcCalls: string[];
  writes: { table: string; op: string; payload: unknown }[];
};

export function fakeAdmin(tables: Record<string, unknown[]> = {}): FakeAdmin {
  const rpcCalls: string[] = [];
  const writes: FakeAdmin["writes"] = [];

  function chain(table: string, single = false): any {
    const rows = tables[table] ?? [];
    const result = { data: single ? (rows[0] ?? null) : rows, error: null };
    const handler: ProxyHandler<object> = {
      get(_t, prop) {
        if (prop === "then") {
          return (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
            Promise.resolve(result).then(onF, onR);
        }
        if (prop === "single" || prop === "maybeSingle") return () => chain(table, true);
        if (prop === "insert" || prop === "update" || prop === "upsert" || prop === "delete") {
          return (payload: unknown) => {
            writes.push({ table, op: String(prop), payload });
            return chain(table, true);
          };
        }
        return () => chain(table, single);
      },
    };
    return new Proxy({}, handler);
  }

  const client = {
    from: (table: string) => chain(table),
    rpc: async (name: string) => {
      rpcCalls.push(name);
      return { data: 0, error: null };
    },
  };
  return { client, tables, rpcCalls, writes };
}
