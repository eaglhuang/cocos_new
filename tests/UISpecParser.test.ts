import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

// 定義所有合法的佈局節點類型（與 UISpecTypes.ts 對齊，防呆檢查）
const VALID_TYPES = [
    'container', 
    'panel', 
    'label', 
    'button', 
    'scroll-list', 
    'image', 
    'resource-counter', 
    'spacer'
];

describe('UI Layout Spec Data Contract Validation', () => {

    const layoutsDir = path.resolve(__dirname, '../assets/resources/ui-spec/layouts');

    if (!fs.existsSync(layoutsDir)) {
        console.warn(`[Skip] UI specification directory not found: ${layoutsDir}`);
        return;
    }

    const files = fs.readdirSync(layoutsDir).filter(f => f.endsWith('.json'));

    /**
     * 遞迴驗證節點及其子節點的 type 是否合法
     */
    function validateNode(node: any, filePath: string, parentPath: string = 'root') {
        const currentPath = `${parentPath} -> ${node.name || 'Unnamed'}`;
        
        // 1. 驗證節點類型 (Type) 是否在白名單內
        if (node.type) {
            expect(VALID_TYPES).to.include(
                node.type,
                `Invalid node type '${node.type}' found in ${filePath} at [${currentPath}]. Valid types are: ${VALID_TYPES.join(', ')}`
            );
        } else {
            // 這個專案的設計中有時候 root 可能直接是一個包含 content 的 wrapper，
            // 但標準的 UILayoutNodeSpec 必須要有 type。可以先提醒。
            throw new Error(`Missing 'type' property in node at [${currentPath}] in ${filePath}`);
        }

        // 2. 遞迴驗證所有子節點
        if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
                validateNode(child, filePath, currentPath);
            }
        }
    }

    // 動態為每個 Layout 檔案產生測試案例
    for (const file of files) {
        it(`should valid types and structure for layout spec: ${file}`, () => {
            const absolutePath = path.join(layoutsDir, file);
            const content = fs.readFileSync(absolutePath, 'utf8');
            let jsonSpec: any;

            try {
                jsonSpec = JSON.parse(content);
            } catch (e) {
                throw new Error(`Invalid JSON syntax in file: ${file}`);
            }

            // 確保護局設定的根節點存在
            expect(jsonSpec.root).to.exist;
            
            // 開始遞迴校驗
            validateNode(jsonSpec.root, file);
        });
    }
});
