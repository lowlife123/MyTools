/**
 * MergeSystem.js - 合成升级系统
 * 管理小兵间的合成操作
 * 
 * 合成规则：
 * 1. 小兵合成：同兵种 + 同等级 + 同品质 → 合成高一级
 * 2. 异兽合成：异兽字在棋盘上左右相邻时自动组合（由GameManager检测触发）
 * 3. 最高等级不可再合成
 * 
 * 修改指南：
 * - 修改合成规则 → 修改canMerge方法
 * - 修改升级效果 → 修改performMerge中的逻辑
 */
class MergeSystem {
    constructor() {
        /** 合成历史记录(用于撤回) */
        this._history = [];
    }

    /**
     * 检查两个单位是否可合成（仅小兵合成）
     * 异兽合成由GameManager自动检测相邻位置触发
     * @param {Unit} unitA
     * @param {Unit} unitB
     * @returns {{ canMerge: boolean, reason: string }}
     */
    canMerge(unitA, unitB) {
        if (!unitA || !unitB) {
            return { canMerge: false, reason: '单位无效' };
        }
        if (unitA === unitB) {
            return { canMerge: false, reason: '不能合成同一单位' };
        }
        if (unitA._beastChar || unitB._beastChar) {
            return { canMerge: false, reason: '异兽字需左右相邻自动组合' };
        }
        if (unitA instanceof Beast || unitB instanceof Beast) {
            return { canMerge: false, reason: '异兽不能合成' };
        }
        if (unitA.level >= unitA.getMaxLevel() || unitB.level >= unitB.getMaxLevel()) {
            return { canMerge: false, reason: '已达到最高等级' };
        }

        // 小兵合成
        if (unitA instanceof Soldier && unitB instanceof Soldier) {
            if (unitA.soldierType !== unitB.soldierType) {
                return { canMerge: false, reason: '兵种不同，无法合成' };
            }
            if (unitA.level !== unitB.level) {
                return { canMerge: false, reason: '等级不同，无法合成' };
            }
            if (unitA.quality !== unitB.quality) {
                return { canMerge: false, reason: '品质不同，无法合成' };
            }
            return { canMerge: true, reason: '' };
        }

        return { canMerge: false, reason: '单位类型不匹配' };
    }

    /**
     * 检测两个异兽字是否可以组合成异兽（供GameManager调用）
     * @returns {{ canMerge: boolean, beastKey: string|null }}
     */
    checkBeastPair(charA, charB) {
        if (!charA || !charB) return { canMerge: false, beastKey: null };
        if (!charA._beastChar || !charB._beastChar) return { canMerge: false, beastKey: null };

        for (const [key, beastConfig] of Object.entries(CONFIG.BEASTS)) {
            const first = beastConfig.nameFirst;
            const second = beastConfig.nameSecond;
            if ((charA._beastChar === first && charB._beastChar === second) ||
                (charA._beastChar === second && charB._beastChar === first)) {
                return { canMerge: true, beastKey: key };
            }
        }
        return { canMerge: false, beastKey: null };
    }

    /**
     * 执行异兽自动组合（供GameManager调用）
     * @returns {{ success: boolean, result: Unit|null }}
     */
    combineBeast(charA, charB, beastKey) {
        const beast = new Beast(beastKey, 1);
        this._history.push({
            type: 'beast_combine',
            consumed: [charA, charB],
            result: beast,
            detail: `异兽字【${charA.displayName}】+【${charB.displayName}】→ 异兽【${beast.displayName}】`,
        });

        EventBus.emit(GAME_EVENTS.MERGE_SUCCESS, {
            from: [charA, charB],
            to: beast,
        });

        Helpers.log(`异兽自动合成：${charA.displayName}+${charB.displayName} → 【${beast.displayName}】`);
        return { success: true, result: beast };
    }

    /**
     * 执行小兵合成
     * @param {Unit} unitA - 将被消耗
     * @param {Unit} unitB - 将被消耗
     * @returns {{ success: boolean, result: Unit|null, message: string }}
     */
    performMerge(unitA, unitB) {
        const check = this.canMerge(unitA, unitB);
        if (!check.canMerge) {
            return { success: false, result: null, message: check.reason };
        }

        const newLevel = unitA.level + 1;
        const soldierType = unitA.soldierType;
        const resultUnit = new Soldier(soldierType, newLevel, unitA.quality);
        this._history.push({
            type: 'soldier_merge',
            consumed: [unitA, unitB],
            result: resultUnit,
            detail: `合成 ${unitA.displayName}+${unitB.displayName} → 【${resultUnit.displayName}】Lv${newLevel}`,
        });

        EventBus.emit(GAME_EVENTS.MERGE_SUCCESS, {
            from: [unitA, unitB],
            to: resultUnit,
        });

        Helpers.log(check.reason || `合成成功: ${resultUnit.displayName} Lv${resultUnit.level}`);
        return {
            success: true,
            result: resultUnit,
            message: `合成成功！${resultUnit.displayName} Lv${resultUnit.level}`,
        };
    }

    /**
     * 撤回上次合成
     * @returns {{ success: boolean, unlocked: Unit[]|null }}
     */
    undoMerge() {
        const lastMerge = this._history.pop();
        if (!lastMerge) {
            return { success: false, unlocked: null };
        }
        return {
            success: true,
            unlocked: lastMerge.consumed,
        };
    }

    /**
     * 获取合成历史
     */
    getHistory() {
        return [...this._history];
    }
}
