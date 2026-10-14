// Shared pagination helpers — the Base44 SDK caps list() and filter() at 500
// records per call. We use cursor-based pagination to page through all matches.

// Retry a call on 429 (rate limit) with exponential backoff.
async function withRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if ((e?.status === 429 || e?.statusCode === 429) && i < retries) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
}

// Paginate through ALL records using list() with positional args.
// The options-object form of list() is not available for the User entity,
// so we use the legacy positional form (sort, limit, skip) which works
// for all entities including User.
// Usage: const all = await listAll(base44.asServiceRole.entities.User, '-created_date');
export async function listAll(entityClient, sort = '-created_date', batchSize = 500) {
  const all = [];
  let skip = 0;
  let batch;
  do {
    batch = await withRetry(() => entityClient.list(sort, batchSize, skip));
    all.push(...batch);
    skip += batch.length;
  } while (batch.length === batchSize);
  return all;
}

// Paginate through ALL records matching a filter query using cursor-based
// pagination with the options object form.
// Usage: const all = await filterAll(base44.asServiceRole.entities.PatientDoctorAssignment, { status: 'active' });
export async function filterAll(entityClient, query, sort = '-created_date', batchSize = 500) {
  const all = [];
  let cursor = undefined;
  let page;
  do {
    page = await withRetry(() => entityClient.filter(query, { sort, limit: batchSize, ...(cursor ? { cursor } : {}) }));
    all.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return all;
}