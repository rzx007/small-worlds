// Candidate sampling only: no historical baseline or pass/fail threshold.
process.env.PERF_ONLY = '1';
await import('./t2-collect.mjs');
