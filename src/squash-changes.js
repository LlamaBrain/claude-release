import { parseCommit } from './parse-commits.js';

// The squash commit retains the original messages, not a promise that source
// Git objects or CI artifacts will remain available.
export function expandSquashCommit(commit, options = {}) {
  const lines = (commit.raw || '').split(/\r?\n/).filter(line => /^Captain-Changes:/i.test(line));
  if (!lines.length) return [commit];
  if (lines.length !== 1) throw new Error('duplicate Captain-Changes trailers');
  const match = /^Captain-Changes: ([A-Za-z0-9_-]+)$/.exec(lines[0]);
  if (!match) throw new Error('malformed Captain-Changes trailer');
  if (match[1].length > 2097152) throw new Error('Captain-Changes encoded size limit exceeded');
  let payload;
  try {
    const bytes = Buffer.from(match[1], 'base64url');
    if (bytes.length > 1048576) throw new RangeError('Captain-Changes decoded size limit exceeded');
    if (bytes.toString('base64url') !== match[1]) throw new Error('noncanonical encoding');
    payload = JSON.parse(bytes.toString('utf8'));
  } catch (error) { if (error instanceof RangeError) throw error; throw new Error('malformed Captain-Changes payload'); }
  if (!payload || payload.schema_version !== 1 || !Array.isArray(payload.commits) || !payload.commits.length) {
    throw new Error('invalid Captain-Changes schema');
  }
  if (payload.commits.length > 512) throw new Error('Captain-Changes entry count limit exceeded');
  let messageBytes = 0;
  const seen = new Set();
  const expanded = payload.commits.map(change => {
    if (!change || typeof change.oid !== 'string' || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(change.oid) || seen.has(change.oid) || typeof change.message !== 'string' || !change.message.trim()) {
      throw new Error('invalid or duplicate Captain-Changes entry');
    }
    if (Buffer.byteLength(change.message.split(/\r?\n/,1)[0], 'utf8') > 4096) throw new Error('Captain-Changes commit header size limit exceeded');
    messageBytes += Buffer.byteLength(change.message, 'utf8');
    if (messageBytes > 1048576) throw new Error('Captain-Changes aggregate message size limit exceeded');
    if (/^Captain-Changes:/im.test(change.message)) throw new Error('nested Captain-Changes payload must be flattened');
    seen.add(change.oid);
    const parsed = parseCommit(change.message, {...options, strictPolicy:true});
    if (!parsed.valid || (parsed.breaking && !parsed.breaking_description)) throw new Error('invalid Conventional Commit in Captain-Changes');
    return { hash: change.oid.slice(0, 7), full_hash: change.oid, squash_hash: commit.full_hash, squash_message: commit.raw, ...parsed };
  });
  const summary = parseCommit(commit.raw, {...options, strictPolicy:true});
  if (!summary.valid || (summary.breaking && !summary.breaking_description)) throw new Error('invalid squash Conventional Commit');
  expanded.unshift({ hash: commit.full_hash.slice(0, 7), full_hash: commit.full_hash, squash_summary: true, ...summary });
  return expanded;
}
