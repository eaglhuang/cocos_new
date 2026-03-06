import { Vec3, geometry } from 'cc';
declare const ray: typeof geometry.Ray;
type ray = geometry.Ray;
declare const aabb: typeof geometry.AABB;
type aabb = geometry.AABB;
declare const triangle: typeof geometry.Triangle;
type triangle = geometry.Triangle;
declare const intersect: {
    ray_triangle: (ray: ray, triangle: triangle, doubleSided: boolean | undefined, hitPos: Vec3) => number;
    ray_aabb: (ray: ray, aabb: aabb) => number;
    ray_segment: (ray: ray, v0: Vec3, v1: Vec3, precision: number | undefined, hitPos: Vec3) => number;
};
export default intersect;
