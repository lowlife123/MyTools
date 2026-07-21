/**
 * Board.js - 5×8棋盘系统
 * 管理整个游戏棋盘，包含地块数组和Canvas渲染
 * 
 * 使用Canvas绘制棋盘、地块、路径、单位和敌人
 * 
 * 修改指南：
 * - 改变配色 → 修改Tile.getDisplayColor()或本文件的drawXxx方法
 * - 添加绘制效果 → 在draw()方法中添加新的绘制逻辑
 */
class Board {
    constructor(canvasId) {
        /** Canvas元素 */
        this.canvas = document.getElementById(canvasId);
        /** 2D渲染上下文 */
        this.ctx = this.canvas.getContext('2d');

        /** 棋盘配置 */
        this.rows = CONFIG.BOARD.ROWS;
        this.cols = CONFIG.BOARD.COLS;
        this.tileSize = CONFIG.BOARD.TILE_SIZE;
        this.padding = 4;  // 地块间距

        /** 地块二维数组 grid[row][col] */
        this.grid = [];

        /** 路径系统 */
        this.path = new Path();

        /** 当前悬停/选中的地块 */
        this.hoveredTile = null;
        this.selectedTile = null;

        /** 拖拽状态 { fromTile, unit, mouseX, mouseY } | null */
        this._dragState = null;

        /** HTML5拖放悬停地块（征兵栏拖入） */
        this._dragOverTile = null;

        /** 攻击范围高亮 { row, col, range, color } | null */
        this._attackRangeHighlight = null;

        /** 攻击范围素材图片 */
        this._rangeImg = new Image();
        this._rangeImg.src = 'resource/circle.png';

        /** 命中特效动画队列 */
        this._animations = [];

        this._initGrid();  // 初始化grid数组
        this._setupCanvas();
        this._bindEvents();
    }

    // ==================== 初始化 ====================

    /**
     * 初始化地块数组
     */
    _initGrid() {
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                const tile = new Tile(r, c);
                // 标记路径地块
                if (this.path.isOnPath(r, c)) {
                    tile.isPath = true;
                    tile.unlocked = true; // 路径地块默认解锁
                }
                // 标记"字"位置
                if (r === CONFIG.WORD.POSITION.row && c === CONFIG.WORD.POSITION.col) {
                    tile.isWord = true;
                }
                // 标记起点
                const startPt = this.path.startPoint;
                if (r === startPt.row && c === startPt.col) {
                    tile.isStart = true;
                }
                this.grid[r][c] = tile;
            }
        }

        // 初始解锁地块（第一批可用地块）
        this._unlockInitialTiles();
    }

    /**
     * 解锁初始地块
     * 默认解锁路径旁的非路径地块
     */
    _unlockInitialTiles() {
        let count = 0;
        // 优先解锁路径左右两侧的地块
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (count >= CONFIG.BOARD.INITIAL_TILES) return;
                const tile = this.grid[r][c];
                if (!tile.isPath && !tile.unlocked) {
                    // 检查是否在路径旁边
                    if (this._isAdjacentToPath(r, c)) {
                        tile.unlock();
                        count++;
                    }
                }
            }
        }
        // 如果还不够，继续解锁其他地块
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (count >= CONFIG.BOARD.INITIAL_TILES) return;
                const tile = this.grid[r][c];
                if (!tile.isPath && !tile.unlocked) {
                    tile.unlock();
                    count++;
                }
            }
        }
    }

    /**
     * 检查某地块是否与路径相邻
     */
    _isAdjacentToPath(row, col) {
        for (let r = row - 1; r <= row + 1; r++) {
            for (let c = col - 1; c <= col + 1; c++) {
                if (r === row && c === col) continue;
                if (this.isValidCoord(r, c) && this.grid[r][c].isPath) return true;
            }
        }
        return false;
    }

    /**
     * 设置Canvas尺寸
     */
    _setupCanvas() {
        const w = this.cols * (this.tileSize + this.padding) + this.padding;
        const h = this.rows * (this.tileSize + this.padding) + this.padding;
        this.canvas.width = w;
        this.canvas.height = h;
        // 确保画布以正确比例显示，每个格子始终正方形
        this.canvas.style.width = '100%';
        this.canvas.style.height = 'auto';
        this.canvas.style.aspectRatio = `${w} / ${h}`;
    }

    // ==================== 事件绑定 ====================

    _bindEvents() {
        // 鼠标事件
        this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
        this.canvas.addEventListener('contextmenu', (e) => this._onContextMenu(e));
        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredTile = null;
            if (!this._dragState) {
                this.canvas.classList.remove('dragging');
            }
            this.draw();
        });
        document.addEventListener('mousemove', (e) => {
            if (this._dragState) this._onMouseMove(e);
        });
        document.addEventListener('mouseup', (e) => {
            if (this._dragState) this._onMouseUp(e);
        });
        // 触屏事件
        this.canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this._onTouchEnd(e));
        document.addEventListener('touchmove', (e) => {
            if (this._dragState) this._onTouchMove(e);
        }, { passive: false });
        document.addEventListener('touchend', (e) => {
            if (this._dragState) this._onTouchEnd(e);
        });
        // HTML5拖放支持（从征兵栏拖入棋盘）
        this.canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            // 高亮拖放目标地块
            const tile = this._getTileFromEvent(e);
            if (tile !== this._dragOverTile) {
                this._dragOverTile = tile;
                this.draw();
            }
        });
        this.canvas.addEventListener('dragleave', (e) => {
            this._dragOverTile = null;
            this.draw();
        });
        this.canvas.addEventListener('drop', (e) => this._onDragDrop(e));
    }

    // ==================== 坐标辅助 ====================

    /**
     * 获取事件在Canvas上的坐标（考虑CSS缩放）
     */
    _getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.offsetX || e.clientX - rect.left) * scaleX,
            y: (e.offsetY || e.clientY - rect.top) * scaleY,
        };
    }

    _getTileFromEvent(e) {
        const pos = this._getCanvasPos(e);
        return this._getTileFromPos(pos.x, pos.y);
    }

    // ==================== 鼠标事件处理 ====================

    _onMouseDown(e) {
        const tile = this._getTileFromEvent(e);
        if (!tile) return;

        // 点击组合异兽的右格 → 断开组合，拖拽恢复的右格异兽字
        if (tile._comboBeast) {
            const beast = tile._comboBeast;
            EventBus.emit(GAME_EVENTS.COMBO_BREAK_REQUEST, { beast });
            // 断开后 tile.unit 为恢复的异兽字
            if (tile.unit) {
                this._dragState = {
                    fromTile: tile,
                    unit: tile.unit,
                    mouseX: 0, mouseY: 0,
                };
                const pos = this._getCanvasPos(e);
                this._dragState.mouseX = pos.x;
                this._dragState.mouseY = pos.y;
                this.canvas.classList.add('dragging');
                this.draw();
            }
            return;
        }

        // 点击组合异兽本身（左格）→ 断开组合，拖拽恢复的左格异兽字
        if (tile.unit && tile.unit._isComboBeast) {
            const beast = tile.unit;
            EventBus.emit(GAME_EVENTS.COMBO_BREAK_REQUEST, { beast });
            if (tile.unit) {
                this._dragState = {
                    fromTile: tile,
                    unit: tile.unit,
                    mouseX: 0, mouseY: 0,
                };
                const pos = this._getCanvasPos(e);
                this._dragState.mouseX = pos.x;
                this._dragState.mouseY = pos.y;
                this.canvas.classList.add('dragging');
                this.draw();
            }
            return;
        }

        // 正常拖拽
        if (!tile.unit) return;
        this._dragState = {
            fromTile: tile,
            unit: tile.unit,
            mouseX: 0,
            mouseY: 0,
        };
        const pos = this._getCanvasPos(e);
        this._dragState.mouseX = pos.x;
        this._dragState.mouseY = pos.y;
        this.canvas.classList.add('dragging');
        this.draw();
    }

    _onMouseMove(e) {
        const tile = this._getTileFromEvent(e);
        if (tile !== this.hoveredTile) {
            this.hoveredTile = tile;
            if (!this._dragState) this.draw();
        }
        // 拖拽中更新位置
        if (this._dragState) {
            const pos = this._getCanvasPos(e);
            this._dragState.mouseX = pos.x;
            this._dragState.mouseY = pos.y;
            this._updateRecruitSlotHover(e.clientX, e.clientY);
            this.draw();
        }
    }

    _onMouseUp(e) {
        if (!this._dragState) {
            // 非拖拽：左键点击 → 显示攻击范围
            const tile = this._getTileFromEvent(e);
            if (tile) {
                // 点击组合异兽的右格 → 发送左格的事件
                if (tile._comboBeast) {
                    const leftTile = tile._comboBeast.tile;
                    EventBus.emit(GAME_EVENTS.TILE_LEFT_CLICK, { row: leftTile.row, col: leftTile.col, tile: leftTile });
                    return;
                }
                EventBus.emit(GAME_EVENTS.TILE_LEFT_CLICK, { row: tile.row, col: tile.col, tile });
            }
            return;
        }

        const dropTile = this._getTileFromEvent(e);
        const { fromTile, unit } = this._dragState;
        this._dragState = null;
        this.canvas.classList.remove('dragging');
        const recruitSlotIndex = this._getRecruitSlotIndexFromClientPoint(e.clientX, e.clientY);
        this._clearRecruitSlotHover();

        if (recruitSlotIndex >= 0) {
            EventBus.emit(GAME_EVENTS.BOARD_TO_RECRUIT, {
                fromTile,
                slotIndex: recruitSlotIndex,
                unitId: unit?.id,
            });
            this.draw();
            return;
        }

        if (dropTile && dropTile !== fromTile) {
            if (dropTile.unit) {
                // 拖到有单位的地块 → 合成
                EventBus.emit(GAME_EVENTS.UNIT_DROP_MERGE, {
                    fromTile: fromTile,
                    toTile: dropTile,
                    unitA: unit,
                    unitB: dropTile.unit,
                });
            } else if (dropTile.isAvailable) {
                // 拖到空地 → 移动
                EventBus.emit(GAME_EVENTS.UNIT_MOVE, {
                    fromTile: fromTile,
                    toTile: dropTile,
                    unit: unit,
                });
            }
        } else if (dropTile) {
            // 原地松手 → 左键点击
            EventBus.emit(GAME_EVENTS.TILE_LEFT_CLICK, { row: dropTile.row, col: dropTile.col, tile: dropTile });
        }

        this.draw();
    }

    /**
     * 右键点击 → 打开详情页
     */
    _onContextMenu(e) {
        e.preventDefault();  // 阻止浏览器默认右键菜单
        const tile = this._getTileFromEvent(e);
        if (!tile) return;

        // 点击组合异兽的右格 → 发送左格的事件
        if (tile._comboBeast) {
            const leftTile = tile._comboBeast.tile;
            EventBus.emit(GAME_EVENTS.TILE_CLICKED, { row: leftTile.row, col: leftTile.col, tile: leftTile });
            return;
        }
        EventBus.emit(GAME_EVENTS.TILE_CLICKED, { row: tile.row, col: tile.col, tile });
    }

    // ==================== 触屏事件处理 ====================

    _getTouchPos(touch) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (touch.clientX - rect.left) * scaleX,
            y: (touch.clientY - rect.top) * scaleY,
        };
    }

    _getTileFromTouch(touch) {
        const pos = this._getTouchPos(touch);
        return this._getTileFromPos(pos.x, pos.y);
    }

    _onTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const tile = this._getTileFromTouch(touch);
        if (!tile) return;

        // 点击组合异兽的右格 → 断开组合，拖拽恢复的右格异兽字
        if (tile._comboBeast) {
            const beast = tile._comboBeast;
            EventBus.emit(GAME_EVENTS.COMBO_BREAK_REQUEST, { beast });
            if (tile.unit) {
                this._dragState = {
                    fromTile: tile,
                    unit: tile.unit,
                    mouseX: 0, mouseY: 0,
                };
                const pos = this._getTouchPos(touch);
                this._dragState.mouseX = pos.x;
                this._dragState.mouseY = pos.y;
                this.canvas.classList.add('dragging');
                this.draw();
            }
            return;
        }

        // 点击组合异兽本身（左格）→ 断开组合，拖拽恢复的左格异兽字
        if (tile.unit && tile.unit._isComboBeast) {
            const beast = tile.unit;
            EventBus.emit(GAME_EVENTS.COMBO_BREAK_REQUEST, { beast });
            if (tile.unit) {
                this._dragState = {
                    fromTile: tile,
                    unit: tile.unit,
                    mouseX: 0, mouseY: 0,
                };
                const pos = this._getTouchPos(touch);
                this._dragState.mouseX = pos.x;
                this._dragState.mouseY = pos.y;
                this.canvas.classList.add('dragging');
                this.draw();
            }
            return;
        }

        // 正常拖拽
        if (!tile.unit) return;
        this._dragState = {
            fromTile: tile,
            unit: tile.unit,
            mouseX: 0,
            mouseY: 0,
        };
        const pos = this._getTouchPos(touch);
        this._dragState.mouseX = pos.x;
        this._dragState.mouseY = pos.y;
        this.canvas.classList.add('dragging');
        this.draw();
    }

    _onTouchMove(e) {
        e.preventDefault();
        if (!this._dragState) return;
        const touch = e.touches[0];
        const pos = this._getTouchPos(touch);
        this._dragState.mouseX = pos.x;
        this._dragState.mouseY = pos.y;
        this.hoveredTile = this._getTileFromPos(pos.x, pos.y);
        this._updateRecruitSlotHover(touch.clientX, touch.clientY);
        this.draw();
    }

    _onTouchEnd(e) {
        if (!this._dragState) {
            const touch = e.changedTouches[0];
            if (touch) {
                const tile = this._getTileFromTouch(touch);
                if (tile) {
                    // 点击组合异兽的右格 → 发送左格的事件
                    if (tile._comboBeast) {
                        const leftTile = tile._comboBeast.tile;
                        EventBus.emit(GAME_EVENTS.TILE_LEFT_CLICK, { row: leftTile.row, col: leftTile.col, tile: leftTile });
                        return;
                    }
                    EventBus.emit(GAME_EVENTS.TILE_LEFT_CLICK, { row: tile.row, col: tile.col, tile });
                }
            }
            return;
        }

        const touch = e.changedTouches[0];
        const dropTile = touch ? this._getTileFromTouch(touch) : null;
        const { fromTile, unit } = this._dragState;
        this._dragState = null;
        this.canvas.classList.remove('dragging');
        const recruitSlotIndex = touch ? this._getRecruitSlotIndexFromClientPoint(touch.clientX, touch.clientY) : -1;
        this._clearRecruitSlotHover();

        if (recruitSlotIndex >= 0) {
            EventBus.emit(GAME_EVENTS.BOARD_TO_RECRUIT, {
                fromTile,
                slotIndex: recruitSlotIndex,
                unitId: unit?.id,
            });
            this.draw();
            return;
        }

        if (dropTile && dropTile !== fromTile) {
            if (dropTile.unit) {
                // 拖到有单位 → 合成
                EventBus.emit(GAME_EVENTS.UNIT_DROP_MERGE, {
                    fromTile: fromTile,
                    toTile: dropTile,
                    unitA: unit,
                    unitB: dropTile.unit,
                });
            } else if (dropTile.isAvailable) {
                // 拖到空地 → 移动
                EventBus.emit(GAME_EVENTS.UNIT_MOVE, {
                    fromTile: fromTile,
                    toTile: dropTile,
                    unit: unit,
                });
            }
        } else if (dropTile) {
            // 原地松手 → 左键点击
            EventBus.emit(GAME_EVENTS.TILE_LEFT_CLICK, { row: dropTile.row, col: dropTile.col, tile: dropTile });
        }
        this.draw();
    }

    _getRecruitSlotIndexFromClientPoint(clientX, clientY) {
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return -1;
        const target = document.elementFromPoint(clientX, clientY);
        const slot = target?.closest?.('.recruit-slot');
        if (!slot) return -1;
        const index = parseInt(slot.dataset.slotIndex, 10);
        return Number.isNaN(index) ? -1 : index;
    }

    _updateRecruitSlotHover(clientX, clientY) {
        const slotIndex = this._getRecruitSlotIndexFromClientPoint(clientX, clientY);
        this._clearRecruitSlotHover();
        if (slotIndex < 0) return;
        const slot = document.querySelector(`.recruit-slot[data-slot-index="${slotIndex}"]`);
        if (slot) {
            slot.classList.add('is-board-drop-target');
        }
    }

    _clearRecruitSlotHover() {
        document.querySelectorAll('.recruit-slot.is-board-drop-target').forEach((slot) => {
            slot.classList.remove('is-board-drop-target');
        });
    }

    /**
     * HTML5拖放：从征兵栏拖入棋盘
     */
    _onDragDrop(e) {
        e.preventDefault();
        this._dragOverTile = null;
        const rawData = e.dataTransfer.getData('text/plain');
        if (!rawData) return;
        let payload = null;
        try {
            payload = JSON.parse(rawData);
        } catch (err) {
            payload = null;
        }
        if (!payload || payload.scope !== 'recruit') return;

        const isShovel = payload.kind === 'shovel';
        const unitIndex = parseInt(payload.slotIndex, 10);
        if (isNaN(unitIndex)) return;

        const dropTile = this._getTileFromEvent(e);
        if (!dropTile) { this.draw(); return; }

        if (isShovel && !dropTile.unlocked && !dropTile.isPath && !dropTile.isWord) {
            // 铲子拖到未解锁地块 → 解锁该地块
            EventBus.emit(GAME_EVENTS.RECRUIT_SHOVEL, {
                unitIndex: unitIndex,
                tile: dropTile,
            });
        } else if (dropTile.isAvailable) {
            // 放到空地 → 直接放置
            EventBus.emit(GAME_EVENTS.RECRUIT_PLACE, {
                unitIndex: unitIndex,
                tile: dropTile,
            });
        } else if (dropTile.unit) {
            // 放到有单位的地块 → 尝试合成
            EventBus.emit(GAME_EVENTS.RECRUIT_MERGE, {
                unitIndex: unitIndex,
                tile: dropTile,
            });
        }
        this.draw();
    }

    _getTileFromPos(x, y) {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const { px, py } = this._tileToPixel(r, c);
                if (x >= px && x < px + this.tileSize &&
                    y >= py && y < py + this.tileSize) {
                    return this.grid[r][c];
                }
            }
        }
        return null;
    }

    // ==================== 坐标转换 ====================

    /**
     * 棋盘坐标转像素坐标(左上角)
     */
    _tileToPixel(row, col) {
        return {
            px: this.padding + col * (this.tileSize + this.padding),
            py: this.padding + row * (this.tileSize + this.padding),
        };
    }

    /**
     * 棋盘坐标转像素中心
     */
    tileCenter(row, col) {
        const { px, py } = this._tileToPixel(row, col);
        return {
            cx: px + this.tileSize / 2,
            cy: py + this.tileSize / 2,
        };
    }

    /**
     * 将画布内部坐标转换为叠加层的DOM坐标
     */
    _canvasToOverlayPosition(x, y) {
        const canvasRect = this.canvas.getBoundingClientRect();
        const parentRect = this.canvas.parentElement.getBoundingClientRect();
        const scaleX = canvasRect.width / this.canvas.width;
        const scaleY = canvasRect.height / this.canvas.height;
        return {
            left: canvasRect.left - parentRect.left + x * scaleX,
            top: canvasRect.top - parentRect.top + y * scaleY,
        };
    }

    /**
     * 根据敌人进度计算画布内像素位置
     */
    getEnemyPixelPosition(enemy) {
        const totalLength = this.path.length - 1;
        if (totalLength <= 0) {
            const start = this.path.startPoint || { row: 0, col: 0 };
            const center = this.tileCenter(start.row, start.col);
            return { x: center.cx, y: center.cy };
        }

        const progress = Math.max(0, Math.min(1, enemy.progress || 0));
        const idx = Math.min(Math.floor(progress * totalLength), totalLength - 1);
        const frac = (progress * totalLength) - idx;
        const wp1 = this.path.waypoints[idx];
        const wp2 = this.path.waypoints[Math.min(idx + 1, totalLength)];
        const p1 = this.tileCenter(wp1.row, wp1.col);
        const p2 = this.tileCenter(wp2.row, wp2.col);

        return {
            x: p1.cx + (p2.cx - p1.cx) * frac,
            y: p1.cy + (p2.cy - p1.cy) * frac,
        };
    }

    // ==================== 坐标验证 ====================

    isValidCoord(row, col) {
        return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
    }

    // ==================== 地块操作 ====================

    /**
     * 获取指定坐标的地块
     */
    getTile(row, col) {
        if (!this.isValidCoord(row, col)) return null;
        return this.grid[row][col];
    }

    /**
     * 使用铲子解锁地块
     * @param {number} row - 行
     * @param {number} col - 列
     * @returns {boolean} 是否成功
     */
    unlockTileWithShovel(row, col) {
        const tile = this.getTile(row, col);
        if (!tile || tile.unlocked || tile.isPath) return false;
        // 必须与已解锁地块相邻
        if (!this._hasUnlockedNeighbor(row, col)) return false;
        tile.unlock();
        return true;
    }

    /**
     * 检查是否有相邻的已解锁地块
     */
    _hasUnlockedNeighbor(row, col) {
        const neighbors = [
            [row - 1, col], [row + 1, col],
            [row, col - 1], [row, col + 1],
        ];
        return neighbors.some(([r, c]) => {
            if (!this.isValidCoord(r, c)) return false;
            return this.grid[r][c].unlocked;
        });
    }

    /**
     * 获取所有可用地块(已解锁、非路径、无单位)
     */
    getAvailableTiles() {
        const tiles = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].isAvailable) {
                    tiles.push(this.grid[r][c]);
                }
            }
        }
        return tiles;
    }

    /**
     * 获取所有已放置单位的已解锁地块
     */
    getOccupiedTiles() {
        const tiles = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const t = this.grid[r][c];
                if (t.unlocked && t.unit) tiles.push(t);
            }
        }
        return tiles;
    }

    /**
     * 获取路径上指定索引处的像素中心
     */
    getPathPixelCenter(index) {
        if (index < 0 || index >= this.path.length) return null;
        const wp = this.path.waypoints[index];
        return this.tileCenter(wp.row, wp.col);
    }

    // ==================== 渲染 ====================

    /**
     * 主绘制方法 - 每帧调用
     * @param {Array} enemies - 敌人数组 [{}, ...]
     */
    draw(enemies = []) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. 绘制所有地块
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                this._drawTile(this.grid[r][c]);
            }
        }

        // 2. 绘制路径箭头
        this._drawPathArrows();

        // 3. 绘制路径上的敌人
        for (const enemy of enemies) {
            this._drawEnemy(enemy);
        }

        // 4. 绘制地块上的单位（跳过组合异兽右格，由_drawUnit统一处理）
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.grid[r][c];
                if (tile._comboBeast) continue; // 组合异兽右格，由左格绘制时整体渲染
                if (tile.unit) {
                    this._drawUnit(tile.unit);
                }
            }
        }

        // 5. 高亮悬停地块
        if (this.hoveredTile && this.hoveredTile.unlocked) {
            this._drawHighlight(this.hoveredTile);
        }

        // 6. 拖拽幽灵效果（半透明单位跟随鼠标/手指）
        if (this._dragState) {
            this._drawDragGhost(this._dragState);
        }

        // 7. 征兵栏拖放高亮目标地块
        if (this._dragOverTile) {
            this._drawDragOverHighlight(this._dragOverTile);
        }

        // 8. 攻击范围高亮（圆形区域）
        if (this._attackRangeHighlight) {
            this._drawAttackRange();
        }

        // 9. 命中特效与范围爆闪
        this._drawAnimations();
    }

    /**
     * 绘制单个地块
     */
    _drawTile(tile) {
        const ctx = this.ctx;
        const { px, py } = this._tileToPixel(tile.row, tile.col);
        const size = this.tileSize;

        // 判断悬停高亮
        let color = tile.getDisplayColor();
        if (tile === this.hoveredTile) {
            color = Helpers.hexToRgba(color, 0.4);
        }

        // 绘制矩形
        ctx.fillStyle = color;
        ctx.strokeStyle = '#455a64';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // 圆角矩形
        const radius = 4;
        ctx.moveTo(px + radius, py);
        ctx.lineTo(px + size - radius, py);
        ctx.quadraticCurveTo(px + size, py, px + size, py + radius);
        ctx.lineTo(px + size, py + size - radius);
        ctx.quadraticCurveTo(px + size, py + size, px + size - radius, py + size);
        ctx.lineTo(px + radius, py + size);
        ctx.quadraticCurveTo(px, py + size, px, py + size - radius);
        ctx.lineTo(px, py + radius);
        ctx.quadraticCurveTo(px, py, px + radius, py);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // "字"位置特殊标记
        if (tile.isWord) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px "Microsoft YaHei"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('字', px + size / 2, py + size / 2);
        }

        // 起点标记
        if (tile.isStart) {
            ctx.fillStyle = '#1b5e20';
            ctx.font = 'bold 12px "Microsoft YaHei"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('起', px + size / 2, py + size / 2);
        }

        // 未解锁标记
        if (!tile.unlocked) {
            ctx.fillStyle = '#546e7a';
            ctx.font = '16px "Microsoft YaHei"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🔒', px + size / 2, py + size / 2);
        }
    }

    /**
     * 绘制路径方向箭头
     */
    _drawPathArrows() {
        const ctx = this.ctx;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);

        for (let i = 0; i < this.path.waypoints.length - 1; i++) {
            const from = this.path.waypoints[i];
            const to = this.path.waypoints[i + 1];
            const fc = this.tileCenter(from.row, from.col);
            const tc = this.tileCenter(to.row, to.col);
            ctx.beginPath();
            ctx.moveTo(fc.cx, fc.cy);
            ctx.lineTo(tc.cx, tc.cy);
            ctx.stroke();
        }
        ctx.setLineDash([]);
    }

    /**
     * 绘制放置的单位
     */
    _drawUnit(unit) {
        if (!unit || !unit.tile) return;

        // 异兽组合单位：绘制跨两个格子的整体
        if (unit._isComboBeast && unit._comboTileRight) {
            this._drawComboBeast(unit);
            return;
        }

        const ctx = this.ctx;
        const { cx, cy } = this.tileCenter(unit.tile.row, unit.tile.col);
        const size = this.tileSize * 0.7;

        // 背景圆
        ctx.fillStyle = unit.color;
        ctx.beginPath();
        ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
        ctx.fill();

        // 品质边框
        ctx.strokeStyle = unit.getFrameColor();
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 文字
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${size * 0.5}px "Microsoft YaHei"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(unit.displayName, cx, cy + 1);

        this._drawUnitLevelBadge(unit, cx, cy, size);
    }

    /**
     * 绘制单位等级标记
     */
    _drawUnitLevelBadge(unit, cx, cy, size) {
        const ctx = this.ctx;
        const label = `Lv${unit.level}`;

        if (unit.level >= 5) {
            const badgeWidth = 28;
            const badgeHeight = 16;
            const badgeX = cx + size / 2 - 10;
            const badgeY = cy - size / 2 - 6;

            ctx.save();
            ctx.shadowColor = 'rgba(255, 213, 79, 0.85)';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#2a1b00';
            ctx.strokeStyle = '#ffd54f';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 6);
            ctx.fill();
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff4bf';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 0.5);
            ctx.restore();
            return;
        }

        ctx.save();
        ctx.fillStyle = '#ffd54f';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(label, cx + size / 2 + 4, cy - size / 2);
        ctx.restore();
    }

    /**
     * 绘制组合异兽整体（跨左右两个格子，一个边框+异兽名字）
     */
    _drawComboBeast(beast) {
        const ctx = this.ctx;
        const leftTile = beast.tile;
        const rightTile = beast._comboTileRight;
        if (!leftTile || !rightTile) return;

        const leftPos = this._tileToPixel(leftTile.row, leftTile.col);
        const rightPos = this._tileToPixel(rightTile.row, rightTile.col);

        const x = leftPos.px + this.padding;
        const y = leftPos.py + this.padding;
        const totalWidth = (rightPos.px + this.tileSize) - x + this.padding;
        const height = this.tileSize - this.padding * 2;
        const radius = 6;

        // 整体背景
        ctx.fillStyle = beast.color;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + totalWidth - radius, y);
        ctx.quadraticCurveTo(x + totalWidth, y, x + totalWidth, y + radius);
        ctx.lineTo(x + totalWidth, y + height - radius);
        ctx.quadraticCurveTo(x + totalWidth, y + height, x + totalWidth - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();

        // 稀有度边框
        ctx.strokeStyle = beast.getQualityColor();
        ctx.lineWidth = 3;
        ctx.stroke();

        // 异兽名字（居中显示）
        const cx = x + totalWidth / 2;
        const cy = y + height / 2;
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${this.tileSize * 0.32}px "Microsoft YaHei"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(beast.displayName, cx, cy + 1);

        // 等级标记（左上角）
        ctx.fillStyle = '#ffd54f';
        ctx.font = `bold 10px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(`Lv${beast.level}`, x + 6, y + 16);
    }

    /**
     * 绘制路径上的敌人
     */
    _drawEnemy(enemy) {
        const ctx = this.ctx;
        const isDead = !enemy.isAlive;
        // 根据敌人在路径上的进度计算像素位置
        const { progress } = enemy; // 0~1之间的路径进度
        const totalLength = this.path.length - 1;
        const idx = Math.min(Math.floor(progress * totalLength), totalLength - 1);
        const frac = (progress * totalLength) - idx; // 在两个waypoint之间的插值比例

        const wp1 = this.path.waypoints[idx];
        const wp2 = this.path.waypoints[Math.min(idx + 1, totalLength)];
        const p1 = this.tileCenter(wp1.row, wp1.col);
        const p2 = this.tileCenter(wp2.row, wp2.col);

        const ex = p1.cx + (p2.cx - p1.cx) * frac;
        const ey = p1.cy + (p2.cy - p1.cy) * frac;

        // 存储位置供碰撞检测使用
        enemy._px = ex;
        enemy._py = ey;

        const r = this.tileSize * 0.35;

        // 设置透明度（尸体半透明）
        const alpha = isDead ? 0.35 : 1.0;
        ctx.globalAlpha = alpha;

        // 敌人主体（尸体用暗色）
        ctx.fillStyle = isDead ? '#555555' : enemy.color;
        ctx.beginPath();
        ctx.arc(ex, ey, r, 0, Math.PI * 2);
        ctx.fill();

        // BOSS特殊标记
        if (enemy.category === 'boss') {
            ctx.strokeStyle = isDead ? '#888888' : '#ffd700';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // 尸体不显示名字（或不显示）
        if (!isDead) {
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${r * 0.8}px "Microsoft YaHei"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(enemy.name, ex, ey + 1);
        }

        ctx.globalAlpha = 1.0;

        // 血量条
        const hpRatio = enemy.hp / enemy.maxHp;
        const barWidth = r * 2;
        const barHeight = 4;
        const barY = ey - r - 8;
        ctx.fillStyle = '#333';
        ctx.fillRect(ex - barWidth / 2, barY, barWidth, barHeight);
        ctx.fillStyle = hpRatio > 0.5 ? '#4caf50' : hpRatio > 0.25 ? '#ff9800' : '#f44336';
        ctx.fillRect(ex - barWidth / 2, barY, barWidth * hpRatio, barHeight);
    }

    /**
     * 绘制高亮边框
     */
    _drawHighlight(tile) {
        const ctx = this.ctx;
        const { px, py } = this._tileToPixel(tile.row, tile.col);
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, this.tileSize - 2, this.tileSize - 2);
    }

    /**
     * 绘制征兵栏拖放高亮
     * - 空地块 → 绿色虚线（可放置）
     * - 有单位的地块 → 金色虚线（可合成）
     * - 铲子拖入时 → 棕色实线（解锁地块）
     */
    _drawDragOverHighlight(tile) {
        const ctx = this.ctx;
        const { px, py } = this._tileToPixel(tile.row, tile.col);

        // 组合异兽占用的格子不接受拖放
        if (tile._comboBeast) return;

        // 铲子拖拽中 → 只高亮未解锁地块
        if (window._isDraggingShovel) {
            if (!tile.unlocked && !tile.isPath && !tile.isWord) {
                ctx.strokeStyle = '#ff7043';
                ctx.lineWidth = 3;
                ctx.setLineDash([]);
                ctx.strokeRect(px + 2, py + 2, this.tileSize - 4, this.tileSize - 4);
            }
            return;
        }
        // 正常单位拖放
        ctx.strokeStyle = tile.isAvailable ? '#4caf50' : '#ffd54f';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 2]);
        ctx.strokeRect(px + 2, py + 2, this.tileSize - 4, this.tileSize - 4);
        ctx.setLineDash([]);
    }

    /**
     * 绘制拖拽中的单位幽灵（半透明跟随光标）
     */
    _drawDragGhost(dragState) {
        const ctx = this.ctx;
        const { unit, mouseX, mouseY } = dragState;
        const size = this.tileSize * 0.7;

        ctx.save();
        ctx.globalAlpha = 0.65;

        // 背景圆
        ctx.fillStyle = unit.color;
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, size / 2, 0, Math.PI * 2);
        ctx.fill();

        // 品质边框
        ctx.strokeStyle = unit.getFrameColor();
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 文字
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${size * 0.5}px "Microsoft YaHei"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(unit.displayName, mouseX, mouseY + 1);

        ctx.restore();
    }

    /**
     * 显示伤害数字浮动效果
     */
    showDamageNumber(row, col, amount, color = '#ff5252') {
        const { cx, cy } = this.tileCenter(row, col);
        this.showDamageNumberAt(cx, cy, amount, color);
    }

    /**
     * 在画布像素坐标处显示伤害浮字
     */
    showDamageNumberAt(x, y, amount, color = '#ff5252', scale = 1) {
        const pos = this._canvasToOverlayPosition(x, y);
        const div = document.createElement('div');
        div.className = 'damage-number';
        div.textContent = `-${amount}`;
        div.style.color = color;
        div.style.left = `${pos.left}px`;
        div.style.top = `${pos.top}px`;
        div.style.fontSize = `${Math.round(16 * scale)}px`;
        div.style.textShadow = `0 0 8px ${color}`;
        this.canvas.parentElement.appendChild(div);
        setTimeout(() => div.remove(), 1000);
    }

    /**
     * 根据命中事件显示伤害反馈
     */
    showDamageFeedback(data) {
        if (!data || !data.target || !data.amount) return;

        const pos = this.getEnemyPixelPosition(data.target);
        const attackType = data.attackType || data.source?.attackType || 'single';
        const color = this._getHitEffectColor(attackType, data);
        const scale = data.killed ? 1.15 : (data.isSecondary ? 0.9 : 1);

        this.showDamageNumberAt(pos.x, pos.y, data.amount, color, scale);
        this._pushHitAnimation(pos.x, pos.y, attackType, data);
    }

    /**
     * 添加命中特效动画
     */
    _pushHitAnimation(x, y, attackType, data = {}) {
        const now = performance.now();
        const color = this._getHitEffectColor(attackType, data);

        this._animations.push({
            kind: 'impact',
            x,
            y,
            color,
            startTime: now,
            duration: 220,
            maxRadius: attackType === 'pierce' ? 18 : 12,
        });

        if (data.showAreaEffect && (attackType === 'splash' || attackType === 'burning')) {
            this._animations.push({
                kind: 'ring',
                x,
                y,
                color,
                startTime: now,
                duration: 320,
                maxRadius: 50,
                lineWidth: attackType === 'burning' ? 5 : 4,
            });
        }

        if (attackType === 'single') {
            this._animations.push({
                kind: 'pulse',
                x,
                y,
                color,
                startTime: now,
                duration: 240,
                maxRadius: 20,
                lineWidth: 3,
            });
        }

        if (attackType === 'pierce') {
            this._animations.push({
                kind: 'burst',
                x,
                y,
                color,
                startTime: now,
                duration: 260,
                maxRadius: 28,
            });
        }
    }

    /**
     * 获取本次命中特效颜色，优先使用出手单位本身颜色
     */
    _getHitEffectColor(attackType, data = {}) {
        let color = null;
        if (data.source?.color) {
            color = data.source.color;
        } else {
            const colorMap = {
                single: '#ffffff',
                splash: '#7ee787',
                burning: '#ff8a65',
                pierce: '#ffd54f',
                knockback: '#80cbc4',
                stun: '#ce93d8',
            };
            color = colorMap[attackType] || '#ff5252';
        }

        if (data.isSecondary) {
            return this._lightenColor(color, 0.45);
        }

        return color;
    }

    /**
     * 将颜色向白色提亮，用于副目标溅射反馈
     */
    _lightenColor(color, amount = 0.4) {
        if (/^#([0-9a-f]{6})$/i.test(color)) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            const nr = Math.round(r + (255 - r) * amount);
            const ng = Math.round(g + (255 - g) * amount);
            const nb = Math.round(b + (255 - b) * amount);
            return `rgb(${nr}, ${ng}, ${nb})`;
        }

        const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/i);
        if (rgbMatch) {
            const parts = rgbMatch[1].split(',').map((part) => part.trim());
            const r = parseFloat(parts[0]);
            const g = parseFloat(parts[1]);
            const b = parseFloat(parts[2]);
            const a = parts[3] != null ? parseFloat(parts[3]) : 1;
            const nr = Math.round(r + (255 - r) * amount);
            const ng = Math.round(g + (255 - g) * amount);
            const nb = Math.round(b + (255 - b) * amount);
            return `rgba(${nr}, ${ng}, ${nb}, ${a})`;
        }

        return color;
    }

    /**
     * 绘制并清理命中特效动画
     */
    _drawAnimations() {
        if (!this._animations.length) return;

        const ctx = this.ctx;
        const now = performance.now();
        this._animations = this._animations.filter((anim) => now - anim.startTime < anim.duration);

        for (const anim of this._animations) {
            const progress = Math.min(1, (now - anim.startTime) / anim.duration);
            const alpha = 1 - progress;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = anim.color;
            ctx.fillStyle = anim.color;

            if (anim.kind === 'impact') {
                const radius = 6 + (anim.maxRadius - 6) * progress;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(anim.x, anim.y, radius, 0, Math.PI * 2);
                ctx.stroke();
            } else if (anim.kind === 'pulse') {
                ctx.lineWidth = anim.lineWidth || 3;
                ctx.beginPath();
                ctx.arc(anim.x, anim.y, anim.maxRadius * progress, 0, Math.PI * 2);
                ctx.stroke();
            } else if (anim.kind === 'ring') {
                ctx.lineWidth = anim.lineWidth || 4;
                ctx.beginPath();
                ctx.arc(anim.x, anim.y, anim.maxRadius * progress, 0, Math.PI * 2);
                ctx.stroke();
            } else if (anim.kind === 'burst') {
                const radius = anim.maxRadius * progress;
                ctx.lineWidth = 2;
                for (let i = 0; i < 4; i++) {
                    const angle = (Math.PI / 4) + i * (Math.PI / 2);
                    const dx = Math.cos(angle) * radius;
                    const dy = Math.sin(angle) * radius;
                    ctx.beginPath();
                    ctx.moveTo(anim.x - dx, anim.y - dy);
                    ctx.lineTo(anim.x + dx, anim.y + dy);
                    ctx.stroke();
                }
            }

            ctx.restore();
        }
    }

    /**
     * 显示单位的攻击范围高亮
     * @param {number} row - 单位所在行
     * @param {number} col - 单位所在列
     * @param {number} range - 攻击范围(半径)
     * @param {string} color - 高亮颜色
     */
    showAttackRange(row, col, range, color) {
        this._attackRangeHighlight = { row, col, range, color };
        this.draw();
    }

    /**
     * 清除攻击范围高亮
     */
    clearAttackRange() {
        this._attackRangeHighlight = null;
        this.draw();
    }

    /**
     * 绘制攻击范围(圆形素材缩放)
     */
    _drawAttackRange() {
        const ctx = this.ctx;
        const { row, col, range } = this._attackRangeHighlight;

        if (!this._rangeImg || !this._rangeImg.complete) return;

        // 单位所在格的中心像素坐标
        const tilePos = this._tileToPixel(row, col);
        const cx = tilePos.px + this.tileSize / 2;
        const cy = tilePos.py + this.tileSize / 2;

        // 攻击范围半径(像素) = range × tileSize
        const radiusPx = range * this.tileSize;

        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.drawImage(
            this._rangeImg,
            cx - radiusPx, cy - radiusPx,   // 左上角
            radiusPx * 2, radiusPx * 2       // 宽高 = 直径
        );
        ctx.restore();
    }
}
