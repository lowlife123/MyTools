/**
 * UIManager.js - UI管理器
 * 负责所有UI面板的显示/隐藏、事件绑定和DOM更新
 * 
 * 管理的面板:
 * - HUD(墨水、血量、波次)
 * - 征兵面板
 * - 单位信息面板
 * - 道具面板
 * - 结果弹窗
 * 
 * 修改指南：
 * - 修改UI样式 → 修改style.css
 * - 添加新面板 → 在index.html加HTML，在此文件加显示逻辑
 */
class UIManager {
    /**
     * @param {EconomySystem} economy - 经济系统
     * @param {GachaSystem} gacha - 抽卡系统
     * @param {MergeSystem} merge - 合成系统
     * @param {BattleSystem} battle - 战斗系统
     * @param {Board} board - 棋盘
     */
    constructor(economy, gacha, merge, battle, board) {
        this.economy = economy;
        this.gacha = gacha;
        this.merge = merge;
        this.battle = battle;
        this.board = board;

        /** 当前选中的单位 */
        this.selectedUnit = null;

        /** 正在拖拽合成的单位 */
        this.dragUnit = null;

        this._cacheDom();      // 缓存DOM元素
        this._bindButtons();   // 绑定按钮事件
        this._bindEvents();    // 绑定事件监听

        // 初始化显示
        this.$.waveMax.textContent = CONFIG.ENEMY.WAVES.length;
        this.$.wordMaxHp.textContent = CONFIG.WORD.HP;
        this._renderRecruitBar();
    }

    // ==================== DOM缓存 ====================

    _cacheDom() {
        this.$ = {
            ink: document.getElementById('ink-amount'),
            wordHp: document.getElementById('word-hp'),
            wordMaxHp: document.getElementById('word-maxhp'),
            waveNum: document.getElementById('wave-num'),
            waveMax: document.getElementById('wave-max'),
            countdownTimer: document.getElementById('countdown-timer'),
            enemyCount: document.getElementById('enemy-count'),
            recruitSlots: document.getElementById('recruit-slots'),
            gachaPanel: document.getElementById('gacha-panel'),
            gachaResult: document.getElementById('gacha-result'),
            unitInfoPanel: document.getElementById('unit-info-panel'),
            unitInfoName: document.getElementById('unit-info-name'),
            unitInfoContent: document.getElementById('unit-info-content'),
            unitActions: document.getElementById('unit-actions'),
            itemPanel: document.getElementById('item-panel'),
            itemList: document.getElementById('item-list'),
            resultOverlay: document.getElementById('result-overlay'),
            resultTitle: document.getElementById('result-title'),
            resultInfo: document.getElementById('result-info'),
            btnDraw: document.getElementById('btn-draw'),
        };

        /** 征兵副棋盘固定槽位 */
        this._recruitSlotCount = CONFIG.GACHA.SLOT_COUNT;
        this._recruitSlots = this._createEmptyRecruitSlots(this._recruitSlotCount);
    }

    // ==================== 按钮事件 ====================

    _bindButtons() {
        // 征兵按钮 → 直接征兵到征兵栏
        document.getElementById('btn-gacha').addEventListener('click', () => {
            const result = this.gacha.draw();
            if (result.success) {
                this.setRecruitSlots(result.units);
            } else {
                alert(result.message);
            }
        });

        // 关闭单位信息
        document.getElementById('btn-close-unit-info').addEventListener('click', () => {
            this._hidePanel(this.$.unitInfoPanel);
        });

        // 关闭道具面板
        document.getElementById('btn-close-item').addEventListener('click', () => {
            this._hidePanel(this.$.itemPanel);
        });

        // 重新开始
        document.getElementById('btn-restart').addEventListener('click', () => {
            EventBus.emit(GAME_EVENTS.GAME_RESTART);
        });
    }

    // ==================== 事件监听 ====================

    _bindEvents() {
        EventBus.on(GAME_EVENTS.INK_CHANGE, (data) => {
            this.$.ink.textContent = data.amount;
        });

        EventBus.on(GAME_EVENTS.WORD_DAMAGED, (data) => {
            // 获取当前显示血量并扣减
            const currentHp = parseInt(this.$.wordHp.textContent) || 0;
            this.$.wordHp.textContent = Math.max(0, currentHp - (data.damage || 0));
        });

        EventBus.on(GAME_EVENTS.WAVE_START, (data) => {
            this.$.waveNum.textContent = data.waveNum;
            this.$.countdownTimer.textContent = '--';
        });

        EventBus.on(GAME_EVENTS.WAVE_END, (data) => {
            // 波次结束，隐藏倒计时（下一波倒计时会重新显示）
            this.$.countdownTimer.textContent = '--';
        });

        EventBus.on(GAME_EVENTS.WAVE_COUNTDOWN, (data) => {
            this.$.countdownTimer.textContent = data.seconds;
            // 最后5秒变色提示
            if (data.seconds <= 5) {
                this.$.countdownTimer.style.color = '#f44336';
            } else {
                this.$.countdownTimer.style.color = '#ffeb3b';
            }
        });

        EventBus.on(GAME_EVENTS.ENEMY_SPAWNED, () => {
            this.$.enemyCount.textContent = this.battle.getAliveEnemyCount();
        });

        EventBus.on(GAME_EVENTS.ENEMY_KILLED, () => {
            this.$.enemyCount.textContent = this.battle.getAliveEnemyCount();
        });

        EventBus.on(GAME_EVENTS.TILE_CLICKED, (data) => {
            this._onTileClicked(data);
        });

        // 左键点击 → 仅显示攻击范围
        EventBus.on(GAME_EVENTS.TILE_LEFT_CLICK, (data) => {
            this._onTileLeftClick(data);
        });

        EventBus.on(GAME_EVENTS.GAME_OVER, (data) => {
            this._showResult(data.result);
        });

        EventBus.on(GAME_EVENTS.GAME_RESTART, () => {
            this._hideResult();
            this._hideUnitInfo();
            this.$.wordHp.textContent = CONFIG.WORD.HP;
            this.$.wordMaxHp.textContent = CONFIG.WORD.HP;
            this.$.ink.textContent = CONFIG.ECONOMY.STARTING_INK;
            this.$.waveNum.textContent = '1';
            this.$.waveMax.textContent = CONFIG.ENEMY.WAVES.length;
            this.$.enemyCount.textContent = '0';
            this.$.countdownTimer.textContent = CONFIG.ENEMY.FIRST_WAVE_DELAY;
            this.$.countdownTimer.style.color = '#ffeb3b';
        });
    }

    // ==================== 地块点击处理 ====================

    _onTileClicked(data) {
        const tile = data.tile;

        // 如果有单位 → 显示单位信息
        if (tile.unit) {
            this.selectedUnit = tile.unit;
            this._showUnitInfo(tile.unit);
            return;
        }

        // 点击空地 → 隐藏信息面板并清除攻击范围
        this._hideUnitInfo();
        this.selectedUnit = null;
    }

    /**
     * 左键点击地块 → 仅显示/清除攻击范围（不打开详情）
     */
    _onTileLeftClick(data) {
        const tile = data.tile;

        if (tile.unit) {
            // 有单位 → 仅显示攻击范围
            this.board.showAttackRange(
                tile.unit.tile.row, tile.unit.tile.col,
                tile.unit.range,
                tile.unit.getQualityColor()
            );
        } else {
            // 空地 → 清除攻击范围
            this.board.clearAttackRange();
        }
    }

    // ==================== 征兵栏管理 ====================

    /**
     * 创建固定数量的空槽位
     * @param {number} count
     * @returns {(Unit|null)[]}
     */
    _createEmptyRecruitSlots(count) {
        return Array.from({ length: Math.max(1, count || CONFIG.GACHA.SLOT_COUNT) }, () => null);
    }

    /**
     * 将征兵结果设置到征兵栏（整栏刷新）
     * @param {Unit[]} units - 抽到的单位数组
     */
    setRecruitSlots(units) {
        this._recruitSlots = this._createEmptyRecruitSlots(this._recruitSlotCount);
        (units || []).slice(0, this._recruitSlotCount).forEach((unit, index) => {
            this._recruitSlots[index] = unit;
        });
        this._renderRecruitBar();
    }

    /**
     * 更新征兵槽位数量，并清空当前副棋盘
     * @param {number} count
     */
    setRecruitSlotCount(count) {
        this._recruitSlotCount = Math.max(1, parseInt(count, 10) || CONFIG.GACHA.SLOT_COUNT);
        this._recruitSlots = this._createEmptyRecruitSlots(this._recruitSlotCount);
        this._renderRecruitBar();
    }

    /**
     * 渲染征兵栏中的所有单位卡片
     */
    _renderRecruitBar() {
        this.$.recruitSlots.innerHTML = '';
        this._recruitSlots.forEach((unit, index) => {
            const slot = document.createElement('div');
            slot.className = 'recruit-slot';
            slot.dataset.slotIndex = String(index);

            if (unit) {
                slot.appendChild(this._createRecruitCard(unit, index));
            } else {
                slot.classList.add('is-empty');
            }

            this._bindRecruitSlotDrop(slot, index);
            this.$.recruitSlots.appendChild(slot);
        });
    }

    /**
     * 创建征兵卡片
     * @param {Unit|Object} unit
     * @param {number} index
     */
    _createRecruitCard(unit, index) {
        const card = document.createElement('div');

        if (unit.isShovel) {
            card.className = 'recruit-card shovel-card';
            card.textContent = '🔨';
            card.style.backgroundColor = '#5d4037';
            card.style.borderColor = '#8d6e63';
            card.style.color = '#ffcc80';
            card.title = '拖到未解锁地块可解锁该地块';
        } else {
            card.className = `recruit-card quality-${unit.quality}`;
            card.textContent = unit.displayName;
            card.style.backgroundColor = unit.color;
            card.style.borderColor = unit.getFrameColor();

            const tag = document.createElement('span');
            tag.className = 'card-level-tag';
            if (unit.level >= 5) {
                tag.classList.add('is-max-level');
            }
            tag.textContent = `Lv${unit.level}`;
            card.appendChild(tag);
        }

        card.draggable = true;
        card.dataset.slotIndex = String(index);
        card.addEventListener('dragstart', (e) => {
            const payload = {
                scope: 'recruit',
                slotIndex: index,
                kind: unit.isShovel ? 'shovel' : 'unit',
            };
            e.dataTransfer.setData('text/plain', JSON.stringify(payload));
            e.dataTransfer.effectAllowed = 'move';
            window._isDraggingShovel = !!unit.isShovel;
            card.style.opacity = '0.5';
        });
        card.addEventListener('dragend', () => {
            card.style.opacity = '1';
            window._isDraggingShovel = false;
            this.clearRecruitSlotHighlight();
        });
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            card.parentElement?.classList.add('is-drop-target');
        });
        card.addEventListener('dragleave', (e) => {
            e.stopPropagation();
            card.parentElement?.classList.remove('is-drop-target');
        });
        card.addEventListener('drop', (e) => {
            const payload = this._parseRecruitDragPayload(e.dataTransfer.getData('text/plain'));
            card.parentElement?.classList.remove('is-drop-target');
            if (!payload || payload.scope !== 'recruit') return;
            e.preventDefault();
            e.stopPropagation();
            this._handleRecruitSlotDrop(payload.slotIndex, index);
        });

        return card;
    }

    _bindRecruitSlotDrop(slot, targetIndex) {
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            slot.classList.add('is-drop-target');
        });

        slot.addEventListener('dragleave', () => {
            slot.classList.remove('is-drop-target');
        });

        slot.addEventListener('drop', (e) => {
            const payload = this._parseRecruitDragPayload(e.dataTransfer.getData('text/plain'));
            slot.classList.remove('is-drop-target');
            if (!payload) return;
            e.preventDefault();
            e.stopPropagation();
            if (payload.scope === 'recruit') {
                this._handleRecruitSlotDrop(payload.slotIndex, targetIndex);
            }
        });
    }

    _parseRecruitDragPayload(rawData) {
        if (!rawData) return null;
        try {
            const payload = JSON.parse(rawData);
            return payload && typeof payload === 'object' ? payload : null;
        } catch (err) {
            return null;
        }
    }

    _handleRecruitSlotDrop(sourceIndex, targetIndex) {
        if (sourceIndex === targetIndex) return;
        if (sourceIndex < 0 || sourceIndex >= this._recruitSlots.length) return;
        if (targetIndex < 0 || targetIndex >= this._recruitSlots.length) return;

        const sourceUnit = this._recruitSlots[sourceIndex];
        const targetUnit = this._recruitSlots[targetIndex];
        if (!sourceUnit) return;

        if (!targetUnit) {
            this._recruitSlots[targetIndex] = sourceUnit;
            this._recruitSlots[sourceIndex] = null;
            this._renderRecruitBar();
            return;
        }

        const check = (!sourceUnit.isShovel && !targetUnit.isShovel)
            ? this.merge.canMerge(sourceUnit, targetUnit)
            : { canMerge: false };

        if (check.canMerge) {
            const result = this.merge.performMerge(sourceUnit, targetUnit);
            if (result.success) {
                this._recruitSlots[targetIndex] = result.result;
                this._recruitSlots[sourceIndex] = null;
            }
        } else {
            [this._recruitSlots[sourceIndex], this._recruitSlots[targetIndex]] =
                [this._recruitSlots[targetIndex], this._recruitSlots[sourceIndex]];
        }

        this._renderRecruitBar();
    }

    highlightRecruitSlot(slotIndex) {
        this.clearRecruitSlotHighlight();
        const slot = this.$.recruitSlots.querySelector(`.recruit-slot[data-slot-index="${slotIndex}"]`);
        if (slot) {
            slot.classList.add('is-board-drop-target');
        }
    }

    clearRecruitSlotHighlight() {
        this.$.recruitSlots.querySelectorAll('.recruit-slot').forEach((slot) => {
            slot.classList.remove('is-drop-target', 'is-board-drop-target');
        });
    }

    getRecruitSlotCount() {
        return this._recruitSlots.length;
    }

    getRecruitUnit(index) {
        if (index >= 0 && index < this._recruitSlots.length) {
            return this._recruitSlots[index];
        }
        return null;
    }

    clearRecruitSlot(index) {
        if (index >= 0 && index < this._recruitSlots.length) {
            this._recruitSlots[index] = null;
            this._renderRecruitBar();
        }
    }

    removeRecruitUnit(index) {
        this.clearRecruitSlot(index);
    }

    setRecruitSlot(index, unit) {
        if (index >= 0 && index < this._recruitSlots.length) {
            this._recruitSlots[index] = unit;
            this._renderRecruitBar();
        }
    }

    // ==================== 单位信息显示 ====================

    _showUnitInfo(unit) {
        this._showPanel(this.$.unitInfoPanel);
        this.$.unitInfoName.textContent = `${unit.displayName} Lv${unit.level}`;

        // 显示攻击范围
        if (unit.tile) {
            this.board.showAttackRange(
                unit.tile.row, unit.tile.col,
                unit.range,
                unit.getQualityColor()
            );
        }

        const info = unit.getInfo();
        this.$.unitInfoContent.innerHTML = `
            <div class="info-row"><span>类型</span><span>${info.type}</span></div>
            <div class="info-row"><span>品质</span><span style="color:${unit.getQualityColor()}">${info.quality}</span></div>
            <div class="info-row"><span>攻击力</span><span>${info.atk}</span></div>
            <div class="info-row"><span>攻速</span><span>${info.atkSpeed}次/秒</span></div>
            <div class="info-row"><span>范围</span><span>${info.range}</span></div>
            <div class="info-row"><span>攻击类型</span><span>${info.attackType}</span></div>
            <div class="info-row"><span>位置</span><span>${info.tilePos}</span></div>
        `;

        // 操作按钮
        this.$.unitActions.innerHTML = `
            <button class="danger" id="btn-sell">出售(50%退款)</button>
        `;

        document.getElementById('btn-sell').addEventListener('click', () => {
            if (unit.tile) {
                unit.tile.removeUnit();
            }
            this.economy.sellUnit(unit);
            this.selectedUnit = null;
            this._hideUnitInfo();
        });
    }

    _hideUnitInfo() {
        this._hidePanel(this.$.unitInfoPanel);
        this.board.clearAttackRange();
    }

    // ==================== 结果弹窗 ====================

    _showResult(result) {
        this.$.resultOverlay.classList.remove('hidden');
        if (result === 'win') {
            this.$.resultTitle.textContent = '胜利！';
            this.$.resultTitle.style.color = '#4caf50';
            this.$.resultInfo.textContent = '你成功守卫了文字！';
        } else {
            this.$.resultTitle.textContent = '失败...';
            this.$.resultTitle.style.color = '#f44336';
            this.$.resultInfo.textContent = '文字被摧毁了...';
        }
    }

    _hideResult() {
        this.$.resultOverlay.classList.add('hidden');
    }

    // ==================== 面板控制 ====================

    _showPanel(panel) {
        panel.classList.remove('hidden');
    }

    _hidePanel(panel) {
        panel.classList.add('hidden');
    }

    _togglePanel(panel) {
        panel.classList.toggle('hidden');
    }
}
