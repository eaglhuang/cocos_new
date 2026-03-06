import { IDragEvent } from '../../../../../../@types/private';
export declare class DragDrop {
    private handlers;
    private initialized;
    constructor();
    init(): Promise<void>;
    onDragLeave(event: IDragEvent): Promise<void>;
    onDragOver(event: IDragEvent): Promise<void>;
    onDrop(event: IDragEvent): Promise<void>;
}
