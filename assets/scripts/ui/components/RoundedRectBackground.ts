import { _decorator, Color, Component, Graphics, Node, UITransform } from 'cc';

const { ccclass, executeInEditMode, property, requireComponent } = _decorator;

@ccclass('RoundedRectBackground')
@requireComponent(UITransform)
@executeInEditMode
export class RoundedRectBackground extends Component {

    @property(Color)
    private _fillColor: Color = new Color(255, 255, 255, 255);

    @property(Color)
    get fillColor(): Color { return this._fillColor; }
    set fillColor(value: Color) {
        this._fillColor = value;
        this._redraw();
    }

    @property(Color)
    private _borderColor: Color = new Color(255, 255, 255, 0);

    @property(Color)
    get borderColor(): Color { return this._borderColor; }
    set borderColor(value: Color) {
        this._borderColor = value;
        this._redraw();
    }

    @property
    private _cornerRadius = 0;

    @property
    get cornerRadius(): number { return this._cornerRadius; }
    set cornerRadius(value: number) {
        this._cornerRadius = Math.max(0, value);
        this._redraw();
    }

    @property
    private _borderWidth = 0;

    @property
    get borderWidth(): number { return this._borderWidth; }
    set borderWidth(value: number) {
        this._borderWidth = Math.max(0, value);
        this._redraw();
    }

    private _graphics: Graphics | null = null;

    onLoad(): void {
        this._graphics = this.getComponent(Graphics) || this.addComponent(Graphics);
        this.node.on(Node.EventType.SIZE_CHANGED, this._redraw, this);
        this._redraw();
    }

    onEnable(): void {
        this._redraw();
    }

    onDestroy(): void {
        this.node.off(Node.EventType.SIZE_CHANGED, this._redraw, this);
    }

    private _redraw(): void {
        const graphics = this._graphics || this.getComponent(Graphics) || this.addComponent(Graphics);
        const transform = this.getComponent(UITransform);
        if (!graphics || !transform) {
            return;
        }

        const width = transform.width;
        const height = transform.height;
        graphics.clear();
        if (width <= 0 || height <= 0) {
            return;
        }

        const radius = Math.min(this._cornerRadius, width * 0.5, height * 0.5);
        const halfWidth = width * 0.5;
        const halfHeight = height * 0.5;

        if (this._fillColor.a > 0) {
            graphics.fillColor = this._fillColor;
            graphics.roundRect(-halfWidth, -halfHeight, width, height, radius);
            graphics.fill();
        }

        if (this._borderWidth > 0 && this._borderColor.a > 0) {
            const inset = this._borderWidth * 0.5;
            const innerWidth = Math.max(0, width - this._borderWidth);
            const innerHeight = Math.max(0, height - this._borderWidth);
            if (innerWidth > 0 && innerHeight > 0) {
                graphics.lineWidth = this._borderWidth;
                graphics.strokeColor = this._borderColor;
                graphics.roundRect(
                    -halfWidth + inset,
                    -halfHeight + inset,
                    innerWidth,
                    innerHeight,
                    Math.max(0, radius - inset),
                );
                graphics.stroke();
            }
        }
    }
}