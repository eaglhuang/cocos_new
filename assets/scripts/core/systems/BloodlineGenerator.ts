import { GeneralConfig, GeneralGeneConfig } from "../models/GeneralUnit";

/**
 * BloodlineGenerator — 14 人血統樹自動生成腳本
 * 
 * 用途：
 * 1. 當武將資料缺失血統時，自動遞迴生成 14 位先祖的模擬資料。
 * 2. 產出符合《血統樹 14 人 UI 規格書》結構的基因、名稱與屬性。
 */
export class BloodlineGenerator {
    private static readonly SURNAMES = ["張", "關", "趙", "劉", "曹", "孫", "呂", "夏侯", "諸葛", "司馬"];
    private static readonly GIVEN_NAMES = ["烈", "雲", "飛", "羽", "備", "操", "權", "布", "淵", "亮", "懿"];
    private static readonly LOCATIONS = ["幽州", "并州", "冀州", "青州", "兗州", "豫州", "徐州", "荊州", "揚州", "益州", "涼州"];
    private static readonly GENE_TYPES = ["戰鬥", "兵種", "戰法", "統率", "謀略", "人格", "武裝", "內政"];
    private static readonly GENE_NAMES: Record<string, string[]> = {
        "戰鬥": ["豪膽", "霸武", "膽量", "強襲", "破陣"],
        "兵種": ["騎戰直覺", "赤兔馭者", "龍膽突破", "步伐傳承", "連弩精通"],
        "戰法": ["戰吼傳承", "突軍破陣", "月牙刀斬", "龍魂突刺", "兵不厭詐"],
        "統率": ["軍紀", "號令", "協防", "急攻", "斷糧"],
        "謀略": ["權謀", "疑兵", "火攻", "連環", "空城"],
        "人格": ["義勇", "狂烈", "治世", "梟雄", "仁愛"],
        "武裝": ["刀鋒傳承", "鐵壁", "貫穿", "重打", "靈動"],
        "內政": ["推演", "屯田", "徵收", "修築", "商才"]
    };

    /**
     * 為指定武將補全 14 人血統樹資料
     * @param general 原始武將資料
     * @returns 補全後的武將資料
     */
    public static fillBloodline(general: GeneralConfig): GeneralConfig {
        if (!general.genes || general.genes.length === 0) {
            general.genes = this.generateRandomGenes(5);
        }

        if (!general.parentsSummary || general.parentsSummary.includes("🔒")) {
            const father = this.getRandomName();
            const mother = `${this.getRandomSurname()}氏`;
            general.parentsSummary = `父：${father} / 母：${mother}`;
        }

        if (!general.ancestorsSummary || general.ancestorsSummary.includes("已建立")) {
            general.ancestorsSummary = "已透過 A.I. 祖譜算法補完 14 人完整系譜，包含 8 位曾祖父母與 4 位祖父母。";
        }

        // 目前將詳細的 14 人樹狀資料存放在擴充欄位中，供 UI 邏輯讀取
        // 結構比照：[Gen1: 8人, Gen2: 4人, Gen3: 2人]
        (general as any).ancestorTree = {
            gen1: Array.from({ length: 8 }, (_, i) => this.generateAncestorNode(`G1_${i < 4 ? 'F' : 'M'}${i % 4}`)),
            gen2: Array.from({ length: 4 }, (_, i) => this.generateAncestorNode(`G2_${i < 2 ? 'F' : 'M'}${i % 2}`)),
            gen3: Array.from({ length: 2 }, (_, i) => this.generateAncestorNode(`G3_${i === 0 ? 'F' : 'M'}`))
        };

        return general;
    }

    private static generateAncestorNode(code: string) {
        const type = this.GENE_TYPES[Math.floor(Math.random() * this.GENE_TYPES.length)];
        const geneName = this.GENE_NAMES[type][Math.floor(Math.random() * this.GENE_NAMES[type].length)];
        
        return {
            code: code,
            name: this.getRandomName(),
            location: this.LOCATIONS[Math.floor(Math.random() * this.LOCATIONS.length)],
            gene: {
                displayName: geneName,
                type: type,
                level: Math.floor(Math.random() * 3) + 1
            }
        };
    }

    private static generateRandomGenes(count: number): GeneralGeneConfig[] {
        const genes: GeneralGeneConfig[] = [];
        for (let i = 0; i < count; i++) {
            const type = this.GENE_TYPES[Math.floor(Math.random() * this.GENE_TYPES.length)];
            const geneName = this.GENE_NAMES[type][Math.floor(Math.random() * this.GENE_NAMES[type].length)];
            genes.push({
                id: `gene_auto_${i}`,
                displayName: geneName,
                type: type,
                level: Math.floor(Math.random() * 3) + 1,
                description: `自動生成的${type}系傳承因子。`,
                isLocked: i > 2,
                discoveryLevel: (i + 1) * 10
            });
        }
        return genes;
    }

    private static getRandomName(): string {
        return this.getRandomSurname() + this.GIVEN_NAMES[Math.floor(Math.random() * this.GIVEN_NAMES.length)];
    }

    private static getRandomSurname(): string {
        return this.SURNAMES[Math.floor(Math.random() * this.SURNAMES.length)];
    }
}
