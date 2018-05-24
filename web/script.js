let ipc = require("electron").ipcRenderer

let keys = [">", "#", "?", "/", "="]

window.onload = function () {
    let input = document.getElementById("field")
    let key = document.getElementById("special")
    input.addEventListener("input", function (evt) {
        if (keys.includes(this.value[0])) {
            key.innerHTML = this.value[0]
            this.value = this.value.substring(1)
        }
        ipc.send("onType", [escapeRegExp(this.value), key.innerHTML])
    })
    input.addEventListener("keydown", function (evt) {
        if (evt.keyCode === 9) {
            evt.preventDefault()
            this.focus()
        }
    })
}

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
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