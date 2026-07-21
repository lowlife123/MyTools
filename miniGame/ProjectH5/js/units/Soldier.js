/**
 * Soldier.js - 小兵单位类
 * 继承自Unit基类，代表五大元素兵种
 * 
 * 五种兵种：
 *   木(绿) - 中距范围攻击，升级链: 木→林→森→森→森
 *   水(蓝) - 远距单体攻击，升级链: 水→冰→淼→淼→淼
 *   火(红) - 近战范围灼烧，升级链: 火→炎→焱→焱→焱
 *   土(棕) - 近距单体高伤，升级链: 土→圭→垚→垚→垚
 *   金(金) - 中距穿刺攻击，升级链: 金→鍂→鑫→鑫→鑫
 * 
 * 修改指南：
 * - 新增兵种 → 在CONFIG.SOLDIER_TYPES中添加新条目
 * - 调整数值 → 修改CONFIG中对应兵种的baseAtk/baseSpeed
 * - 修改升级链名称 → 修改upgradeNames数组
 */
class Soldier extends Unit {
    /**
     * @param {string} soldierType - 兵种类型: 'mu'|'huo'|'shui'|'tu'|'jin'
     * @param {number} level - 等级(1-5)
     * @param {string} quality - 品质
     */
    constructor(soldierType, level = 1, quality = 'common') {
        const config = CONFIG.SOLDIER_TYPES[soldierType];
        if (!config) {
            Helpers.error('未知兵种类型:', soldierType);
        }

        // 根据等级获取升级链中的名称
        const upgradeIdx = Math.min(level - 1, (config?.upgradeNames || [soldierType]).length - 1);
        const displayName = config ? config.upgradeNames[upgradeIdx] || config.displayName : '?';

        super({
            displayName,
            type: 'soldier',
            level,
            quality,
            baseAtk: config?.baseAtk || 10,
            baseSpeed: config?.baseSpeed || 1.0,
            range: config?.range || 3,
            attackType: config?.attackType || 'single',
            color: config?.color || '#888',
        });

        /** 兵种类型 */
        this.soldierType = soldierType;
        /** 原始配置引用 */
        this.config = config;
    }

    /**
     * 获取升级后的名称
     * 例如: 木(Lv1) → 林(Lv2) → 森(Lv3) → 森(Lv4) → 森(Lv5)
     */
    getUpgradeName(targetLevel) {
        if (!this.config) return this.displayName;
        const idx = Math.min(targetLevel - 1, this.config.upgradeNames.length - 1);
        return this.config.upgradeNames[idx];
    }

    /**
     * 是否可以与另一个单位合成
     * 条件：同兵种类型 + 同等级 + 同品质
     */
    canMergeWith(other) {
        if (!(other instanceof Soldier)) return false;
        return this.soldierType === other.soldierType &&
               this.level === other.level &&
               this.quality === other.quality;
    }
}
