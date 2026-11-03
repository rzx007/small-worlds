console.error('Performance samples are available via test:perf:sample, but no reliable regression threshold or approved historical baseline exists. Performance gate remains blocked.');
process.exitCode = 1;
