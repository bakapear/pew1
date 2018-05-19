let electronInstaller = require('electron-winstaller')

resultPromise = electronInstaller.createWindowsInstaller({
    appDirectory: './release/pew-win32-x64',
    outputDirectory: './release/setup',
    authors: 'bakapear',
    exe: 'pew.exe',
    icon: './icon.ico',
    setupIcon: './icon.ico',
    setupExe: "pew-setup.exe",
    noMsi: true //sorry msi! but I chose sapphire
})

resultPromise.then(() => console.log("It worked!"), (e) => console.log(`No dice: ${e.message}`))

//%repos%/pew >
//electron-packager . pew --overwrite --icon=icon.ico --prune=true --out=release
//node installer/win.js