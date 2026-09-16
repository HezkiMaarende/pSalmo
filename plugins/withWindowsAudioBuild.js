const { withAppBuildGradle } = require("@expo/config-plugins");
const marker = "// pSalmo: Windows Audio API native-library downloader";
module.exports = function withWindowsAudioBuild(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== "groovy")
      throw new Error(
        "Windows Audio API setup requires Groovy app/build.gradle.",
      );
    if (!mod.modResults.contents.includes(marker))
      mod.modResults.contents += `
${marker}
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
    gradle.projectsEvaluated {
        def audioApi = rootProject.findProject(':react-native-audio-api')
        if (audioApi != null) {
            audioApi.tasks.named('downloadPrebuiltBinaries', Exec).configure {
                setCommandLine('powershell.exe', '-NoProfile', '-File',
                    new File(rootDir.parentFile, 'scripts/download-audio-libs.ps1').absolutePath)
            }
        }
    }
}
`;
    return mod;
  });
};
