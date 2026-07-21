/**
 * EconomySystem.js - 经济系统
 * 管理墨水(局内货币)、铲子数量和买卖操作
 * 
 * 修改指南：
 * - 调整起始资源 → 修改CONFIG.ECONOMY.STARTING_INK
 * - 调整价格 → 修改CONFIG.ECONOMY.GACHA_COST等
 * - 新增消费项 → 添加spendXxx方法
 */
class EconomySystem {
    constructor() {
        /** 当前墨水数量 */
        this.ink = CONFIG.ECONOMY.STARTING_INK;
        /** 铲子数量 */
        this.shovels = 0;
    }

    /**
     * 初始化经济
     */
    init() {
        this.ink = CONFIG.ECONOMY.STARTING_INK;
        this.shovels = 0;
        this._emitUpdate();
    }

    /**
     * 每帧更新(墨水通过击杀敌人获取，不再随时间恢复)
     * @param {number} dt - 帧间隔(秒)
     */
    update(dt) {
        // 墨水不再随时间恢复，通过击杀敌人获取
    }

    /**
     * 消耗墨水
     * @param {number} amount - 消耗量
     * @returns {boolean} 是否成功
     */
    spendInk(amount) {
        if (this.ink < amount) {
            Helpers.log('墨水不足！');
            return false;
        }
        this.ink -= amount;
        this._emitUpdate();
        return true;
    }

    /**
     * 获得墨水
     * @param {number} amount - 获得量
     */
    gainInk(amount) {
        this.ink += amount;
        this._emitUpdate();
    }

    /**
     * 获得铲子
     * @param {number} amount - 数量
     */
    gainShovel(amount = 1) {
        this.shovels += amount;
        this._emitUpdate();
    }

    /**
     * 使用铲子
     * @returns {boolean} 是否成功
     */
    useShovel() {
        if (this.shovels <= 0) return false;
        this.shovels--;
        this._emitUpdate();
        return true;
    }

    /**
     * 出售单位回收获墨水
     * @param {Unit} unit - 要出售的单位
     * @returns {number} 回收的墨水数量
     */
    sellUnit(unit) {
        const refund = Math.floor(CONFIG.ECONOMY.GACHA_COST * CONFIG.ECONOMY.SELL_REFUND_RATIO);
        this.gainInk(refund);
        Helpers.log(`出售 ${unit.displayName}，回收 ${refund} 墨水`);
        return refund;
    }

    /**
     * 是否可以征兵
     */
    canGacha() {
        return this.ink >= CONFIG.ECONOMY.GACHA_COST;
    }

    /**
     * 派发更新事件
     */
    _emitUpdate() {
        EventBus.emit(GAME_EVENTS.INK_CHANGE, {
            amount: this.ink,
        });
        EventBus.emit(GAME_EVENTS.SHOVEL_CHANGE, {
            count: this.shovels,
        });
    }
}
