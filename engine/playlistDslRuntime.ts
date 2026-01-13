const EXPRESSION_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z0-9_.]+$/;

const parseArgs = (argStr: string) => {
  const args: Record<string, any> = {};
  const parts = argStr.split(',').map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) {
      throw new Error(`Argument must be key=value: ${part}`);
    }
    const key = part.slice(0, eq).trim();
    let value: any = part.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else if (/^\d+$/.test(value)) {
      value = Number(value);
    } else if (value === 'true' || value === 'false') {
      value = value === 'true';
    } else if (EXPRESSION_PATTERN.test(value)) {
      value = { $expr: value };
    }
    args[key] = value;
  }
  return args;
};

const normalizeWhen = (when: string) => {
  if (!when) return when;
  if (!/[!<>=]/.test(when)) {
    return `${when} == true`;
  }
  return when;
};

const parseEntry = (body: string, when: string | null, lineNo: number) => {
  const match = body.match(/^([A-Za-z0-9_]+)\((.*)\)$/);
  if (!match) {
    throw new Error(`Invalid entry on line ${lineNo}: ${body}`);
  }
  const id = match[1];
  const argStr = match[2].trim();
  const args = argStr ? parseArgs(argStr) : {};
  const entry: Record<string, any> = { id, args };
  if (when) entry.when = when;
  return entry;
};

const parsePlaylistDsl = (input: string) => {
  const lines = input.split(/\r?\n/);
  const entries: Record<string, any>[] = [];
  let pendingIf: string | null = null;
  let lastIfWhen: string | null = null;

  for (let i = 0; i < lines.length; i += 1) {
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
      const when = normalizeWhen(line.slice(3, idx).trim());
      const rest = line.slice(idx + 1).trim();
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
};

const extractDurationDays = (entries: Record<string, any>[]) => {
  const durationEntry = entries.find((entry) => entry.id === 'i_intro_duration');
  const days = durationEntry?.args?.days;
  if (typeof days === 'number' && Number.isFinite(days)) {
    return days;
  }
  return null;
};

const normalizeEntries = (entries: Record<string, any>[]) => {
  return entries.map((entry) => {
    const args = { ...(entry.args || {}) };
    const dueOffset = args.due_offset_days ?? args.dueOffsetDays ?? entry.due_offset_days ?? entry.dueOffsetDays;
    if (dueOffset !== undefined) {
      delete args.due_offset_days;
      delete args.dueOffsetDays;
    }
    const normalized: Record<string, any> = {
      id: entry.id,
      args
    };
    if (entry.when) normalized.when = entry.when;
    if (dueOffset !== undefined) normalized.due_offset_days = dueOffset;
    return normalized;
  });
};

const buildPhasePlaylistsFromDsl = (input: string) => {
  const lines = input.split(/\r?\n/);
  const phases: { phase_id: string; phase_name: string; body: string[] }[] = [];
  let current: { phase_id: string; phase_name: string; body: string[] } | null = null;

  lines.forEach((line) => {
    const match = line.match(/^##\s*([A-Za-z0-9_]+)\s*-\s*(.+)$/);
    if (match) {
      if (current) phases.push(current);
      current = { phase_id: match[1], phase_name: match[2].trim(), body: [] };
      return;
    }
    if (current) {
      current.body.push(line);
    }
  });
  if (current) phases.push(current);

  return phases.map((phase) => {
    const entries = parsePlaylistDsl(phase.body.join('\n'));
    const sequence = normalizeEntries(entries);
    return {
      phase_id: phase.phase_id,
      phase_name: phase.phase_name,
      duration_days: extractDurationDays(entries),
      sequence
    };
  });
};

export { buildPhasePlaylistsFromDsl, parsePlaylistDsl };
