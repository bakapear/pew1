if (require("electron-squirrel-startup")) return

let { clipboard, app, BrowserWindow, Menu, Tray, globalShortcut, ipcMain } = require("electron")
let cp = require("child_process")
let fs = require("fs")
let got = require("got")
let cheerio = require("cheerio")
let Syntax = require("syntax")
let syntax = new Syntax({ language: "auto", cssPrefix: "", newlineReplace: "<br>" })
let Discord = require("discord.js")
let client = new Discord.Client()
let moment = require("moment")

app.on("ready", init)

let keys = ["#", "?", "/", "=", "@", "!"]

let win, icon, showing, first, cfg, games, field, key, width = 800, height = 120, clientReady = false, chat = false, msgListener = false, currentChannel

async function init() {
    win = new BrowserWindow({
        center: true,
        width: width,
        height: height,
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
        resetView()
        win.hide()
        showing = false
    })

    win.on("blur", () => {
        resetView()
        win.hide()
        showing = false
    })

    ipcMain.on("onType", (e, data) => {
        if (data[0] === "") {
            resetView(data[1])
            return
        }
        field = data[0]
        key = data[1]
        onType(data[0])
    })

    ipcMain.on("chat", (e, bool) => {
        chat = bool
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

    ipcMain.on("changeSize", (e, data) => {
        win.setSize(width, height + data - 19)
    })

    ipcMain.on("clipboard", (e, data) => {
        clipboard.writeText(data, "selection")
    })
}

function shortcuts(win) {
    globalShortcut.register("Alt+Space", () => {
        if (showing) {
            resetView()
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
            resetView()
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
    resetView()
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
        win.webContents.executeJavaScript(`document.getElementById("games").innerHTML = \`${text}\``)
    }
}

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
}

async function getCodeSnippet(query) {
    try {
        let url = "https://www.bing.com/search?q=" + encodeURIComponent(query)
        let body = (await got(url)).body
        let $ = cheerio.load(body)
        let snippet = ""
        for (let i = 1; i < 10; i++) {
            let part = $(`.cCodeBg > div:nth-child(${i})`).text()
            if (part === "") break
            snippet += part + "\n"
        }
        return syntax.richtext(snippet).html()
    } catch (e) { return "" }
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

async function sendDiscordMessage(query) {
    query = query.split(">")
    query = [query.shift(), query.join(">")]
    if (cfg.discord.token === "") return "No Discord Token provided in config!"
    if (cfg.discord.guildId === "") return "No Guild ID specified in config!"
    if (!clientReady) await client.login(cfg.discord.token).then(clientReady = true)
    let guild = client.guilds.get(cfg.discord.guildId)
    let channel = guild.channels.find("name", query[0])
    if (channel === null) return "Channel not found!"
    if (channel.type !== "text") return "That's not a text channel!"
    currentChannel = channel
    chat = true
    if (!msgListener) {
        msgListener = true
        client.on("message", async msg => {
            if (!chat) return
            if (msg.channel.id !== currentChannel.id) return
            let content = await getDiscordChannelMessages(msg.channel)
            win.webContents.executeJavaScript(`document.getElementById("games").innerHTML = \`<div id="box">${content}</div>\``)
            win.webContents.send("getDiv")
        })
    }
    let content = await getDiscordChannelMessages(channel)
    if (query[1]) {
        channel.send(query[1])
        win.webContents.executeJavaScript(`document.getElementById("field").value = "${query[0]}>"`)
    }
    return content

}

async function getDiscordChannelMessages(channel) {
    let msgs = await channel.fetchMessages({ limit: 5 })
    let content = []
    msgs.forEach(msg => {
        let body
        if (msg.attachments.size) {
            let url = "'" + msg.attachments.first().url + "'"
            let file = msg.attachments.first().filename
            body = `<a class="link" href="javascript:imageClick(${encodeURIComponent(url)})">${file}</a>`
        }
        else if (msg.embeds.length) {
            let title = ""
            if (msg.embeds[0].title) title = "<span class=\"embed title\">" + escapeHtml(msg.embeds[0].title.substr(0, 20)) + "</span>"
            let desc = ""
            if (msg.embeds[0].description) {
                desc = escapeHtml(msg.embeds[0].description.replace(/\`/g, "").substr(0, 40))
            }
            else if (msg.embeds[0].image) {
                let url = msg.embeds[0].image.url
                desc = `<a class="link" href="javascript:imageClick(${encodeURIComponent("'" + url + "'")})">` + escapeHtml(url.substr(0, 40)) + "</a>"
            } else if (msg.embeds[0].url) {
                let url = msg.embeds[0].url
                desc = `<a class="link" href="javascript:imageClick(${encodeURIComponent("'" + url + "'")})">` + escapeHtml(url.substr(0, 40)) + "</a>"
            }
            body = title + "<span class=\"embed desc\">" + desc + "</span>"
        }
        else body = escapeHtml(msg.content)
        let data = moment(msg.createdTimestamp).format('HH:mm') + " - <span class=\"literal\">" + escapeHtml(msg.author.username) + "</span>: " + "<span class=\"msg\">" + body + "</span>" + "<br>"
        content.push(data)
    })
    return content.reverse().join("")
}

async function collectImages(query) {
    let url = "http://images.google.com/search?tbm=isch&q=" + encodeURIComponent(query)
    let body = (await got(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36'
        }
    })).body
    let $ = cheerio.load(body)
    let meta = $(".rg_meta")
    let result = []
    for (let i = 0; i < meta.length; i++) {
        let data = JSON.parse(meta[i].children[0].data)
        let item = {
            original: {
                url: data.ou,
                width: data.ow,
                height: data.oh
            },
            thumbnail: {
                url: data.tu,
                width: data.tw,
                height: data.th
            }
        }
        result.push(item)
    }
    return result
}

async function getGoogleImages(query) {
    let images = await collectImages(query)
    let output = ""
    for (let i = 0; i < images.length; i++) {
        let url = images[i].original.url
        let thumb = images[i].thumbnail.url
        output += `<a class="link" href="javascript:imageClick('${encodeURIComponent(url)}')"><img src="${url.endsWith(".gif") ? url : thumb}"></a>`
    }
    return output
}

async function showResult(key) {
    if (!chat) win.webContents.executeJavaScript(`document.getElementById("games").innerHTML = \`<div id="box">Loading...</div>\``)
    win.webContents.send("getDiv", "")
    chat = false
    let res = ""
    switch (key) {
        case "#":
            res = await getCodeSnippet(field)
            break
        case "?":
            res = await getUrbanDef(field)
            break
        case "/":
            res = await searchGoogle(field)
            break
        case "=":
            res = await doMath(field)
            break
        case "@":
            res = await sendDiscordMessage(field)
            break
        case "!":
            res = await getGoogleImages(field)
            break
    }
    let op = key
    if (res === "") {
        res = "Nothing found!"
        op = ""
    }
    win.webContents.executeJavaScript(`document.getElementById("games").innerHTML = \`<div id="box">${res}</div>\``)
    win.webContents.send("getDiv", op)
}

function resetView(key) {
    chat = false
    if (!key) key = ">"
    win.webContents.executeJavaScript(`document.getElementById("field").value = "";document.getElementById("games").innerHTML = ""; document.getElementById("special").innerHTML = "${key}"`)
    win.setSize(width, height)
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
}

async function searchGoogle(query) {
    let data = await getGoogleResults(query)
    let output = ""
    for (let i = 0; i < data.length; i++) {
        output += `<a href="${data[i].url}"><div class="googres"><h3>${escapeHtml(data[i].title)}</h3><p>${escapeHtml(data[i].desc)}</p></div></a>`
    }
    return output
}

async function getGoogleResults(query) {
    try {
        let url = "https://google.com/search?num=35&q=" + encodeURIComponent(query)
        let body = (await got(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.78 Safari/537.36"
            }
        })).body
        let $ = cheerio.load(body)
        let results = $(".srg > .g > div > .rc")
        let output = []
        for (let i = 0; i < results.length; i++) {
            let item = {
                title: $(results[i].children[0]).text(),
                url: results[i].children[0].children[0].attribs.href,
                desc: $(results[i].children[1].children[0].children[1]).text()
            }
            output.push(item)
        }
        return output
    } catch (e) { return e.response.body }
}