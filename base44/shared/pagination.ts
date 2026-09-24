// Shared pagination helpers — the Base44 SDK caps list() and filter() at 500
// records per call. list() supports a skip offset; filter() does not, so we
// use cursor-based pagination (sorting by a unique field and excluding
// already-seen values via $lt / $gt) to page through all matches.

// Paginate through ALL records using list() with skip.
// Usage: const all = await listAll(base44.asServiceRole.entities.User, '-created_date');
export async function listAll(entityClient, sort = '-created_date', batchSize = 500) {
  const all = [];
  let skip = 0;
  let batch;
  do {
    batch = await entityClient.list(sort, batchSize, skip);
    all.push(...batch);
    skip += batch.length;
  } while (batch.length === batchSize);
  return all;
}

// Paginate through ALL records matching a filter query using cursor-based
// pagination on the sort field (default: created_date).
// Usage: const all = await filterAll(base44.asServiceRole.entities.PatientDoctorAssignment, { status: 'active' });
export async function filterAll(entityClient, query, sort = '-created_date', batchSize = 500) {
  const all = [];
  const isDesc = sort.startsWith('-');
  const sortField = isDesc ? sort.slice(1) : sort;
  let cursor = null;
  let batch;

  do {
    const pageQuery = { ...query };
    if (cursor) {
      pageQuery[sortField] = isDesc ? { $lt: cursor } : { $gt: cursor };
    }
    batch = await entityClient.filter(pageQuery, sort, batchSize);
    all.push(...batch);
    cursor = batch.length > 0 ? batch[batch.length - 1][sortField] : null;
  } while (batch.length === batchSize);

  return all;
}