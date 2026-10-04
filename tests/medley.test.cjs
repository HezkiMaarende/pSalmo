const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildSetlistUnits,
  medleyContext,
  rangeSelection,
} = require("../.test-build/medley.js");

const group = { id: "g", setlist_id: "s", position: 1, label: "Pembukaan" };
const items = [
  { id: "a", position: 0, medley_group_id: null },
  { id: "b", position: 1, medley_group_id: "g" },
  { id: "c", position: 2, medley_group_id: "g" },
  { id: "d", position: 3, medley_group_id: null },
  { id: "e", position: 4, medley_group_id: null },
];
test("builds contiguous group as one unit and exposes per-song context", () => {
  const units = buildSetlistUnits([...items].reverse(), [group]);
  assert.deepEqual(
    units.map((unit) => [unit.kind, unit.items.map((item) => item.id)]),
    [
      ["song", ["a"]],
      ["medley", ["b", "c"]],
      ["song", ["d"]],
      ["song", ["e"]],
    ],
  );
  assert.equal(medleyContext(items[2], items, [group]), "Pembukaan · lagu 2/2");
  assert.equal(medleyContext(items[0], items, [group]), null);
});
test("range selection permits edges, rejects other groups and one-song ranges", () => {
  assert.deepEqual(
    rangeSelection(items, "a", "c", "g").map((item) => item.id),
    ["a", "b", "c"],
  );
  assert.throws(() => rangeSelection(items, "a", "c"));
  assert.throws(() => rangeSelection(items, "a", "a"));
  assert.throws(() => rangeSelection(items, "d", "e", "g"));
});
