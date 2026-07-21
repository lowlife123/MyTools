/**
 * Enemy.js - 敌方单位类
 * 沿固定路径自动行进，攻击终点的"字"
 * 
 * 敌方种类：
 * - 小兵(普通) - 基础敌人
 * - 弓兵(普通) - 远程攻击兵
 * - 骑兵(普通) - 移速快
 * - 将军(BOSS) - 高血量高攻击
 * 
 * 敌方AI逻辑：
 * 1. 沿路径自动前进(progress递增)
 * 2. 到达终点时攻击"字"
 * 3. 被放置的单位攻击时扣血
 * 
 * 修改指南：
 * - 新增敌人类型 → 在CONFIG.ENEMY.TYPES中添加
 * - 修改敌人属性 → 修改对应type的hp/speed/atk值
 * - 修改波次配置 → 修改CONFIG.ENEMY.WAVES
 */
class Enemy {
    /**
     * @param {string} typeKey - 敌人类型key: 'guai'|'shou'|'xiongshou'
     * @param {number} [hpMultiplier=1.0] - 血量系数（来自波次配置）
     */
    constructor(typeKey, hpMultiplier = 1.0) {
        const config = CONFIG.ENEMY.TYPES[typeKey];
        if (!config) {
            Helpers.error('未知敌人类型:', typeKey);
        }

        const baseHp = config?.hp || 30;

        this.id = Helpers.generateId();
        /** 敌人类型key */
        this.typeKey = typeKey;
        /** 显示名称 */
        this.name = config?.name || '?';
        /** 当前血量(基础HP × 波次系数) */
        this.hp = Math.floor(baseHp * hpMultiplier);
        /** 最大血量 */
        this.maxHp = Math.floor(baseHp * hpMultiplier);
        /** 移动速度(每秒走几格，如2=每秒2格) */
        this.speed = config?.speed || 0.5;
        /** 攻击力 */
        this.atk = config?.atk || 5;
        /** 类别(normal/boss) */
        this.category = config?.category || 'normal';
        /** 颜色 */
        this.color = config?.color || '#e0e0e0';

        /**
         * 在路径上的进度(0~1)
         * 0 = 起点, 1 = 终点
         */
        this.progress = 0;

        /** 是否存活 */
        this.isAlive = true;

        /** 路径总段数（由 BattleSystem 在生成后设置） */
        this._pathSegments = 32;

        /** 普通敌人是否已攻击过"字"（仅一次） */
        this._hasAttacked = false;

        /** 攻击"字"的冷却 */
        this._attackCooldown = 1.0;
        this._attackTimer = 0;

        /** 像素位置(由Board.draw计算的缓存) */
        this._px = 0;
        this._py = 0;
    }

    /**
     * 设置路径总段数
     * @param {number} n - 路径点数-1
     */
    setPathLength(n) {
        this._pathSegments = n;
    }

    /**
     * 更新敌人状态(每帧调用)
     * @param {number} dt - 帧间隔(秒)
     * @returns {string|boolean} 'singleAttack'=普通敌人一击后消失, true=凶兽持续攻击, false=无行为
     */
    update(dt) {
        if (!this.isAlive) return false;

        // 沿路径移动: progress增量 = (格/秒 × 每帧秒数) / 总段数
        this.progress += (this.speed * dt) / this._pathSegments;

        if (this.progress >= 1.0) {
            this.progress = 1.0;
            // 到达终点
            if (this.category === 'boss') {
                // 凶兽：每1秒持续攻击"字"
                this._attackTimer += dt;
                if (this._attackTimer >= this._attackCooldown) {
                    this._attackTimer = 0;
                    return true;
                }
            } else {
                // 普通敌人：攻击一次后消失
                if (!this._hasAttacked) {
                    this._hasAttacked = true;
                    return 'singleAttack';
                }
            }
        }

        return false;
    }

    /**
     * 受到伤害
     * @param {number} amount - 伤害值
     * @param {Unit} source - 伤害来源(我方单位)
     * @returns {boolean} 是否被击杀
     */
    takeDamage(amount, source = null, meta = {}) {
        const actualDamage = Math.max(0, Math.min(this.hp, Math.floor(amount)));
        this.hp -= actualDamage;
        const killed = this.hp <= 0;
        if (killed) {
            this.hp = 0;
            this.isAlive = false;
        }

        EventBus.emit(GAME_EVENTS.DAMAGE_DEALT, {
            target: this,
            amount: actualDamage,
            source,
            killed,
            ...meta,
        });

        // ENEMY_KILLED 事件统一由 BattleSystem._processAttack 发送(附带inkReward)
        return killed;
    }

    /**
     * 获取像素位置
     */
    getPosition() {
        return { x: this._px, y: this._py };
    }

    /**
     * 获取距离"字"的剩余距离(格数)
     */
    getDistanceToEnd(pathLength) {
        return Math.max(0, (1 - this.progress) * pathLength);
    }
}
