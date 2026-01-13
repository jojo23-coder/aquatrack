#!/usr/bin/env node
'use strict';

/*
  Proof-of-concept parser for a simple playlist DSL.

  DSL examples:
    t_chem_test(parameter=nitrate, cadence=one_time, variant=default)
    if setup.can_test_nitrate == true: t_chem_test(parameter=nitrate, cadence=one_time, variant=default)
    i_intro_duration(days=7)

  Output:
    { id: "t_chem_test", args: { parameter: "nitrate", cadence: "one_time", variant: "default" }, when: "..." }
*/

const fs = require('fs');
const path = require('path');
const { parsePlaylistDsl } = require('./playlistDsl');

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: parse-playlist-dsl.js <input.txt>');
  process.exit(1);
}

const input = fs.readFileSync(path.resolve(inputPath), 'utf8');
const entries = parsePlaylistDsl(input);

const outputPath = path.resolve(inputPath.replace(/\.[^/.]+$/, '') + '.json');
fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2) + '\n', 'utf8');
console.log(`Wrote ${outputPath}`);
