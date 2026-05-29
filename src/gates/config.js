// Per-project release-gate config loader.
//
// Reads <repoRoot>/.captain-sdlc/release-gates.yaml and merges each gate's
// settings with defaults. Canonical contract: seam-release-gates.md ("Where
// gate definitions live"). We hand-roll a minimal YAML reader for the
// constrained schema (top-level scalars + a two-level `gates:` map of scalar
// leaves) rather than take a YAML dependency: the bundler ships these files
// with no node_modules at the consumer, so fewer deps is the discipline
// (ADR-0009, the same reason scripts/bundle.mjs inlines everything).

import { readFileSync } from 'node:fs';
import path from 'node:path';

export const GATE_DEFAULTS = { enabled: true, severity: 'block', required: true };

// Strip a trailing inline `#` comment, respecting simple single/double quotes.
// A `#` only starts a comment at line start or after whitespace.
function stripComment(line) {
  let inS = false;
  let inD = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    else if (c === '#' && !inS && !inD && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

// Coerce a scalar token into boolean / null / number / string.
function parseScalar(raw) {
  const s = raw.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~' || s === '') return null;
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^-?\d*\.\d+$/.test(s)) return Number(s);
  return s;
}

// Minimal indentation-based parser for the constrained gate-config schema:
//   key: scalar                 (top-level scalar, indent 0)
//   gates:                      (top-level map, indent 0, empty value)
//     <gate>:                   (indent 2, empty value)
//       <field>: scalar         (indent >= 4)
// Anything outside this shape throws — surfacing a malformed config loudly
// instead of silently mis-parsing it.
export function parseMiniYaml(text) {
  const root = {};
  let mapKey = null; // active top-level map (e.g. "gates")
  let gateKey = null; // active gate name under that map

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine);
    if (line.trim() === '') continue;

    const indent = line.length - line.trimStart().length;
    const body = line.trim();
    const colon = body.indexOf(':');
    if (colon === -1) throw new Error(`release-gates.yaml: expected "key: value" near "${body}"`);

    const key = body.slice(0, colon).trim();
    const value = body.slice(colon + 1).trim();

    if (indent === 0) {
      gateKey = null;
      if (value === '') {
        root[key] = {};
        mapKey = key;
      } else {
        root[key] = parseScalar(value);
        mapKey = null;
      }
    } else if (indent === 2) {
      if (mapKey == null) throw new Error(`release-gates.yaml: unexpected indent near "${body}"`);
      if (value !== '') throw new Error(`release-gates.yaml: expected a nested map for "${key}"`);
      root[mapKey][key] = {};
      gateKey = key;
    } else {
      // indent >= 4 — a field on the active gate
      if (mapKey == null || gateKey == null) {
        throw new Error(`release-gates.yaml: unexpected indent near "${body}"`);
      }
      root[mapKey][gateKey][key] = parseScalar(value);
    }
  }
  return root;
}

// Load and normalize the config. `fileText` lets callers (tests) inject the
// raw YAML directly; pass `null` to simulate an absent file. When the file is
// absent, every gate falls back to GATE_DEFAULTS at evaluation time.
export function loadGateConfig(repoRoot, { fileText } = {}) {
  let text;
  if (fileText !== undefined) {
    text = fileText;
  } else {
    try {
      text = readFileSync(path.join(repoRoot, '.captain-sdlc', 'release-gates.yaml'), 'utf8');
    } catch {
      text = null;
    }
  }

  if (text == null) {
    return { schema_version: 1, gates: {}, source: 'defaults (no release-gates.yaml)' };
  }

  const parsed = parseMiniYaml(text);
  const gates = {};
  for (const [name, cfg] of Object.entries(parsed.gates || {})) {
    gates[name] = { ...GATE_DEFAULTS, ...cfg };
  }
  return { schema_version: parsed.schema_version ?? 1, gates, source: 'release-gates.yaml' };
}

// Resolve one gate's effective config, applying defaults for fields (or whole
// gates) omitted from the file.
export function gateConfig(config, name) {
  return { ...GATE_DEFAULTS, ...((config && config.gates && config.gates[name]) || {}) };
}
