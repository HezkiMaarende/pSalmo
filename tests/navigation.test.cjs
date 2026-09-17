const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = (file) => fs.readFileSync(require.resolve("../" + file), "utf8");
test("Metronome routes sit outside tab stacks and have a separate AddSongs route", () => {
  const source = read("src/navigation/AppNavigator.tsx");
  assert.match(source, /RootStack.Screen\s+name="Practice"/);
  assert.match(source, /RootStack.Screen\s+name="MetronomeAddSongs"/);
  assert.doesNotMatch(source, /<Stack.Screen\s+name="Practice"/);
  assert.match(source, /<Stack.Screen\s+name="AddSongs"/);
  assert.match(
    read("src/screens/PracticeScreen.tsx"),
    /navigate\("MetronomeAddSongs"/,
  );
});
test("Navigation chrome and draft guards are separate from the long-lived player", () => {
  assert.match(
    read("src/context/ClickPlayerContext.tsx"),
    /if \(metronomeActive\) return null/,
  );
  const practice = read("src/screens/PracticeScreen.tsx");
  assert.match(
    practice,
    /usePreventRemove\(editorState.dirty \|\| editorState.busy/,
  );
  assert.match(practice, /navigation.dispatch\(data.action\)/);
  assert.match(
    practice,
    /if \(view === "setlist" && detail.can_edit\) stop\(\)/,
  );
  assert.match(
    read("App.tsx"),
    /<ClickPlayerProvider>[\s\S]*<NavigationChromeProvider>/,
  );
});
