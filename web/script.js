let ipc = require("electron").ipcRenderer

let keys = [">", "#", "?", "/", "=", "@", "!"]

window.onload = function () {
    let input = document.getElementById("field")
    let key = document.getElementById("special")
    input.addEventListener("input", function (evt) {
        if (keys.includes(this.value[0])) {
            key.innerHTML = this.value[0]
            this.value = this.value.substring(1)
        }
        ipc.send("onType", [this.value, key.innerHTML])
    })
    input.addEventListener("keydown", function (evt) {
        if (evt.keyCode === 9) {
            evt.preventDefault()
            this.focus()
        }
    })
    ipc.on("getDiv", (e, key) => {
        let height = document.getElementById("box").clientHeight
        if (key === "!") height = 350
        ipc.send("changeSize", height)
    })
}

window.addEventListener("dragover", function (e) {
    e = e || event
    e.preventDefault()
}, false)

window.addEventListener("drop", function (e) {
    e = e || event
    e.preventDefault()
}, false)

function click(data) {
    ipc.send("onClick", decodeURIComponent(data))
}

function imageClick(url) {
    ipc.send("chat", false)
    document.getElementById("games").innerHTML = `<div id="img"><img id="image" onclick="" src="${decodeURIComponent(url)}"></div>`
    let img = document.getElementById("image")
    img.addEventListener("load", () => {
        ipc.send("changeSize", img.clientHeight < 350 ? img.clientHeight : 350)
    })
    img.onclick = function () {
        ipc.send("clipboard", img.src)
        document.getElementById("games").innerHTML = "<div id=\"box\">Copied to clipboard!</div>"
        ipc.send("changeSize", document.getElementById("box").clientHeight)
    }
}