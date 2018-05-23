let ipc = require("electron").ipcRenderer

window.onload = function () {
    let input = document.getElementById("field")
    input.addEventListener("input", function (evt) {
        ipc.send("onType", escapeRegExp(this.value))
    })

    input.addEventListener("keydown", function (evt) {
        if (evt.keyCode === 9) {
            evt.preventDefault()
            this.focus()
        }
    })

    document.getElementById("button").onclick = function () {
        ipc.send("onButton")
    }
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