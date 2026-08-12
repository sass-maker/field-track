/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type D1ResultRow = Record<string, unknown>;

interface D1Result<T = D1ResultRow> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = D1ResultRow>(): Promise<T | null>;
  all<T = D1ResultRow>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = D1ResultRow>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

type RuntimeEnv = {
  DB?: D1Database;
  DEMO_MODE?: string;
};

interface Env extends RuntimeEnv {}

declare module 'cloudflare:workers' {
  export const env: Env;
}
