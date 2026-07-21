/**
 * Unit.js - 单位基类
 * 所有战斗单位(小兵、异兽)的共同父类
 * 
 * 属性说明：
 * - id: 唯一ID
 * - displayName: 显示名称(如"木兵"、"青龙")
 * - type: 类型('soldier'|'beast')
 * - level: 等级
 * - quality: 品质(common/rare/epic/legendary)
 * - atk: 攻击力
 * - atkSpeed: 攻击速度(秒/次)
 * - range: 攻击距离(格数)
 * - attackType: 攻击类型(single/splash/pierce/burning)
 * - color: 显示颜色
 * - tile: 所在的地块实例
 * 
 * 修改指南：
 * - 新增属性 → 在constructor和子类中添加
 * - 修改攻击逻辑 → 在BattleSystem.js中处理
 */
class Unit {
    constructor(data = {}) {
        this.id = data.id || Helpers.generateId();
        this.displayName = data.displayName || '未知';
        this.type = data.type || 'soldier';

        /** 等级 */
        this.level = data.level || 1;

        /** 品质 */
        this.quality = data.quality || 'common';

        /** 攻击力(基础值，实际值=baseAtk * 等级系数) */
        this._baseAtk = data.baseAtk || 10;
        this.atk = this._calculateAtk();

        /** 攻速(次/秒) - 保留原始值用于展示 */
        this._baseSpeed = data.baseSpeed || 1.0;
        /** 攻击冷却(秒/次) - 冷却 = 1 / 攻速 */
        this.atkSpeed = 1 / this._baseSpeed;

        /** 攻击距离(格数) */
        this.range = data.range || 3;

        /** 攻击类型 */
        this.attackType = data.attackType || 'single';

        /** 攻击冷却计时(秒) */
        this._attackCooldown = 0;

        /** 颜色 */
        this.color = data.color || '#888';

        /** 所在的地块 */
        this.tile = null;

        /** 额外属性(子类使用) */
        this.data = data;
    }

    /**
     * 计算实际攻击力 = 基础值 × 等级系数
     */
    _calculateAtk() {
        const multiplier = CONFIG.MERGE.LEVEL_MULTIPLIER[this.level - 1] || 1;
        return Math.floor(this._baseAtk * multiplier);
    }

    /**
     * 获取单位最大等级
     */
    getMaxLevel() {
        if (this.type === 'beast') {
            return CONFIG.MERGE.BEAST_MAX_LEVEL || 3;
        }
        return CONFIG.MERGE.SOLDIER_MAX_LEVEL || 3;
    }

    /**
     * 升级单位
     * @returns {number} 新等级
     */
    levelUp() {
        if (this.level >= this.getMaxLevel()) return this.level;
        this.level++;
        this.atk = this._calculateAtk(); // 重新计算攻击力
        return this.level;
    }

    /**
     * 攻击冷却更新(由BattleSystem每帧调用)
     * @returns {boolean} 是否可以攻击
     */
    canAttack() {
        return this._attackCooldown <= 0;
    }

    /**
     * 重置攻击冷却
     */
    resetCooldown() {
        this._attackCooldown = this.atkSpeed;
    }

    /**
     * 更新冷却时间
     * @param {number} dt - 帧间隔(秒)
     */
    updateCooldown(dt) {
        if (this._attackCooldown > 0) {
            this._attackCooldown -= dt;
        }
    }

    /**
     * 获取品质对应颜色
     */
    getQualityColor() {
        const colors = {
            common: '#9e9e9e',
            rare: '#4ecdc4',
            epic: '#a855f7',
            legendary: '#f0d78c',
        };
        return colors[this.quality] || colors.common;
    }

    /**
     * 获取棋子边框颜色
     */
    getFrameColor() {
        if (this.type === 'soldier' && !this._beastChar && this.level >= 5) {
            return '#ffd54f';
        }
        return this.getQualityColor();
    }

    /**
     * 获取品质中文名
     */
    getQualityName() {
        const names = {
            common: '普通',
            rare: '稀有',
            epic: '史诗',
            legendary: '传说',
        };
        return names[this.quality] || '普通';
    }

    /**
     * 获取攻击类型中文名
     */
    getAttackTypeName() {
        const names = {
            single: '单体',
            splash: '范围',
            burning: '灼烧',
            pierce: '穿刺',
            knockback: '击退',
            stun: '眩晕',
        };
        return names[this.attackType] || this.attackType;
    }

    /**
     * 获取完整的单位信息
     */
    getInfo() {
        return {
            name: this.displayName,
            type: this.type === 'soldier' ? (this._beastChar ? '异兽字' : '小兵') : '异兽',
            level: this.level,
            quality: this.getQualityName(),
            atk: this.atk,
            atkSpeed: this._baseSpeed.toFixed(1),
            range: this.range + '格',
            attackType: this.getAttackTypeName(),
            tilePos: this.tile ? `(${this.tile.row},${this.tile.col})` : '未放置',
        };
    }
}
