/**
 * ItemSystem.js - 道具系统
 * 管理主动/被动道具的购买和使用
 * 
 * 修改指南：
 * - 新增道具 → 在CONFIG.ITEMS中添加条目
 * - 修改道具效果 → 修改useItem中的对应逻辑
 */
class ItemSystem {
    constructor(economy) {
        this.economy = economy;
        /** 拥有的主动道具 [{name, desc, count}, ...] */
        this.activeItems = [];
        /** 已激活的被动道具 [{name, desc}, ...] */
        this.passiveItems = [];
    }

    /**
     * 购买道具
     * @param {string} category - 'active'|'passive'
     * @param {string} itemKey - 道具key
     * @returns {boolean} 是否成功
     */
    buyItem(category, itemKey) {
        const config = CONFIG.ITEMS[category]?.[itemKey];
        if (!config) {
            Helpers.warn('未知道具:', itemKey);
            return false;
        }
        if (!this.economy.spendInk(config.cost)) {
            return false;
        }

        if (category === 'active') {
            const existing = this.activeItems.find(i => i.key === itemKey);
            if (existing) {
                existing.count++;
            } else {
                this.activeItems.push({
                    key: itemKey,
                    name: config.name,
                    desc: config.desc,
                    count: 1,
                });
            }
        } else {
            // 被动道具不允许重复购买
            if (this.passiveItems.find(i => i.key === itemKey)) {
                this.economy.gainInk(config.cost); // 退款
                return false;
            }
            this.passiveItems.push({
                key: itemKey,
                name: config.name,
                desc: config.desc,
            });
        }

        Helpers.log(`购买道具: ${config.name}`);
        return true;
    }

    /**
     * 使用主动道具
     * @param {string} itemKey - 道具key
     * @returns {boolean} 是否使用成功
     */
    useItem(itemKey) {
        const idx = this.activeItems.findIndex(i => i.key === itemKey);
        if (idx === -1) return false;

        const item = this.activeItems[idx];
        item.count--;
        if (item.count <= 0) {
            this.activeItems.splice(idx, 1);
        }

        Helpers.log(`使用道具: ${item.name}`);
        return true;
    }

    /**
     * 获取被动道具提供的加成
     * @param {string} bonusType - 加成类型
     * @returns {number} 加成值
     */
    getPassiveBonus(bonusType) {
        let bonus = 0;
        for (const item of this.passiveItems) {
            if (item.key === 'inkPlus' && bonusType === 'ink') {
                bonus += 0.5; // 墨水恢复+50%
            }
            if (item.key === 'attackUp' && bonusType === 'attack') {
                bonus += 0.2; // 攻击力+20%
            }
        }
        return bonus;
    }

    /**
     * 获取所有拥有的道具列表
     */
    getAllItems() {
        return {
            active: [...this.activeItems],
            passive: [...this.passiveItems],
        };
    }
}
