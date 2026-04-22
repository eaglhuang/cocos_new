const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('PREVIEW_MODE', 'true');
    localStorage.setItem('PREVIEW_TARGET', '6');
    localStorage.removeItem('PREVIEW_VARIANT');
    localStorage.removeItem('UI_CAPTURE_STATE');
  });

  await page.goto('http://localhost:7456/?previewMode=true&previewTarget=6&scene=05b67b52-831e-4d74-a8a7-5955746bde7f', { waitUntil: 'domcontentloaded' });

  const deadline = Date.now() + 30000;
  let state = null;
  while (Date.now() < deadline) {
    state = await page.evaluate(() => window.__UI_CAPTURE_STATE__ ?? null);
    if (state && state.status === 'ready') {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const info = await page.evaluate(() => {
    const cc = window.cc;
    const scene = cc?.director?.getScene?.() ?? null;
    const findByName = (node, name) => {
      if (!node) {
        return null;
      }
      if (node.name === name) {
        return node;
      }
      for (const child of node.children || []) {
        const match = findByName(child, name);
        if (match) {
          return match;
        }
      }
      return null;
    };
    const root = scene ? findByName(scene, 'GeneralDetailRoot') : null;
    const portrait = root ? root.getChildByPath('PortraitImage') : null;
    const carrier = root ? root.getChildByPath('PortraitImage/PortraitArtworkCarrier') : null;
    const artwork = root ? root.getChildByPath('PortraitImage/PortraitArtworkCarrier/PortraitArtwork') : null;
    const rightContent = root ? root.getChildByPath('RightContentArea') : null;
    const rightTabs = root ? root.getChildByPath('RightTabBar') : null;
    const background = root ? root.getChildByPath('BackgroundFull') : null;
    const sprite = artwork ? artwork.getComponent(cc.Sprite) : null;
    const portraitSprite = portrait ? portrait.getComponent(cc.Sprite) : null;
    const carrierTransform = carrier ? carrier.getComponent(cc.UITransform) : null;
    const portraitTransform = portrait ? portrait.getComponent(cc.UITransform) : null;
    const artworkTransform = artwork ? artwork.getComponent(cc.UITransform) : null;
    const portraitOpacity = portrait ? portrait.getComponent(cc.UIOpacity) : null;
    const carrierOpacity = carrier ? carrier.getComponent(cc.UIOpacity) : null;
    const artworkOpacity = artwork ? artwork.getComponent(cc.UIOpacity) : null;
    const portraitMask = portrait ? portrait.getComponent(cc.Mask) : null;
    const carrierMask = carrier ? carrier.getComponent(cc.Mask) : null;
    const artworkMask = artwork ? artwork.getComponent(cc.Mask) : null;
    const state = window.__UI_CAPTURE_STATE__ ?? null;
    const ancestry = [];
    if (artwork) {
      let current = artwork;
      while (current) {
        ancestry.push({
          name: current.name,
          localX: current.position.x,
          localY: current.position.y,
          worldX: current.worldPosition.x,
          worldY: current.worldPosition.y,
        });
        current = current.parent;
        if (current && current.name === 'Scene') {
          ancestry.push({
            name: current.name,
            localX: current.position.x,
            localY: current.position.y,
            worldX: current.worldPosition.x,
            worldY: current.worldPosition.y,
          });
          break;
        }
      }
    }
    return {
      sceneName: scene ? scene.name : null,
      root: !!root,
      portrait: !!portrait,
      carrier: !!carrier,
      artwork: !!artwork,
      portraitActive: portrait ? portrait.active : null,
      carrierActive: carrier ? carrier.active : null,
      artworkActive: artwork ? artwork.active : null,
      portraitActiveInHierarchy: portrait ? portrait.activeInHierarchy : null,
      carrierActiveInHierarchy: carrier ? carrier.activeInHierarchy : null,
      artworkActiveInHierarchy: artwork ? artwork.activeInHierarchy : null,
      portraitSize: portraitTransform ? { width: portraitTransform.width, height: portraitTransform.height, anchorX: portraitTransform.anchorX, anchorY: portraitTransform.anchorY } : null,
      carrierSize: carrierTransform ? { width: carrierTransform.width, height: carrierTransform.height, anchorX: carrierTransform.anchorX, anchorY: carrierTransform.anchorY } : null,
      portraitNode: portrait ? { x: portrait.position.x, y: portrait.position.y, scaleX: portrait.scale.x, scaleY: portrait.scale.y } : null,
      carrierNode: carrier ? { x: carrier.position.x, y: carrier.position.y, scaleX: carrier.scale.x, scaleY: carrier.scale.y } : null,
      artworkNode: artwork ? { x: artwork.position.x, y: artwork.position.y, scaleX: artwork.scale.x, scaleY: artwork.scale.y } : null,
      portraitWorld: portrait ? { x: portrait.worldPosition.x, y: portrait.worldPosition.y, z: portrait.worldPosition.z } : null,
      carrierWorld: carrier ? { x: carrier.worldPosition.x, y: carrier.worldPosition.y, z: carrier.worldPosition.z } : null,
      artworkWorld: artwork ? { x: artwork.worldPosition.x, y: artwork.worldPosition.y, z: artwork.worldPosition.z } : null,
      rightContentWorld: rightContent ? { x: rightContent.worldPosition.x, y: rightContent.worldPosition.y, z: rightContent.worldPosition.z } : null,
      rightTabsWorld: rightTabs ? { x: rightTabs.worldPosition.x, y: rightTabs.worldPosition.y, z: rightTabs.worldPosition.z } : null,
      backgroundWorld: background ? { x: background.worldPosition.x, y: background.worldPosition.y, z: background.worldPosition.z } : null,
      portraitOpacity: portraitOpacity ? portraitOpacity.opacity : null,
      carrierOpacity: carrierOpacity ? carrierOpacity.opacity : null,
      artworkOpacity: artworkOpacity ? artworkOpacity.opacity : null,
      portraitMask: portraitMask ? { type: portraitMask.type, enabled: portraitMask.enabledInHierarchy } : null,
      carrierMask: carrierMask ? { type: carrierMask.type, enabled: carrierMask.enabledInHierarchy } : null,
      artworkMask: artworkMask ? { type: artworkMask.type, enabled: artworkMask.enabledInHierarchy } : null,
      artworkSpriteColor: sprite ? { r: sprite.color.r, g: sprite.color.g, b: sprite.color.b, a: sprite.color.a } : null,
      spriteFrame: sprite && sprite.spriteFrame ? { width: sprite.spriteFrame.width, height: sprite.spriteFrame.height, originalWidth: sprite.spriteFrame.originalSize.width, originalHeight: sprite.spriteFrame.originalSize.height, offsetX: sprite.spriteFrame.offset.x, offsetY: sprite.spriteFrame.offset.y } : null,
      portraitSpriteFrame: portraitSprite && portraitSprite.spriteFrame ? { width: portraitSprite.spriteFrame.width, height: portraitSprite.spriteFrame.height } : null,
      allGeneralDetailNodes: scene ? (() => {
        const matches = [];
        const walk = (node, depth = 0) => {
          if (!node) return;
          if (node.name.includes('GeneralDetail') || node.name.includes('Portrait')) {
            matches.push({ name: node.name, depth, active: node.active, activeInHierarchy: node.activeInHierarchy });
          }
          for (const child of node.children || []) {
            walk(child, depth + 1);
          }
        };
        walk(scene, 0);
        return matches;
      })() : [],
      rootChildren: root ? root.children.map((n) => n.name) : [],
      ancestry,
      state,
      href: location.href,
    };
  });

  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
