const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const { songLabel, requiredSongTitle } = require('../.test-build/songLabel');

test('Title/key labels trim independently; key is optional and does not transpose', () => {
  assert.equal(songLabel(' Judul - live ', ' E '), 'Judul - live - E');
  assert.equal(songLabel(' Judul ', ' '), 'Judul');
  assert.equal(requiredSongTitle(' Judul '), 'Judul');
  assert.throws(() => requiredSongTitle('  '));
});

test('Setlist settings send one atomic snapshot update, never a canonical song write', async () => {
  const updates = [];
  let denied = false;
  const chain = { update(value) { updates.push(value); return this; }, eq(field, id) { assert.equal(field, 'id'); assert.equal(id, 'item'); return this; }, select(fields) { assert.equal(fields, 'id'); return this; }, async single() { return { error: denied ? { message: 'Access denied' } : null }; } };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/church.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    module, exports: module.exports, process: { env: {} }, require(name) {
      if (name === './supabase') return { supabase: { from(table) { assert.equal(table, 'setlist_items'); return chain; } } };
      if (name === '../domain/metronome') return require('../.test-build/metronome');
      if (name === '../domain/youtube') return require('../.test-build/youtube');
      throw new Error(name);
    }
  });
  const input = { title: ' Song ', key: ' E ', bpm: '', signature: '', notes: ' Note ' };
  await module.exports.saveSetlistSettings('item', input);
  assert.equal(JSON.stringify(updates[0]), JSON.stringify({ proposed_title: 'Song', key: 'E', bpm: null, time_signature: '4/4', notes: 'Note' }));
  await assert.rejects(module.exports.saveSetlistSettings('item', { ...input, title: ' ' }), /wajib/);
  assert.equal(updates.length, 1);
  denied = true;
  await assert.rejects(module.exports.saveSetlistSettings('item', input), /Access denied/);
});
