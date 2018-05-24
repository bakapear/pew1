if (require("electron-squirrel-startup")) return

let { app, BrowserWindow, Menu, Tray, globalShortcut, ipcMain } = require("electron")
let cp = require("child_process")
let fs = require("fs")
let got = require("got")
let cheerio = require("cheerio")
let Syntax = require("syntax")
let syntax = new Syntax({ language: "auto", cssPrefix: "" })

app.on("ready", init)

let keys = ["#", "?", "/", "="]

let win, icon, showing, first, cfg, games, field, key

async function init() {
    win = new BrowserWindow({
        center: true,
        width: 800,
        height: 120,
        frame: false,
        skipTaskbar: true,
        show: false,
        movable: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        closable: false,
        alwaysOnTop: true,
        fullscreenable: false,
        title: "pew"
    })
    icon = new Tray(`${__dirname}/icon.ico`)
    icon.setContextMenu(Menu.buildFromTemplate([{
        label: "Config",
        click: function () {
            let start = (process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open")
            cp.exec(start + " " + app.getPath("userData") + "/" + "config.json")
        }
    },
    {
        label: "Reload",
        click: function () {
            setTimeout(function () {
                process.on("exit", function () {
                    cp.spawn(process.argv.shift(), process.argv, {
                        cwd: process.cwd(),
                        detached: true,
                        stdio: "inherit"
                    })
                })
                process.exit(0)
            }, 250)
        }
    },
    {
        label: "Exit",
        click: function () {
            process.exit(0)
        }
    }]))
    win.loadURL(`file://${__dirname}/web/index.html`)
    await loadConfig()
    games = await loadSteamGames(cfg.path)
    for (let i = 0; i < cfg.custom.length; i++) {
        games.push(cfg.custom[i])
    }
    events(win, games)
    shortcuts(win)
}

async function loadConfig() {
    let path = app.getPath("userData") + "/" + "config.json"
    if (!fs.existsSync(path)) {
        await fs.writeFileSync(path, JSON.stringify(require("./config"), null, 2), { encoding: "utf-8" })
    }
    cfg = require(path)
}

function events(win, games) {
    win.on("close", e => {
        e.preventDefault()
        clearField()
        win.hide()
        showing = false
    })

    win.on("blur", () => {
        clearField()
        win.hide()
        showing = false
    })

    ipcMain.on("onType", (e, data) => {
        if (data[0] === "") {
            win.webContents.executeJavaScript(`document.getElementById("games").innerHTML = ""`)
            return
        }
        field = data[0]
        key = data[1]
        onType(data[0])
    })

    ipcMain.on("onClick", (e, data) => {
        if (isNaN(data) && data.startsWith("path:")) {
            let cut = data.substr(data.indexOf(":/") - 1, data.length) + "/"
            win.webContents.executeJavaScript(`document.getElementById("field").value = "${cut}";document.getElementById("field").focus()`)
            onType(cut)
        }
        else {
            executeProgram(data)
            win.hide()
            showing = false
        }
    })
}

function shortcuts(win) {
    globalShortcut.register("Alt+Space", () => {
        if (showing) {
            clearField()
            win.hide()
            showing = false
        } else {
            win.webContents.executeJavaScript(`document.getElementById("field").focus()`)
            win.show()
            showing = true
        }
    })


    Menu.setApplicationMenu(Menu.buildFromTemplate([{
        label: "Minimize",
        accelerator: "esc",
        click: function () {
            clearField()
            win.hide()
            showing = false
        }
    },
    {
        label: "Start",
        accelerator: "return",
        click: function () {
            if (key !== "&gt;") showResult(key)
            else if (first !== undefined) {
                let path = field.endsWith("/") ? first.substring(0, first.lastIndexOf("/")) : first
                executeProgram(path)
                win.hide()
                showing = false
            }
        }
    },
    {
        label: "Reload",
        accelerator: "CmdOrCtrl+R",
        click: function () {
            setTimeout(function () {
                process.on("exit", function () {
                    cp.spawn(process.argv.shift(), process.argv, {
                        cwd: process.cwd(),
                        detached: true,
                        stdio: "inherit"
                    })
                })
                process.exit(0)
            }, 250)
        }
    },
    {
        label: "Exit",
        accelerator: "CmdOrCtrl+Q",
        click: function () {
            process.exit(0)
        }
    }]))
}

async function loadSteamGames(steamPath) {
    let files = await fs.readdirSync(steamPath)
    let regex = new RegExp("appmanifest_.*\\.acf", "g")
    let data = []
    for (let i = files.length - 1; i >= 0; i--) {
        if (!files[i].match(regex)) {
            files.splice(i, 1)
            continue
        }
        data.push(fs.readFileSync(steamPath + "/" + files[i], { encoding: "utf-8" }))
    }
    await Promise.all(data)
    let nameRegex = new RegExp("\"name\".*\"(.*)\"")
    let appRegex = new RegExp("\"appid\".*\"(.*)\"")
    let lib = []
    for (let i = data.length - 1; i >= 0; i--) {
        let name = nameRegex.exec(data[i])
        if (name === null) continue
        let id = appRegex.exec(data[i])
        if (id === null) continue
        let obj = { name: name[1], id: id[1] }
        if (cfg.nicks.hasOwnProperty(id[1])) obj.nick = cfg.nicks[id[1]]
        lib.push(obj)
    }
    return lib
}

function search(query, arr) {
    query = escapeRegExp(query)
    let regex = new RegExp(query.trim(), "i")
    let found = []
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].name.match(regex)) {
            found.push(arr[i])
        } else if (arr[i].hasOwnProperty("nick") && arr[i].nick.join().match(regex)) {
            found.push(arr[i])
        }
    }
    return found
}

function executeProgram(filePath) {
    let execPath = "steam://run/" + filePath
    if (filePath.toString().startsWith("exec:")) {
        for (let i = 0; i < cfg.custom.length; i++) {
            if (cfg.custom[i].name === filePath.toString().substr(5)) {
                execPath = cfg.custom[i].id
                break
            }
        }
    }
    else if (filePath.toString().startsWith("path:")) {
        execPath = filePath.toString().substr(5).replace(/\//g, "\\")
    }
    let start = (process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open")
    cp.exec(start + " " + execPath)
    first = undefined
    clearField()
}

async function searchInDir(query, dir) {
    query = escapeRegExp(query)
    let regex = new RegExp(query.trim(), "i")
    let found = []
    try {
        let files = await fs.readdirSync(dir + "/", { encoding: "utf-8" })
        for (let i = 0; i < files.length; i++) {
            if (files[i].match(regex)) found.push({ name: files[i], exe: "explorer " + dir + "/" + files[i] })
        }
        return found
    } catch (e) { }
}

async function onType(data) {
    let text = ""
    if (!keys.includes(key)) {
        let res = []
        if (data.substr(1).startsWith(":/") || data.substr(1).startsWith(":\\")) {
            let paths = data.replace(/\\/g, "/").split("/")
            res = await searchInDir(paths[paths.length - 1], paths.slice(0, -1).join("/"))
        }
        else res = search(data, games)
        if (!res) return
        if (res[0]) first = res[0].hasOwnProperty("exe") ? "path:" + res[0].exe : isNaN(res[0].id) ? "exec:" + res[0].name : res[0].id
        if (data.trim() === "" || res.length < 1) first = undefined
        for (let i = 0; i < res.length; i++) {
            let id = res[i].id
            if (res[i].hasOwnProperty("exe")) id = "'" + "path:" + res[i].exe + "'"
            else if (isNaN(id)) id = "'" + "exec:" + res[i].name + "'"
            let name = res[i].name
            text += `<a href="javascript:click(${encodeURIComponent(id)})" tabindex="-1">${name}</a>`
        }
    }
    win.webContents.executeJavaScript(`document.getElementById("games").innerHTML = \`${text}\``)
}

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
}

async function getCodeSnippet(query) {
    try {
        let url = "https://www.bing.com/search?q=" + encodeURIComponent(query)
        let body = (await got(url)).body
        let $ = cheerio.load(body)
        let snippet = $(".cCodeBg").text()
        return syntax.richtext(snippet).html()
    } catch (e) { return "" }
    // --> put $codebg.text() in seperate lines instead of .html | ^001
}

async function getUrbanDef(query) {
    try {
        let url = "https://www.urbandictionary.com/define.php?term=" + encodeURIComponent(query)
        let body = (await got(url)).body
        let $ = cheerio.load(body)
        return $(".meaning").first().text()
    } catch (e) { return "" }
}

async function doMath(query) {
    try {
        let url = "http://api.mathjs.org/v4/?expr=" + encodeURIComponent(query)
        let body = (await got(url)).body
        return body
    } catch (e) { return e.response.body }
}

async function showResult(key) {
    let res = ""
    switch (key) {
        case "#":
            res = await getCodeSnippet(field)
            break
        case "?":
            res = await getUrbanDef(field)
            break
        case "/":
            cp.exec("start https://google.com/search?q=" + encodeURIComponent(field))
            return
        case "=":
            res = await doMath(field)
            break
    }
    if (res === "") res = "Nothing found!"
    win.webContents.executeJavaScript(`document.getElementById("games").innerHTML = \`<div>${res}</div>\``)
}

function clearField() {
    win.webContents.executeJavaScript(`document.getElementById("field").value = "";document.getElementById("games").innerHTML = ""; document.getElementById("special").innerHTML = ">"`)
}