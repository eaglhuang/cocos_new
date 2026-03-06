import { IDragEvent } from '../../../../../@types/private';
export declare class DragDrop {
    constructor();
    canDrop(type: string): boolean;
    onDragOver(event: IDragEvent): void;
    onDrop(event: IDragEvent): Promise<void>;
}
//# sourceMappingURL=drag-drop.d.ts.map