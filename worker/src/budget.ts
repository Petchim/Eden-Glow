/* =====================================================================
   REQUEST BUDGET — stay inside the Workers Free plan.
   ---------------------------------------------------------------------
   Free plan: 50 outgoing requests ("subrequests") per invocation. All
   Instagram and Firestore calls go through this counter, which refuses
   to go past LIMIT (45, leaving room for the Google signing-key fetch
   and error reporting). Long jobs check `remaining()` and save their
   place in KV before running out, then continue on the next run.
   ===================================================================== */

export const SUBREQUEST_LIMIT = 45;

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export class BudgetExceeded extends Error {
  constructor() {
    super('Request budget for this run is used up.');
    this.name = 'BudgetExceeded';
  }
}

export interface Budget {
  fetch: Fetch;
  used(): number;
  remaining(): number;
}

export function createBudget(limit = SUBREQUEST_LIMIT, base: Fetch = (url, init) => fetch(url, init)): Budget {
  let used = 0;
  return {
    fetch(url, init) {
      if (used >= limit) return Promise.reject(new BudgetExceeded());
      used += 1;
      return base(url, init);
    },
    used: () => used,
    remaining: () => limit - used,
  };
}
