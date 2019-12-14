# Gameboy VR Experience

Virtual Reality experience based on WebVR, works best with a VR headset like Oculus Quest.

<img src="https://thumbs.gfycat.com/DapperWarmIbis-size_restricted.gif">

### Preparing ROMS (games)

*This repo does not include any ROMS (games). To use the emulator, you must prepare a few games in advance.*

1. Create a JSON file with the format:
  ````
  [
    {
      "img": "https://example.com/game1-cover.jpg",
      "rom": "https://example.com/game1-rom.gbc"
    },
    {
      "img": "https://example.com/game2-cover.jpg",
      "rom": "https://example.com/game2-rom.gbc"
    }
  ]
  ````
 2. Upload the JSON file somewhere (like [glitch.me](https://glitch.com/create))
 3. Provide the file link as a URL parameter named "roms":
  ```
  https://gameboy.webvr.link?roms=https://example.glitch.me/roms.json
  ```

### Play Intructions

1. Use the headset browser to visit the site (don't forget the roms parameter)
2. Click on the glasses icon on the bottom right to enter VR mode
3. Enjoy

### New - play in the backseat of a car at night

<img src="https://thumbs.gfycat.com/ImaginaryYoungIslandcanary-small.gif">

Made after the following comment on Reddit:
> All you have to do now is add an option to change the environment into the back seat of a minivan at night, while your parents drive you and your sibling home and you only have the brief lighting of streetlights to play by.

1. Prepare JSON like before
2. Notice the changed URL (/car) and the game index to autoplay as a URL parameter named "i":
  ```
  https://gameboy.webvr.link/car?roms=https://example.glitch.me/roms.json&i=3
  ```
  
### Credits

Based on Amebo GBC emulator https://github.com/riperiperi/amebo

Built with [A-Frame](https://aframe.io)
