# Icons

Place the following icon files here before building:

| File            | Size         | Platform      | Notes                          |
|-----------------|--------------|---------------|--------------------------------|
| `icon.ico`      | 256×256 px   | Windows       | Multi-size ICO recommended     |
| `icon.icns`     | 1024×1024 px | macOS         | ICNS bundle                    |
| `tray-icon.png` | 22×22 px     | Win/mac/Linux | macOS: use @2x (44×44) as well |

## Generating icons

Given a single 1024×1024 source PNG you can generate all formats with:

```bash
# macOS — using built-in sips + iconutil
mkdir icon.iconset
sips -z 16 16   source.png --out icon.iconset/icon_16x16.png
sips -z 32 32   source.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32   source.png --out icon.iconset/icon_32x32.png
sips -z 64 64   source.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 source.png --out icon.iconset/icon_128x128.png
sips -z 256 256 source.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 source.png --out icon.iconset/icon_256x256.png
sips -z 512 512 source.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 source.png --out icon.iconset/icon_512x512.png
cp source.png      icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
```

electron-builder can also auto-generate icons from a single PNG — see:
https://www.electron.build/icons
