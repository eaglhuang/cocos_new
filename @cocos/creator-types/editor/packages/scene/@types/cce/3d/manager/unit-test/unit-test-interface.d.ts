import type { SceneFacadeManager } from '../../facade/scene-facade-manager';
interface IUnitTest {
    test(facadeMgr: SceneFacadeManager): Promise<boolean>;
    clear(): Promise<boolean>;
}
declare function clearTestDir(): Promise<void>;
declare function getTestDir(): string;
declare function delay(ms: number): Promise<unknown>;
export { delay, IUnitTest, clearTestDir, getTestDir };
