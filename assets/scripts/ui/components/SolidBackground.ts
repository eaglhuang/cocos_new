// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Component, UITransform, Color, Sprite, SpriteFrame, Texture2D, Rect } from 'cc';
const { ccclass, property, requireComponent, executeInEditMode } = _decorator;

// 全域共用的 1x1 實體純白 SpriteFrame Cache
let sharedWhiteSpriteFrame: SpriteFrame | null = null;

function getSharedWhiteSpriteFrame(): SpriteFrame {
    if (sharedWhiteSpriteFrame) return sharedWhiteSpriteFrame;
    
    // 動態建構 1x1 白色 Texture，徹底擺脫外部 meta 錯誤及 Editor 快取 bug
    const tex = new Texture2D();
    tex.reset({ width: 2, height: 2, format: Texture2D.PixelFormat.RGBA8888 });
    const data = new Uint8Array(16);
    data.fill(255);
    tex.uploadData(data);
    
    const sf = new SpriteFrame();
    sf.texture = tex;
    // 重點：需賦予 packable = false，且必定定義 rect
    sf.packable = false;
    sf.rect = new Rect(0, 0, 2, 2); 
    
    sharedWhiteSpriteFrame = sf;
    return sharedWhiteSpriteFrame;
}

/**
 * 實用的 UI 底板元件：自動掛載 Sprite 並賦予純色
 */
@ccclass('SolidBackground')
@requireComponent(UITransform)
@executeInEditMode
export class SolidBackground extends Component {

    @property(Color)
    private _color: Color = new Color(255, 255, 255, 255);

    @property(Color)
    get color(): Color { return this._color; }
    set color(val: Color) {
        this._color = val;
        this.updateColor();
    }

    private _sprite: Sprite | null = null;

    onLoad() {
        this._sprite = this.getComponent(Sprite) || this.addComponent(Sprite);
        
        // 唯有當 Node 上沒有任何 SpriteFrame 時，才掛上我們自製的白圖。
        // 這保證了它「絕對不會蓋掉」美術精心挑選的九宮格/Atlas！
        if (!this._sprite.spriteFrame) {
            this._sprite.sizeMode = Sprite.SizeMode.CUSTOM; // 【關鍵修復】必須先設為 CUSTOM，否則 UITransform Size 會被刷成 2x2！
            this._sprite.type = Sprite.Type.SIMPLE;
            this._sprite.spriteFrame = getSharedWhiteSpriteFrame();
        }
        this.updateColor();
    }

    onEnable() {
        this.updateColor();
    }

    private updateColor() {
        if (!this._sprite) return;
        this._sprite.color = this._color;
    }
}

