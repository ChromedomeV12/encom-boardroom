// Centralized diagnostics collection and reporting for the blog build.
// Aggregates errors and warnings from all pipeline stages, then renders
// them to the console with clear severity levels. A non-empty error list
// causes the orchestrator to exit non-zero.
export class Diagnostics {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  error(entry) {
    if (typeof entry === 'string') entry = { type: 'error', message: entry, context: '' };
    this.errors.push(entry);
  }

  warn(entry) {
    if (typeof entry === 'string') entry = { type: 'warning', message: entry, context: '' };
    this.warnings.push(entry);
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  /** Pretty-print all diagnostics to stderr. */
  report() {
    for (const e of this.errors) {
      console.error(`  [error] ${e.message}${e.context ? '  (' + e.context + ')' : ''}`);
    }
    for (const w of this.warnings) {
      console.warn(`  [warn]  ${w.message}${w.context ? '  (' + w.context + ')' : ''}`);
    }
  }

  /**
   * Exit non-zero if there are errors. The caller passes a summary label.
   * Returns the process exit code (0 or 1) so the orchestrator can set it.
   */
  finalize(label) {
    if (this.errors.length) {
      console.error(`\n${label || 'Build'} failed with ${this.errors.length} error(s):`);
      this.report();
      return 1;
    }
    if (this.warnings.length) {
      console.warn(`\n${label || 'Build'} completed with ${this.warnings.length} warning(s):`);
      this.report();
    }
    return 0;
  }
}
