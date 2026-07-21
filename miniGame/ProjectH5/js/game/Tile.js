/**
 * Tile.js - 单个地块类
 * 一个5×8棋盘上的单元格，可以放置单位
 * 
 * 属性说明：
 * - row, col: 棋盘坐标
 * - unlocked: 是否已解锁（初始未解锁的地块不可放置）
 * - unit: 当前放置的单位(Unit实例)，null为空
 * - isPath: 是否是敌人路径上的地块
 * - isWord: 是否是"字"所在位置
 * 
 * 修改指南：
 * - 调整地块维度 → 修改CONFIG.BOARD
 * - 调整地块颜色 → 修改draw方法中的颜色值
 */
class Tile {
    /**
     * @param {number} row - 行坐标
     * @param {number} col - 列坐标
     */
    constructor(row, col) {
        this.row = row;
        this.col = col;
        this.unlocked = false;
        this.unit = null;       // 当前放置的单位(Unit实例或null)
        this.isPath = false;    // 敌人路径地块
        this.isWord = false;    // "字"所在地块
        this.isStart = false;   // 敌人起点
        this.hasShovel = false; // 是否有铲子待使用
        this._highlighted = false;
        this._selected = false;
        this._comboBeast = null; // 如果是组合异兽的右格，引用Beast实例
    }

    /**
     * 放置单位到地块
     * @param {Unit} unit - 要放置的单位实例
     */
    placeUnit(unit) {
        if (!this.unlocked) return false;
        if (this.isPath) return false; // 路径上不能放单位
        if (this.unit) return false;   // 已有单位
        this.unit = unit;
        unit.tile = this;
        EventBus.emit(GAME_EVENTS.UNIT_PLACED, { unit, tile: this });
        return true;
    }

    /**
     * 移除地块上的单位
     * @returns {Unit|null} 被移除的单位
     */
    removeUnit() {
        const unit = this.unit;
        if (unit) {
            // 如果是组合异兽，清除右格的组合引用
            if (unit._isComboBeast && unit._comboTileRight) {
                unit._comboTileRight._comboBeast = null;
            }
            unit.tile = null;
            this.unit = null;
            EventBus.emit(GAME_EVENTS.UNIT_REMOVED, { unit, tile: this });
        }
        return unit;
    }

    /**
     * 解锁地块
     */
    unlock() {
        if (!this.unlocked) {
            this.unlocked = true;
            EventBus.emit(GAME_EVENTS.TILE_UNLOCKED, { row: this.row, col: this.col });
        }
    }

    /**
     * 地块是否可用（已解锁且非路径）
     */
    get isAvailable() {
        return this.unlocked && !this.isPath && !this.unit && !this._comboBeast;
    }

    /**
     * 获取地块显示颜色（供Board绘制用）
     */
    getDisplayColor() {
        if (this.isWord) return '#ef5350';      // 红色 - "字"位置
        if (this.isStart) return '#66bb6a';     // 绿色 - 敌人起点
        if (this.isPath) return '#5c6bc0';      // 蓝色 - 敌人路径
        if (this._selected) return '#ffd54f';   // 金色 - 选中
        if (this._highlighted) return '#b39ddb'; // 紫色 - 高亮
        if (this.unlocked) return '#37474f';     // 深灰 - 已解锁空地
        return '#263238';                        // 暗灰 - 未解锁
    }
}
