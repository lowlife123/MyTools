/**
 * BattleSystem.js - 战斗系统
 * 管理所有战斗相关的逻辑：敌人波次、攻击判定、伤害计算
 * 
 * 核心功能：
 * 1. 波次管理：按CONFIG生成敌人，控制出怪节奏
 * 2. 攻击判定：检测我方单位攻击范围内的敌人
 * 3. 伤害计算：按攻击类型(单体/范围/穿刺/灼烧)计算伤害
 * 4. 敌人到达终点攻击"字"
 * 
 * 修改指南：
 * - 调整伤害公式 → 修改_calculateDamage方法
 * - 新增攻击类型 → 在_processAttack中添加新case
 * - 修改波次配置 → 修改CONFIG.ENEMY.WAVES
 */
class BattleSystem {
    /**
     * @param {Board} board - 棋盘实例
     */
    constructor(board) {
        this.board = board;

        /** 当前波次号(从1开始) */
        this.currentWave = 0;

        /** 当前波次的存活敌人列表 */
        this.enemies = [];

        /** 已死亡但尸体保留中的敌人 [{ enemy, deathTimer }] */
        this._corpses = [];

        /** 已结束的波次 */
        this.completedWaves = [];

        /** 波次是否进行中 */
        this._waveInProgress = false;

        /** 敌人生成计时器 */
        this._spawnTimer = 0;
        /** 待生成的敌人队列 */
        this._spawnQueue = [];

        /** 我方单位的攻击冷却更新 */
        this._unitUpdateTimer = 0;

        /** 当前波次的怪物等级系数（影响 HP） */
        this._currentWaveMultiplier = 1.0;
    }

    /**
     * 开始下一波
     * @returns {boolean} 是否成功开始
     */
    startNextWave() {
        if (this._waveInProgress) return false;

        this.currentWave++;
        const waveConfig = CONFIG.ENEMY.WAVES[this.currentWave - 1];
        if (!waveConfig) {
            Helpers.log('所有波次已完成！胜利！');
            return false; // 没有更多波次了 → 胜利
        }

        // 记录当前波次的怪物等级系数
        this._currentWaveMultiplier = waveConfig.levelMultiplier ?? 1.0;

        // 构建敌人生成队列
        this._spawnQueue = [];
        for (const group of waveConfig.enemies) {
            for (let i = 0; i < group.count; i++) {
                this._spawnQueue.push(group.type);
            }
        }

        this._waveInProgress = true;
        this._spawnTimer = 0;
        EventBus.emit(GAME_EVENTS.WAVE_START, { waveNum: this.currentWave });

        Helpers.log(`第 ${this.currentWave} 波开始！共 ${this._spawnQueue.length} 个敌人`);
        return true;
    }

    /**
     * 每帧更新
     * @param {number} dt - 帧间隔(秒)
     * @returns {{ enemies: Enemy[], spawns: Enemy[], kills: any[] }}
     */
    update(dt) {
        const spawns = this._updateSpawning(dt);
        const kills = this._updateAttacks(dt);
        const endReached = this._updateEnemies(dt);
        this._updateCorpses(dt);  // 更新尸体计时器

        // 检查波次是否结束（不计算尸体）
        if (this._waveInProgress && this._spawnQueue.length === 0 && this.enemies.length === 0) {
            this._waveInProgress = false;
            this.completedWaves.push(this.currentWave);
            EventBus.emit(GAME_EVENTS.WAVE_END, { waveNum: this.currentWave });
        }

        return { enemies: this.enemies, spawns, kills, endReached };
    }

    /**
     * 敌人生成逻辑
     */
    _updateSpawning(dt) {
        const spawned = [];
        this._spawnTimer += dt;

        // 根据地图配置的生成间隔出怪
        const spawnInterval = CONFIG.ENEMY.SPAWN_INTERVAL || 1.5;
        while (this._spawnQueue.length > 0 && this._spawnTimer >= spawnInterval) {
            this._spawnTimer -= spawnInterval;
            const type = this._spawnQueue.shift();
            const enemy = new Enemy(type, this._currentWaveMultiplier);
            enemy.setPathLength(this.board.path.length - 1);
            this.enemies.push(enemy);
            spawned.push(enemy);
            EventBus.emit(GAME_EVENTS.ENEMY_SPAWNED, { enemy });
        }
        return spawned;
    }

    /**
     * 我方单位攻击逻辑
     */
    _updateAttacks(dt) {
        const killed = [];

        // 更新所有我方单位的冷却
        const occupiedTiles = this.board.getOccupiedTiles();
        for (const tile of occupiedTiles) {
            const unit = tile.unit;
            if (!unit) continue;
            if (unit._beastChar) continue; // 异兽单字不能攻击，需组合后才可攻击
            unit.updateCooldown(dt);

            if (unit.canAttack()) {
                const target = this._findTarget(unit);
                if (target) {
                    const result = this._processAttack(unit, target);
                    if (result.killed) killed.push(result);
                    unit.resetCooldown();
                }
            }
        }
        return killed;
    }

    /**
     * 更新敌人移动
     */
    _updateEnemies(dt) {
        let wordDamaged = false;
        for (const enemy of this.enemies) {
            const reached = enemy.update(dt);
            if (reached) {
                // 敌人攻击"字"
                EventBus.emit(GAME_EVENTS.WORD_DAMAGED, { damage: enemy.atk });
                wordDamaged = true;
                // 普通敌人：一次攻击后消失
                if (reached === 'singleAttack') {
                    enemy.isAlive = false;
                }
            }
        }

        // 将死亡敌人移到尸体数组（保留2秒后清除）
        const alive = [];
        for (const enemy of this.enemies) {
            if (enemy.isAlive) {
                alive.push(enemy);
            } else {
                this._corpses.push({ enemy, deathTimer: 2.0 });
            }
        }
        this.enemies = alive;

        return wordDamaged;
    }

    /**
     * 更新尸体计时器，2秒后清除
     */
    _updateCorpses(dt) {
        for (let i = this._corpses.length - 1; i >= 0; i--) {
            this._corpses[i].deathTimer -= dt;
            if (this._corpses[i].deathTimer <= 0) {
                this._corpses.splice(i, 1);
            }
        }
    }

    /**
     * 寻找攻击目标(最近的路径上的敌人)
     */
    _findTarget(unit) {
        if (!unit.tile) return null;
        const range = unit.range;
        const unitPos = { row: unit.tile.row, col: unit.tile.col };

        // 找到范围内最近的敌人
        let bestTarget = null;
        let bestDist = Infinity;

        for (const enemy of this.enemies) {
            if (!enemy.isAlive) continue;

            // 根据敌人在路径上的位置判断是否在攻击范围内
            const dist = this._distanceToUnit(enemy, unitPos);
            if (dist <= range && dist < bestDist) {
                bestDist = dist;
                bestTarget = enemy;
            }
        }

        return bestTarget;
    }

    /**
     * 计算敌人到单位所在格的棋盘距离
     */
    _distanceToUnit(enemy, unitPos) {
        // 使用路径插值后的像素位置换算为格子距离，避免只按整格索引导致判定过粗
        const enemyPos = this._getEnemyPixelPosition(enemy);
        const unitCenter = this.board.tileCenter(unitPos.row, unitPos.col);
        const dx = enemyPos.x - unitCenter.cx;
        const dy = enemyPos.y - unitCenter.cy;
        const pixelDistance = Math.sqrt(dx * dx + dy * dy);
        return pixelDistance / this.board.tileSize;
    }

    /**
     * 执行攻击动作
     */
    _processAttack(unit, target) {
        const baseDamage = unit.atk;
        let killed = false;

        switch (unit.attackType) {
            case 'single':  // 单体攻击
                killed = this._applyDamageAndHandleKill(target, baseDamage, unit, {
                    attackType: 'single',
                });
                break;

            case 'splash':  // 范围攻击(攻击目标及周围敌人)
            case 'burning': // 灼烧(额外持续伤害)
                killed = this._applyDamageAndHandleKill(target, baseDamage, unit, {
                    attackType: unit.attackType,
                    showAreaEffect: true,
                }) || killed;
                // 范围伤害周围敌人。这里实时按路径进度计算位置，不依赖渲染阶段的缓存坐标。
                const targetPos = this._getEnemyPixelPosition(target);
                for (const nearby of this.enemies) {
                    if (nearby === target || !nearby.isAlive) continue;
                    const nearbyPos = this._getEnemyPixelPosition(nearby);
                    const dx = nearbyPos.x - targetPos.x;
                    const dy = nearbyPos.y - targetPos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist <= 50) {  // 50px范围内
                        killed = this._applyDamageAndHandleKill(nearby, Math.floor(baseDamage * 0.5), unit, {
                            attackType: unit.attackType,
                            isSecondary: true,
                        }) || killed;
                    }
                }
                break;

            case 'pierce':  // 穿刺攻击(伤害路径上所有敌人)
                for (const enemy of this.enemies) {
                    if (!enemy.isAlive) continue;
                    killed = this._applyDamageAndHandleKill(enemy, baseDamage * 1.2, unit, {
                        attackType: 'pierce',
                    }) || killed;
                }
                break;

            default:
                killed = this._applyDamageAndHandleKill(target, baseDamage, unit, {
                    attackType: unit.attackType || 'single',
                });
        }

        return { target, killer: unit, killed, damage: baseDamage };
    }

    /**
     * 对敌人施加伤害，并处理击杀奖励与异兽经验
     * @param {Enemy} enemy
     * @param {number} damage
     * @param {Unit} unit
     * @returns {boolean} 是否击杀
     */
    _applyDamageAndHandleKill(enemy, damage, unit, meta = {}) {
        const killed = enemy.takeDamage(damage, unit, meta);
        if (!killed) {
            return false;
        }

        const enemyConfig = CONFIG.ENEMY.TYPES[enemy._typeKey];
        const inkReward = enemyConfig?.inkReward || 3;
        EventBus.emit(GAME_EVENTS.ENEMY_KILLED, { enemy, killer: unit, inkReward });

        if (unit instanceof Beast) {
            const leveled = unit.gainKillXP();
            if (leveled) {
                EventBus.emit(GAME_EVENTS.MERGE_SUCCESS, { from: [unit], to: unit });
            }
        }

        return true;
    }

    /**
     * 根据敌人的路径进度计算其实时像素位置
     * @param {Enemy} enemy
     * @returns {{ x: number, y: number }}
     */
    _getEnemyPixelPosition(enemy) {
        const totalLength = this.board.path.length - 1;
        if (totalLength <= 0) {
            return { x: 0, y: 0 };
        }

        const progress = Math.max(0, Math.min(1, enemy.progress || 0));
        const idx = Math.min(Math.floor(progress * totalLength), totalLength - 1);
        const frac = (progress * totalLength) - idx;

        const wp1 = this.board.path.waypoints[idx];
        const wp2 = this.board.path.waypoints[Math.min(idx + 1, totalLength)];
        const p1 = this.board.tileCenter(wp1.row, wp1.col);
        const p2 = this.board.tileCenter(wp2.row, wp2.col);

        return {
            x: p1.cx + (p2.cx - p1.cx) * frac,
            y: p1.cy + (p2.cy - p1.cy) * frac,
        };
    }

    /**
     * 获取当前存活敌人数量
     */
    getAliveEnemyCount() {
        return this.enemies.filter(e => e.isAlive).length;
    }

    /**
     * 获取所有敌人(含存活和尸体，供渲染使用)
     */
    getEnemies() {
        const corpses = this._corpses.map(c => c.enemy);
        return [...this.enemies, ...corpses];
    }

    /**
     * 是否有更多波次
     */
    hasMoreWaves() {
        return this.currentWave < CONFIG.ENEMY.WAVES.length;
    }
}
