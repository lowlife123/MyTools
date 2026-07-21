/**
 * GameManager.js - 游戏主管理器
 * 所有系统的总控制器，负责游戏主循环、状态管理和系统协调
 * 
 * 生命周期：
 *   初始化 → IDLE(等待开始) → PLAYING(游戏进行) → OVER(结束)
 * 
 * 主循环(每帧):
 *   1. economy.update(dt)        - 经济更新
 *   2. battle.update(dt)         - 战斗更新
 *   3. board.draw(enemies)       - 画面渲染
 * 
 * 修改指南：
 * - 新增系统 → 在init中实例化，在update中调用
 * - 修改游戏结束条件 → 修改_checkGameOver方法
 */
class GameManager {
    constructor() {
        /** 游戏状态: 'idle' | 'playing' | 'paused' | 'over' */
        this.state = 'idle';

        /** 子系统实例 */
        this.economy = null;
        this.gacha = null;
        this.merge = null;
        this.battle = null;
        this.itemSystem = null;
        this.board = null;
        this.ui = null;

        /** "字"的当前血量 */
        this.wordHp = CONFIG.WORD.HP;

        /** 游戏循环ID */
        this._loopId = null;

        /** 上一帧时间戳 */
        this._lastTime = 0;

        /** 波次间倒计时 */
        this._waveCountdown = CONFIG.ENEMY.FIRST_WAVE_DELAY;
    }

    /**
     * 初始化所有系统
     */
    init() {
        // 1. 棋盘系统
        this.board = new Board('board-canvas');

        // 2. 经济系统
        this.economy = new EconomySystem();

        // 3. 各玩法系统(依赖经济)
        this.gacha = new GachaSystem(this.economy);
        this.merge = new MergeSystem();
        this.battle = new BattleSystem(this.board);
        this.itemSystem = new ItemSystem(this.economy);

        // 4. UI管理器(依赖所有系统)
        this.ui = new UIManager(
            this.economy,
            this.gacha,
            this.merge,
            this.battle,
            this.board
        );

        // 5. 注册战斗相关事件
        this._bindBattleEvents();

        // 6. 绑定开始界面事件
        this._bindStartScreen();

        // 游戏初始化完成，等待玩家点击"开始游戏"
        this.state = 'idle';
        Helpers.log('游戏初始化完成，等待开始...');
    }

    /**
     * 绑定开始界面事件
     */
    _bindStartScreen() {
        // 还原主菜单时不重新初始化地图（避免覆盖自定义配置）
        document.getElementById('btn-start-game').addEventListener('click', () => {
            this.startGame();
        });

        // 地图编辑按钮 → 跳转到编辑器页面
        document.getElementById('btn-map-editor').addEventListener('click', () => {
            window.location.href = 'editor.html';
        });

        // 功能配置按钮 → 跳转到配置页面
        document.getElementById('btn-config-editor').addEventListener('click', () => {
            window.location.href = 'config-editor.html';
        });

        // 游戏内返回主页按钮
        document.getElementById('game-back-btn').addEventListener('click', () => {
            this.returnToHome();
        });
    }

    /**
     * 开始游戏 - 隐藏开始界面，加载地图，启动游戏循环
     */
    startGame() {
        // 隐藏开始界面
        const startScreen = document.getElementById('start-screen');
        if (startScreen) {
            startScreen.style.display = 'none';
        }

        // 显示游戏内返回按钮
        const gameBackBtn = document.getElementById('game-back-btn');
        if (gameBackBtn) {
            gameBackBtn.style.display = 'block';
        }

        // 加载自定义功能配置（覆盖 CONFIG 中的单位数值）
        this._loadCustomConfig();

        // 加载已保存的自定义地图
        this._loadSavedMap();

        // 应用自定义初始墨水（重新初始化经济系统）
        this.economy.init();

        // 应用自定义字血量到 HUD
        document.getElementById('word-hp').textContent = CONFIG.WORD.HP;
        document.getElementById('word-maxhp').textContent = CONFIG.WORD.HP;

        // 启动游戏
        this.state = 'playing';
        const firstWave = CONFIG.ENEMY.WAVES[0];
        this._waveCountdown = (firstWave && firstWave.countdown != null) ? firstWave.countdown : CONFIG.ENEMY.FIRST_WAVE_DELAY;
        this._lastTime = performance.now();
        this._loop();

        Helpers.log('游戏开始！');
    }

    /**
     * 从 localStorage 加载自定义功能配置（覆盖默认单位数值）
     */
    _loadCustomConfig() {
        const saved = localStorage.getItem('textGuard_configData');
        if (!saved) return;

        try {
            const data = JSON.parse(saved);

            // 覆盖敌方单位配置（合并模式：以 CONFIG 为底，已保存数据覆盖）
            if (data.enemyData) {
                for (const [key, val] of Object.entries(data.enemyData)) {
                    if (CONFIG.ENEMY.TYPES[key]) {
                        Object.assign(CONFIG.ENEMY.TYPES[key], val);
                    }
                }
            }

            // 覆盖小兵棋子配置
            if (data.soldierData) {
                for (const [key, val] of Object.entries(data.soldierData)) {
                    if (CONFIG.SOLDIER_TYPES[key]) {
                        // 旧数据兼容：rangeType → range
                        if (val.rangeType !== undefined) {
                            const rangeMap = { melee: 2, mid: 3, long: 4 };
                            val.range = rangeMap[val.rangeType] || 3;
                            delete val.rangeType;
                        }
                        Object.assign(CONFIG.SOLDIER_TYPES[key], val);
                    }
                }
            }

            // 覆盖异兽棋子配置
            if (data.beastData) {
                for (const [key, val] of Object.entries(data.beastData)) {
                    if (CONFIG.BEASTS[key]) {
                        if (val.rangeType !== undefined) {
                            const rangeMap = { melee: 2, mid: 3, long: 4 };
                            val.range = rangeMap[val.rangeType] || 4;
                            delete val.rangeType;
                        }
                        Object.assign(CONFIG.BEASTS[key], val);
                    }
                }
            }

            // 覆盖等级配置
            if (data.mergeData) {
                const soldierMaxLevel = typeof data.mergeData.soldierMaxLevel === 'number'
                    ? data.mergeData.soldierMaxLevel
                    : CONFIG.MERGE.SOLDIER_MAX_LEVEL;
                const beastMaxLevel = typeof data.mergeData.beastMaxLevel === 'number'
                    ? data.mergeData.beastMaxLevel
                    : CONFIG.MERGE.BEAST_MAX_LEVEL;

                if (Array.isArray(data.mergeData.levelMultiplier)) {
                    const levelMultiplier = [...data.mergeData.levelMultiplier];
                    for (let i = 0; i < soldierMaxLevel; i++) {
                        if (typeof levelMultiplier[i] !== 'number' || Number.isNaN(levelMultiplier[i])) {
                            levelMultiplier[i] = CONFIG.MERGE.LEVEL_MULTIPLIER[i]
                                ?? levelMultiplier[i - 1]
                                ?? 1;
                        }
                    }
                    CONFIG.MERGE.LEVEL_MULTIPLIER = levelMultiplier.slice(0, soldierMaxLevel);
                }
                if (typeof data.mergeData.beastXpPerLevel === 'number') {
                    CONFIG.MERGE.BEAST_XP_PER_LEVEL = data.mergeData.beastXpPerLevel;
                }
                CONFIG.MERGE.SOLDIER_MAX_LEVEL = soldierMaxLevel;
                CONFIG.MERGE.BEAST_MAX_LEVEL = beastMaxLevel;
            }

            Helpers.log('已加载自定义功能配置');
        } catch (e) {
            console.error('加载自定义配置失败:', e);
        }
    }

    /**
     * 从 localStorage 加载自定义地图数据
     * 如果存在保存的地图，覆盖默认路径和初始地块配置
     */
    _loadSavedMap() {
        const saved = localStorage.getItem('textGuard_mapData');
        if (!saved) return;

        try {
            const data = JSON.parse(saved);
            if (!data.enemyPath || data.enemyPath.length < 2) return;

            // 1. 覆盖敌军路径
            CONFIG.ENEMY_PATH = data.enemyPath;

            // 2. 更新"字"的位置（路径终点）
            const endPoint = data.enemyPath[data.enemyPath.length - 1];
            CONFIG.WORD.POSITION = { row: endPoint.row, col: endPoint.col };

            // 3. 更新初始地块列表
            if (data.initialTileKeys && data.initialTileKeys.length > 0) {
                this._customInitTileKeys = data.initialTileKeys;
            } else {
                this._customInitTileKeys = null;
            }

            // 4. 覆盖波次配置（旧数据兼容：无countdown则用默认值）
            if (data.waves && Array.isArray(data.waves) && data.waves.length > 0) {
                data.waves.forEach((wave, i) => {
                    if (wave.countdown == null) {
                        wave.countdown = (i === 0) ? CONFIG.ENEMY.FIRST_WAVE_DELAY : CONFIG.ENEMY.WAVE_COUNTDOWN;
                    }
                });
                CONFIG.ENEMY.WAVES = data.waves;
            }

            // 5. 覆盖初始墨水
            if (typeof data.startingInk === 'number') {
                CONFIG.ECONOMY.STARTING_INK = data.startingInk;
            }

            // 6. 覆盖「字」血量
            if (typeof data.wordHp === 'number') {
                CONFIG.WORD.HP = data.wordHp;
                this.wordHp = data.wordHp;
            }

            // 7. 覆盖出怪间隔
            if (typeof data.spawnInterval === 'number') {
                CONFIG.ENEMY.SPAWN_INTERVAL = data.spawnInterval;
            }

            // 8. 覆盖征兵概率配置
            if (data.gachaConfig) {
                if (data.gachaConfig.slotCount != null) {
                    const slotCount = Math.max(1, parseInt(data.gachaConfig.slotCount, 10) || CONFIG.GACHA.SLOT_COUNT);
                    CONFIG.GACHA.SLOT_COUNT = slotCount;
                    CONFIG.GACHA.DRAW_COUNT = slotCount;
                }
                if (data.gachaConfig.beastChance != null) {
                    CONFIG.GACHA.BEAST_CHANCE = data.gachaConfig.beastChance;
                }
                if (data.gachaConfig.beastPity != null) {
                    CONFIG.GACHA.BEAST_PITY = data.gachaConfig.beastPity;
                }
                if (data.gachaConfig.shovelChance != null) {
                    CONFIG.GACHA.SHOVEL_CHANCE = data.gachaConfig.shovelChance;
                }
                if (data.gachaConfig.shovelPity != null) {
                    CONFIG.GACHA.SHOVEL_PITY = data.gachaConfig.shovelPity;
                }
            }

            this.ui?.setRecruitSlotCount(CONFIG.GACHA.SLOT_COUNT);

            // 9. 重建路径（因为 Board 的 Path 已在 init 时用默认路径创建）
            this.board.path = new Path();

            // 10. 重建地块网格（重新标记路径、字、初始解锁）
            this._rebuildGridWithCustomMap();

            const waveCount = data.waves ? data.waves.length : '默认';
            const inkInfo = data.startingInk != null ? data.startingInk : '默认';
            Helpers.log(`已加载自定义地图：${data.enemyPath.length} 个路径点，${data.initialTileKeys ? data.initialTileKeys.length : 0} 个初始地块，${waveCount} 波次，初始墨水${inkInfo}`);
        } catch (e) {
            console.error('加载自定义地图失败:', e);
        }
    }

    /**
     * 根据自定义地图数据重建地块网格
     */
    _rebuildGridWithCustomMap() {
        // 先清空所有地块
        for (let r = 0; r < this.board.rows; r++) {
            for (let c = 0; c < this.board.cols; c++) {
                const tile = this.board.grid[r][c];
                if (tile && tile.unit) tile.removeUnit();
            }
        }
        this.board.grid = [];

        // 重建：标记路径、字、初始解锁地块
        const pathKeySet = new Set(CONFIG.ENEMY_PATH.map(p => `${p.row},${p.col}`));
        const initKeySet = new Set(this._customInitTileKeys || []);
        const wordKey = `${CONFIG.WORD.POSITION.row},${CONFIG.WORD.POSITION.col}`;

        for (let r = 0; r < this.board.rows; r++) {
            this.board.grid[r] = [];
            for (let c = 0; c < this.board.cols; c++) {
                const key = `${r},${c}`;
                const isPath = pathKeySet.has(key);
                const isWord = key === wordKey;
                const isInitUnlocked = !isPath && !isWord && initKeySet.has(key);

                const tile = new Tile(r, c);
                tile.isPath = isPath;
                tile.isWord = isWord;
                tile.isStart = (r === this.board.path.startPoint.row && c === this.board.path.startPoint.col);
                if (isPath || isWord) tile.unlocked = true;
                if (isInitUnlocked) tile.unlock();

                this.board.grid[r][c] = tile;
            }
        }

        this.board._animations = [];
    }

    /**
     * 重置为默认地块网格（无自定义地图时使用）
     * 复用 Board 自身的初始化逻辑
     */
    _reinitDefaultGrid() {
        for (let r = 0; r < this.board.rows; r++) {
            for (let c = 0; c < this.board.cols; c++) {
                const tile = this.board.grid[r] && this.board.grid[r][c];
                if (tile && tile.unit) tile.removeUnit();
            }
        }
        this.board._initGrid();
        this.board._animations = [];
    }

    /**
     * 绑定战斗事件
     */
    _bindBattleEvents() {
        // "字"受伤
        EventBus.on(GAME_EVENTS.WORD_DAMAGED, (data) => {
            this.wordHp -= data.damage || 0;
            if (this.wordHp <= 0) {
                this.wordHp = 0;
                this._gameOver('lose');
            }
        });

        // 游戏重新开始
        EventBus.on(GAME_EVENTS.GAME_RESTART, () => {
            this.restart();
        });

        // 击杀敌人获取墨水奖励
        EventBus.on(GAME_EVENTS.ENEMY_KILLED, (data) => {
            this.economy.gainInk(data.inkReward || 0);
        });

        // 命中反馈：伤害浮字与范围命中特效
        EventBus.on(GAME_EVENTS.DAMAGE_DEALT, (data) => {
            this.board?.showDamageFeedback(data);
        });

        // 波次结束 → 开始下一波倒计时
        EventBus.on(GAME_EVENTS.WAVE_END, () => {
            const nextIdx = this.battle.currentWave;
            const nextWave = CONFIG.ENEMY.WAVES[nextIdx];
            const countdown = (nextWave && nextWave.countdown != null) ? nextWave.countdown : CONFIG.ENEMY.WAVE_COUNTDOWN;
            this._waveCountdown = countdown;
            Helpers.log(`波次结束，${countdown}秒后自动开始下一波`);
        });

        // 征兵栏拖放：从征兵栏拖单位到棋盘空地块
        /**
         * 执行合成的通用逻辑
         */
        const performMerge = (unitA, unitB) => {
            // 先保存地块引用（removeUnit会把unit.tile置null）
            const tileA = unitA.tile;
            const tileB = unitB.tile;

            const result = this.merge.performMerge(unitA, unitB);
            if (result.success) {
                // 消耗两个单位的地块位置
                tileA?.removeUnit();
                tileB?.removeUnit();
                // 放置合成结果：优先放在unitB（被拖放目标）的位置
                const target = (tileB && tileB.isAvailable) ? tileB :
                              (tileA && tileA.isAvailable) ? tileA :
                              this.board.getAvailableTiles()[0];
                if (target) target.placeUnit(result.result);
                Helpers.log(result.message);
            } else {
                // 无法合成 → 交换两个单位的位置
                if (tileA && tileB) {
                    tileA.removeUnit();
                    tileB.removeUnit();
                    tileA.placeUnit(unitB);
                    tileB.placeUnit(unitA);
                    Helpers.log(`交换 ${unitA.displayName} 和 ${unitB.displayName} 的位置`);
                }
            }
        };

        // 拖拽合成：拖拽单位A到单位B的地块上
        EventBus.on(GAME_EVENTS.UNIT_DROP_MERGE, (data) => {
            performMerge(data.unitA, data.unitB);
            // 合成后检测新单位是否与相邻异兽字形成组合
            if (data.unitB.tile) this._checkAdjacentBeastCombo(data.unitB.tile);
        });

        // 拖拽移动：拖拽单位到空地
        EventBus.on(GAME_EVENTS.UNIT_MOVE, (data) => {
            if (data.unit && data.fromTile && data.toTile && data.toTile.isAvailable) {
                data.fromTile.removeUnit();
                data.toTile.placeUnit(data.unit);
                Helpers.log(`移动 ${data.unit.displayName} 到 (${data.toTile.row},${data.toTile.col})`);
                // 移动后检测是否与相邻异兽字形成新组合
                this._checkAdjacentBeastCombo(data.toTile);
            }
        });

        // 征兵栏拖放：从征兵栏拖单位到棋盘空地块
        EventBus.on(GAME_EVENTS.RECRUIT_PLACE, (data) => {
            const unit = this.ui.getRecruitUnit(data.unitIndex);
            if (unit && data.tile && data.tile.isAvailable) {
                data.tile.placeUnit(unit);
                this.ui.clearRecruitSlot(data.unitIndex);
                Helpers.log(`放置 ${unit.displayName} 到 (${data.tile.row},${data.tile.col})`);
                // 放置后检测是否与相邻异兽字形成组合
                this._checkAdjacentBeastCombo(data.tile);
            }
        });

        // 征兵栏拖放合成：从征兵栏拖单位到已有单位的地块上
        EventBus.on(GAME_EVENTS.RECRUIT_MERGE, (data) => {
            const recruitUnit = this.ui.getRecruitUnit(data.unitIndex);
            if (!recruitUnit || !data.tile || !data.tile.unit) return;
            if (recruitUnit.isShovel) return;

            const boardUnit = data.tile.unit;
            const result = this.merge.performMerge(recruitUnit, boardUnit);
            if (result.success) {
                boardUnit.tile?.removeUnit();
                this.ui.clearRecruitSlot(data.unitIndex);
                data.tile.placeUnit(result.result);
                Helpers.log(result.message);
                this._checkAdjacentBeastCombo(data.tile);
            } else {
                data.tile.removeUnit();
                data.tile.placeUnit(recruitUnit);
                this.ui.setRecruitSlot(data.unitIndex, boardUnit);
                Helpers.log(`交换 ${recruitUnit.displayName} 和 ${boardUnit.displayName} 的位置`);
                this._checkAdjacentBeastCombo(data.tile);
            }
        });

        // 征兵栏铲子拖放：拖铲子到未解锁地块解锁该地块
        EventBus.on(GAME_EVENTS.RECRUIT_SHOVEL, (data) => {
            const unit = this.ui.getRecruitUnit(data.unitIndex);
            if (!unit || !unit.isShovel || !data.tile) return;

            const tile = data.tile;
            if (!tile.unlocked && !tile.isPath && !tile.isWord &&
                this.board._hasUnlockedNeighbor(tile.row, tile.col)) {
                this.board.unlockTileWithShovel(tile.row, tile.col);
                this.ui.clearRecruitSlot(data.unitIndex);
                Helpers.log(`使用铲子解锁了地块 (${tile.row},${tile.col})`);
            } else {
                Helpers.log('该地块无法使用铲子解锁（需与已解锁地块相邻）');
            }
        });

        EventBus.on(GAME_EVENTS.BOARD_TO_RECRUIT, (data) => {
            this._moveBoardUnitToRecruitSlot(data.fromTile, data.slotIndex, data.unitId);
        });

        // 点击合成（兼容保留）：依次点击两个相同单位
        let mergeTargetA = null;
        EventBus.on(GAME_EVENTS.UNIT_PLACED, () => {});
        EventBus.on(GAME_EVENTS.TILE_CLICKED, (data) => {
            if (data.tile.unit) {
                if (!mergeTargetA) {
                    mergeTargetA = data.tile.unit;
                    Helpers.log(`已选择 ${mergeTargetA.displayName}，请选择另一个相同单位进行合成`);
                } else if (data.tile.unit !== mergeTargetA) {
                    performMerge(mergeTargetA, data.tile.unit);
                    if (data.tile.unit.tile) this._checkAdjacentBeastCombo(data.tile.unit.tile);
                    mergeTargetA = null;
                }
            } else {
                mergeTargetA = null;
            }
        });

        // 拖拽断开组合异兽请求
        EventBus.on(GAME_EVENTS.COMBO_BREAK_REQUEST, (data) => {
            this._breakCombo(data.beast);
        });
    }

    /**
     * 检测指定地块及其左右邻居是否存在可链接的异兽字
     * 异兽字在棋盘上左右相邻时自动合并为一个异兽整体（占据两格）
     * @param {Tile} triggerTile - 刚发生变化的触发地块
     */
    _checkAdjacentBeastCombo(triggerTile) {
        if (!triggerTile || !triggerTile.unit) return;
        // 异兽整体不参与检测
        if (triggerTile.unit._isComboBeast) return;

        const row = triggerTile.row;

        // 检查左邻居
        if (triggerTile.col - 1 >= 0) {
            const leftTile = this.board.grid[row][triggerTile.col - 1];
            if (leftTile.unit && !leftTile.unit._isComboBeast) {
                this._tryLinkBeastCombo(triggerTile, leftTile);
            }
        }

        // 检查右邻居
        if (triggerTile.col + 1 < this.board.cols) {
            const rightTile = this.board.grid[row][triggerTile.col + 1];
            if (rightTile.unit && !rightTile.unit._isComboBeast) {
                this._tryLinkBeastCombo(triggerTile, rightTile);
            }
        }
    }

    /**
     * 尝试将两个地块上的异兽字合并为一个异兽整体
     * 异兽占据左格，右格标记为组合占用，显示为一个整体（一个边框+异兽名）
     * @param {Tile} tileA
     * @param {Tile} tileB
     */
    _tryLinkBeastCombo(tileA, tileB) {
        if (!tileA || !tileB) return;
        if (!tileA.unit || !tileB.unit) return;

        const unitA = tileA.unit;
        const unitB = tileB.unit;

        // 已有组合或不是异兽字则跳过
        if (unitA._isComboBeast || unitB._isComboBeast) return;
        if (tileA._comboBeast || tileB._comboBeast) return;

        const pair = this.merge.checkBeastPair(unitA, unitB);
        if (!pair.canMerge) return;

        // 确定左右顺序
        let leftTile, rightTile, leftChar, rightChar;
        if (tileA.col < tileB.col) {
            leftTile = tileA; rightTile = tileB;
            leftChar = unitA; rightChar = unitB;
        } else {
            leftTile = tileB; rightTile = tileA;
            leftChar = unitB; rightChar = unitA;
        }

        const beastConfig = CONFIG.BEASTS[pair.beastKey];

        // 创建异兽单位
        const beast = new Beast(pair.beastKey, 1);
        beast._isComboBeast = true;
        beast._comboTileRight = rightTile;
        beast._comboCharA = leftChar;
        beast._comboCharB = rightChar;

        // 移除两个异兽字
        leftTile.removeUnit();
        rightTile.removeUnit();

        // 放置异兽在左格，标记右格为组合占用
        leftTile.placeUnit(beast);
        rightTile._comboBeast = beast;

        EventBus.emit(GAME_EVENTS.COMBO_FORMED, {
            beast, comboName: beastConfig.displayName,
        });

        Helpers.log(`【${leftChar.displayName}】+【${rightChar.displayName}】→ 异兽【${beastConfig.displayName}】`);
    }

    /**
     * 断开异兽组合，拆分为两个原始异兽字
     * @param {Beast} beast - 组合异兽实例
     */
    _breakCombo(beast) {
        if (!beast || !beast._isComboBeast) return;

        const comboName = beast.displayName;
        const leftTile = beast.tile;
        const rightTile = beast._comboTileRight;
        const charA = beast._comboCharA;
        const charB = beast._comboCharB;

        // 移除异兽
        if (leftTile) leftTile.removeUnit();
        if (rightTile) rightTile._comboBeast = null;

        // 恢复两个异兽字到各自位置
        if (leftTile && charA) leftTile.placeUnit(charA);
        if (rightTile && charB) rightTile.placeUnit(charB);

        EventBus.emit(GAME_EVENTS.COMBO_BROKEN, { beast, charA, charB });
        Helpers.log(`异兽【${comboName}】已拆分为【${charA.displayName}】+【${charB.displayName}】`);
    }

    _moveBoardUnitToRecruitSlot(fromTile, slotIndex, unitId) {
        if (!fromTile || !fromTile.unit) return;
        if (fromTile.unit.id !== unitId) return;

        const movingUnit = fromTile.unit;
        if (movingUnit.isShovel) return;

        const targetEntry = this.ui.getRecruitUnit(slotIndex);
        if (targetEntry?.isShovel) return;

        fromTile.removeUnit();

        if (!targetEntry) {
            this.ui.setRecruitSlot(slotIndex, movingUnit);
            Helpers.log(`已将 ${movingUnit.displayName} 放回征兵副棋盘`);
            return;
        }

        this.ui.setRecruitSlot(slotIndex, movingUnit);
        if (fromTile.placeUnit(targetEntry)) {
            Helpers.log(`交换 ${movingUnit.displayName} 和 ${targetEntry.displayName} 的位置`);
            this._checkAdjacentBeastCombo(fromTile);
            return;
        }

        this.ui.setRecruitSlot(slotIndex, targetEntry);
        fromTile.placeUnit(movingUnit);
    }

    // ==================== 游戏主循环 ====================

    _loop() {
        const now = performance.now();
        const dt = Math.min((now - this._lastTime) / 1000, 0.1); // 最大0.1秒防止跳帧
        this._lastTime = now;

        this.update(dt);
        this.render();

        this._loopId = requestAnimationFrame(() => this._loop());
    }

    /**
     * 逻辑更新
     */
    update(dt) {
        if (this.state !== 'playing') return;

        // 1. 经济更新(墨水不再随时间恢复，仅通过击杀获取)
        this.economy.update(dt);

        // 2. 自动波次管理
        this._updateWaves(dt);

        // 3. 战斗更新
        this.battle.update(dt);
    }

    /**
     * 自动波次管理（倒计时自动出兵）
     */
    _updateWaves(dt) {
        // 波次进行中 → 不启动新倒计时
        if (this.battle._waveInProgress) return;

        // 没有更多波次 → 胜利
        if (!this.battle.hasMoreWaves() && this.battle._spawnQueue.length === 0 && this.battle.enemies.length === 0) {
            this._gameOver('win');
            return;
        }

        // 倒计时
        this._waveCountdown -= dt;
        const displaySeconds = Math.ceil(this._waveCountdown);
        EventBus.emit(GAME_EVENTS.WAVE_COUNTDOWN, { seconds: displaySeconds });

        if (this._waveCountdown <= 0) {
            this._waveCountdown = 0;
            if (this.battle.hasMoreWaves()) {
                this.battle.startNextWave();
            }
        }
    }

    /**
     * 画面渲染
     */
    render() {
        const enemies = this.battle ? this.battle.getEnemies() : [];
        this.board?.draw(enemies);
    }

    // ==================== 游戏流程控制 ====================

    _gameOver(result) {
        this.state = 'over';
        if (this._loopId) {
            cancelAnimationFrame(this._loopId);
        }
        EventBus.emit(GAME_EVENTS.GAME_OVER, { result });

        if (result === 'win') {
            Helpers.log('胜利！全部波次已完成！');
        }
    }

    restart() {
        // 停止当前循环
        if (this._loopId) {
            cancelAnimationFrame(this._loopId);
            this._loopId = null;
        }

        // 重置游戏状态
        this.state = 'playing';
        this.wordHp = CONFIG.WORD.HP;
        const firstWave = CONFIG.ENEMY.WAVES[0];
        this._waveCountdown = (firstWave && firstWave.countdown != null) ? firstWave.countdown : CONFIG.ENEMY.FIRST_WAVE_DELAY;

        // 重置经济
        this.economy.init();

        // 重置战斗（清除旧敌人和波次状态）
        this.battle = new BattleSystem(this.board);
        // 重置抽卡保底
        this.gacha._beastPityCount = 0;
        this.gacha._shovelPityCount = 0;

        // 重建地块网格（重置所有地块的解锁状态）
        this.board._dragState = null;
        this.board._dragOverTile = null;
        if (this._customInitTileKeys || localStorage.getItem('textGuard_mapData')) {
            this._rebuildGridWithCustomMap();
        } else {
            this._reinitDefaultGrid();
        }

        // 清除征兵副棋盘
        this.ui.setRecruitSlotCount(CONFIG.GACHA.SLOT_COUNT);
        window._isDraggingShovel = false;

        // 更新UI引用
        this.ui.battle = this.battle;
        this.ui.economy = this.economy;

        // 重启主循环
        this._lastTime = performance.now();
        this._loop();

        Helpers.log('游戏重新开始');
    }

    /**
     * 返回主页 - 停止游戏，返回主菜单
     */
    returnToHome() {
        // 停止游戏循环
        if (this._loopId) {
            cancelAnimationFrame(this._loopId);
            this._loopId = null;
        }

        // 重置状态
        this.state = 'idle';

        // 清除攻击范围高亮
        this.board.clearAttackRange();

        // 隐藏游戏内返回按钮
        const gameBackBtn = document.getElementById('game-back-btn');
        if (gameBackBtn) {
            gameBackBtn.style.display = 'none';
        }

        // 隐藏结果覆盖层（如果有）
        const resultOverlay = document.getElementById('result-overlay');
        if (resultOverlay) {
            resultOverlay.classList.add('hidden');
        }

        // 显示开始界面
        const startScreen = document.getElementById('start-screen');
        if (startScreen) {
            startScreen.style.display = 'flex';
        }

        Helpers.log('返回主页');
    }
}
