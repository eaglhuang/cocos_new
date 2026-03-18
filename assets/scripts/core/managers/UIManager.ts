import { UILayerName } from "../config/Constants";
import { UILayer } from "../../ui/layers/UILayer";

export class UIManager {
  private layerMap = new Map<UILayerName, UILayer[]>();

  public push(layerName: UILayerName, layer: UILayer): void {
    const stack = this.layerMap.get(layerName) || [];
    stack.push(layer);
    this.layerMap.set(layerName, stack);
    layer.show();
  }

  public pop(layerName: UILayerName): UILayer | null {
    const stack = this.layerMap.get(layerName);
    if (!stack || stack.length === 0) {
      return null;
    }

    const layer = stack.pop() || null;
    if (layer) {
      layer.hide();
    }
    return layer;
  }

  public peek(layerName: UILayerName): UILayer | null {
    const stack = this.layerMap.get(layerName);
    if (!stack || stack.length === 0) {
      return null;
    }

    return stack[stack.length - 1];
  }

  public clearAll(): void {
    this.layerMap.forEach((stack) => {
      stack.forEach((layer) => layer.hide());
    });
    this.layerMap.clear();
  }
}