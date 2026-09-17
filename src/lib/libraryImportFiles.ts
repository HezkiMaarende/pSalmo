import {
  assertFileBounds,
  candidateFromFile,
  ImportCandidate,
} from "../domain/libraryImport";

export async function pickLibraryTextFiles(): Promise<{
  candidates: ImportCandidate[];
  cleanupWarning: string;
} | null> {
  // Load on demand so an older development binary can still open the app;
  // missing picker native code becomes a handled import-screen error.
  const DocumentPicker = await import("expo-document-picker");
  const { File, Paths } = await import("expo-file-system");
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  // Expo creates cache copies for this exact picker invocation. Never clean
  // an external provider URI or any directory, and never use recursive delete.
  const cachePrefix = Paths.cache.uri.replace(/\/+$/, "") + "/DocumentPicker/";
  const owned = result.assets.filter(
    (asset) =>
      asset.uri.startsWith(cachePrefix) && !/%2e|\.\./i.test(asset.uri),
  );
  let cleanupFailed = false;
  let candidates: ImportCandidate[] = [];
  const actualSizes: number[] = [];
  try {
    if (!result.assets.length || result.assets.length > 50)
      throw Error("Pilih 1–50 file .txt.");
    const files = result.assets.map((asset) => new File(asset.uri));
    assertFileBounds(files.map((file) => file.size));
    for (let i = 0; i < files.length; i++) {
      const bytes = await files[i].bytes();
      actualSizes.push(bytes.length);
      if (actualSizes.reduce((sum, size) => sum + size, 0) > 2 * 1024 * 1024)
        throw Error("Total file maksimal 2MiB.");
      candidates.push(
        candidateFromFile(result.assets[i].name, bytes, String(i)),
      );
    }
    assertFileBounds(actualSizes);
  } finally {
    for (const asset of owned) {
      try {
        const file = new File(asset.uri);
        if (file.exists) file.delete();
      } catch {
        cleanupFailed = true;
      }
    }
  }
  return {
    candidates,
    cleanupWarning: cleanupFailed
      ? "Sebagian salinan cache tidak dapat dibersihkan; file sumber tidak diubah."
      : "",
  };
}
