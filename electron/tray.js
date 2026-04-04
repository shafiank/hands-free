'use strict';

const { Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');

let tray = null;

function createTray(getMainWindow, app, getPort) {
  const iconName = process.platform === 'darwin' ? 'tray-iconTemplate.png' : 'tray-icon.png';
  const iconPath = path.join(__dirname, 'icons', iconName);
  const icon = nativeImage.createFromPath(iconPath);

  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);
  tray.setToolTip('Hands Free - AI Desktop Agent');

  function buildMenu() {
    const win = getMainWindow();
    const isVisible = win && win.isVisible();

    return Menu.buildFromTemplate([
      {
        label: isVisible ? 'Hide Hands Free' : 'Open Hands Free',
        click: () => {
          const w = getMainWindow();
          if (!w) return;
          if (w.isVisible()) {
            w.hide();
          } else {
            w.show();
            w.focus();
          }
          tray.setContextMenu(buildMenu());
        }
      },
      { type: 'separator' },
      {
        label: '● Status: Running',
        enabled: false,
      },
      {
        label: 'Open in Browser',
        click: () => shell.openExternal(`http://localhost:${getPort ? getPort() : 3000}`)
      },
      { type: 'separator' },
      {
        label: 'Quit Hands Free',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);
  }

  tray.setContextMenu(buildMenu());

  tray.on('right-click', () => {
    tray.setContextMenu(buildMenu());
    tray.popUpContextMenu();
  });

  tray.on('click', () => {
    if (process.platform === 'darwin') return;
    const w = getMainWindow();
    if (!w) return;
    if (w.isVisible()) {
      w.hide();
    } else {
      w.show();
      w.focus();
    }
    tray.setContextMenu(buildMenu());
  });

  tray.on('double-click', () => {
    const w = getMainWindow();
    if (!w) return;
    w.show();
    w.focus();
  });

  return tray;
}

module.exports = { createTray };
