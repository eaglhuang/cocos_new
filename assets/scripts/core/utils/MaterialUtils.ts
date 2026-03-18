import { MeshRenderer, Material } from 'cc';

/**
 * Safe wrapper for setting a material on a MeshRenderer that tolerates
 * different engine overloads and avoids using deprecated signatures in code.
 *
 * Usage: import { setMaterialSafe } from "../utils/MaterialUtils";
 */
export function setMaterialSafe(mr: MeshRenderer, mat: Material | null, index = 0): void {
    const anyMr = mr as any;
    try {
        // Try common overloads in a safe order. Use `any` to avoid TS deprecated warnings.
        if (typeof anyMr.setMaterial === 'function') {
            // Try (material, index)
            try {
                anyMr.setMaterial(mat, index);
                return;
            } catch (e) {
                // fallback
            }
            // Try (index, material)
            try {
                anyMr.setMaterial(index, mat);
                return;
            } catch (e) {
                // fallback
            }
        }

        // Fallback: if materials array exists, replace a copy and reassign to trigger update
        if (Array.isArray(anyMr.materials)) {
            const copy = anyMr.materials.slice();
            copy[index] = mat;
            anyMr.materials = copy;
            return;
        }

        console.warn('[MaterialUtils] setMaterialSafe: could not apply material (unsupported renderer API)');
    } catch (err) {
        console.warn('[MaterialUtils] setMaterialSafe error', err);
    }
}

export default { setMaterialSafe };
