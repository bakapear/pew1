### DEPRECATED
**No longer working on this. Might be heavily outdated!**


# pew
![preview image 1](https://b.catgirlsare.sexy/i6Hz.png)

#### alt+space launcher built with electron.

Program runs in system-tray to listen for the alt+space shortcut and will open a small input field where you can start your steam games (or custom programs). It gets them from your steamapps folder which u might want to specify in the config file. Since v1.2.0 it includes an explorer file search and special tasks (math, google ...) aswell so it's not for steam only anymore. Bugs are expected because this is still in development but from my testing I found nothing *disturbing* yet. 

[Download the latest version here](https://github.com/bakapear/pew/releases)

### Special Stuff
`>` - Steam Game Search <br>
`#` - Code Search <br>
`?` - Urban Dictionary Search <br>
`/` - Google Web Search (experimental) <br>
`!` - Google Image Search <br>
`@` - Discord Channel Messages <br>

### Configuration / Custom Programs

After installing pew, navigate to `%appdata%/pew` where you'll find a `config.json` file containing some customization settings.
You can add custom programs to the search index or give nicknames to existing or custom programs. There is also a discord object which when given information correctly will enable discord channel messages. (Lookup how to get these.)
```json
{
    "path": "C:/Program Files (x86)/Steam/steamapps",
    "nicks": {
        "440": [
            "tf2"
        ],
        "730": [
            "csgo"
        ]
    },
    "custom": [
        {
            "name": "pew configuration",
            "nick": [
                "cfg",
                "config"
            ],
            "id": "%appdata%/pew/config.json"
        },
        {
            "name": "Google Chrome",
            "nick": [
                "web",
                "browser",
                "internet"
            ],
            "id": "chrome"
        },
        {
            "name": "Editor",
            "nick": [
                "editor",
                "notepad",
                "text"
            ],
            "id": "C:/WINDOWS/system32/notepad.exe"
        }
    ],
    "discord": {
        "token": "dxik93kekxIK3koSKdcklx02o23lddlelele",
        "guildId": "321389012839123"
    }
}
```
