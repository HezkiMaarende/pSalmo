const { withAppBuildGradle } = require("@expo/config-plugins");
const marker = "// pSalmo: Windows Audio API native-library downloader";
const stagingMarker = "// pSalmo: Windows Audio API short CMake staging";
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
    if (!mod.modResults.contents.includes(stagingMarker))
      mod.modResults.contents += `
${stagingMarker}
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
    def audioProject = rootProject.findProject(':react-native-audio-api')
    if (audioProject != null) {
        audioProject.plugins.withId('com.android.library') {
            audioProject.extensions.getByName('androidComponents').finalizeDsl { androidDsl ->
                androidDsl.externalNativeBuild.cmake.buildStagingDirectory =
                    new File(rootDir.parentFile, '.cxx/a')
            }
        }
    }
}
`;
    return mod;
  });
};
