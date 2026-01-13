#!/usr/bin/env node
'use strict';

function parseArgs(argStr) {
  const args = {};
  const parts = argStr.split(',').map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) {
      // bare positional not supported in this MVP
      throw new Error(`Argument must be key=value: ${part}`);
    }
    const key = part.slice(0, eq).trim();
    let value = part.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else if (/^\d+$/.test(value)) {
      value = Number(value);
    } else if (value === 'true' || value === 'false') {
      value = value === 'true';
    } else if (/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z0-9_.]+$/.test(value)) {
      value = { $expr: value };
    }
    args[key] = value;
  }
  return args;
}

function normalizeWhen(when) {
  if (!when) return when;
  if (!/[!<>=]/.test(when)) {
    return `${when} == true`;
  }
  return when;
}

function parseEntry(body, when, lineNo) {
  const match = body.match(/^([A-Za-z0-9_]+)\((.*)\)$/);
  if (!match) {
    throw new Error(`Invalid entry on line ${lineNo}: ${body}`);
  }
  const id = match[1];
  const argStr = match[2].trim();
  const args = argStr ? parseArgs(argStr) : {};
  const entry = { id, args };
  if (when) entry.when = when;
  return entry;
}

function parsePlaylistDsl(input) {
  const lines = input.split(/\r?\n/);
  const entries = [];
  let pendingIf = null;
  let lastIfWhen = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    if (pendingIf) {
      if (line.startsWith('else:')) {
        throw new Error(`Unexpected else without if body on line ${i + 1}`);
      }
      const entry = parseEntry(line, pendingIf, i + 1);
      entries.push(entry);
      lastIfWhen = pendingIf;
      pendingIf = null;
      continue;
    }

    if (line.startsWith('else:')) {
      if (!lastIfWhen) {
        throw new Error(`Else without preceding if on line ${i + 1}`);
      }
      const body = line.slice(5).trim();
      if (!body) {
        throw new Error(`Else missing body on line ${i + 1}`);
      }
      const when = `!(${lastIfWhen})`;
      entries.push(parseEntry(body, when, i + 1));
      lastIfWhen = null;
      continue;
    }

    if (line.startsWith('if ')) {
      const idx = line.indexOf(':');
      if (idx === -1) {
        throw new Error(`Missing ':' in conditional on line ${i + 1}`);
      }
      let when = normalizeWhen(line.slice(3, idx).trim());
      let rest = line.slice(idx + 1).trim();
      if (!rest) {
        pendingIf = when;
        continue;
      }

      const elseIdx = rest.indexOf(' else: ');
      if (elseIdx !== -1) {
        const thenBody = rest.slice(0, elseIdx).trim();
        const elseBody = rest.slice(elseIdx + 6).trim();
        if (!thenBody || !elseBody) {
          throw new Error(`Invalid if/else on line ${i + 1}`);
        }
        entries.push(parseEntry(thenBody, when, i + 1));
        entries.push(parseEntry(elseBody, `!(${when})`, i + 1));
        lastIfWhen = null;
        continue;
      }

      entries.push(parseEntry(rest, when, i + 1));
      lastIfWhen = when;
      continue;
    }

    entries.push(parseEntry(line, null, i + 1));
    lastIfWhen = null;
  }

  return entries;
}

module.exports = { parsePlaylistDsl };
