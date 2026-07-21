/**
 * MapEditor.js - 地图编辑器
 * 
 * 功能：
 * 1. 点击格子设置敌军路径点（自动连线）
 * 2. 切换模式设置初始解锁地块
 * 3. 保存地图到 localStorage，游戏从保存的地图加载
 * 
 * 操作：
 * - 路径模式：点击格子添加/移除路径点，按点击顺序连线
 * - 初始地块模式：点击格子切换该地块是否初始解锁
 * - 右键点击路径点可删除
 */
class MapEditor {
    constructor() {
        this.canvas = document.getElementById('editor-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.rows = CONFIG.BOARD.ROWS;
        this.cols = CONFIG.BOARD.COLS;
        this.tileSize = 56;
        this.padding = 4;

        /** 编辑模式: 'path' | 'initTile' */
        this.mode = 'path';

        /** 路径点数组 [{row, col}, ...] */
        this.pathPoints = [];

        /** 初始解锁地块集合 Set('row,col') */
        this.initTileSet = new Set();

        /** 鼠标悬停的格子 */
        this._hoverTile = null;

        /** 波次数据 [{ enemies: [{type, count}, ...] }, ...] */
        this.waves = JSON.parse(JSON.stringify(CONFIG.ENEMY.WAVES));

        /** 初始墨水 */
        this.startingInk = CONFIG.ECONOMY.STARTING_INK;

        /** 字血量 */
        this.wordHp = CONFIG.WORD.HP;

        /** 出怪间隔(秒) */
        this.spawnInterval = CONFIG.ENEMY.SPAWN_INTERVAL;

        /** 征兵概率配置 */
        this.gachaConfig = {
            slotCount: CONFIG.GACHA.SLOT_COUNT,
            beastChance: CONFIG.GACHA.BEAST_CHANCE,
            beastPity: CONFIG.GACHA.BEAST_PITY,
            shovelChance: CONFIG.GACHA.SHOVEL_CHANCE,
            shovelPity: CONFIG.GACHA.SHOVEL_PITY,
        };

        this._setupCanvas();
        this._bindEvents();
        this._loadSavedMap();
        this._draw();
    }

    // ==================== 初始化 ====================

    _setupCanvas() {
        const w = this.cols * (this.tileSize + this.padding) + this.padding;
        const h = this.rows * (this.tileSize + this.padding) + this.padding;
        this.canvas.width = w;
        this.canvas.height = h;
        this.canvas.style.width = '100%';
        this.canvas.style.height = 'auto';
        this.canvas.style.aspectRatio = `${w} / ${h}`;
    }

    _bindEvents() {
        // 模式切换
        document.getElementById('btn-mode-path').addEventListener('click', () => this._setMode('path'));
        document.getElementById('btn-mode-init-tile').addEventListener('click', () => this._setMode('initTile'));

        // 清空
        document.getElementById('btn-clear').addEventListener('click', () => {
            if (confirm('确定要清空所有编辑内容？')) {
                this.pathPoints = [];
                this.initTileSet.clear();
                this._draw();
            }
        });

        // 保存
        document.getElementById('btn-save').addEventListener('click', () => this._saveMap());

        // Canvas 点击
        this.canvas.addEventListener('click', (e) => this._onClick(e));
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this._onRightClick(e);
        });
        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => {
            this._hoverTile = null;
            this._draw();
        });

        // 波次编辑事件
        document.getElementById('btn-add-wave').addEventListener('click', () => this._addWave());
        document.getElementById('config-ink').addEventListener('change', (e) => {
            this.startingInk = parseInt(e.target.value) || 0;
        });
        document.getElementById('config-word-hp').addEventListener('change', (e) => {
            this.wordHp = parseInt(e.target.value) || 1;
        });
        document.getElementById('config-spawn-interval').addEventListener('change', (e) => {
            this.spawnInterval = parseFloat(e.target.value) || 1.5;
        });
        this._bindGachaEvents();
        this._renderWaves();
    }

    _setMode(mode) {
        this.mode = mode;
        document.querySelectorAll('.tool-btn[data-mode]').forEach(b => b.classList.remove('active'));
        document.getElementById(`btn-mode-${mode === 'initTile' ? 'init-tile' : 'path'}`).classList.add('active');

        const hint = document.getElementById('editor-hint');
        if (mode === 'path') {
            hint.textContent = '点击格子设置路径点，按顺序自动连线；右键删除路径点';
        } else {
            hint.textContent = '点击格子切换初始解锁状态（绿色=初始解锁）';
        }
    }

    // ==================== 坐标转换 ====================

    _getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    }

    _getTileAt(pos) {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const px = this.padding + c * (this.tileSize + this.padding);
                const py = this.padding + r * (this.tileSize + this.padding);
                if (pos.x >= px && pos.x < px + this.tileSize &&
                    pos.y >= py && pos.y < py + this.tileSize) {
                    return { row: r, col: c, px, py };
                }
            }
        }
        return null;
    }

    _getTileCenter(row, col) {
        return {
            cx: this.padding + col * (this.tileSize + this.padding) + this.tileSize / 2,
            cy: this.padding + row * (this.tileSize + this.padding) + this.tileSize / 2,
        };
    }

    // ==================== 编辑操作 ====================

    _onClick(e) {
        const pos = this._getCanvasPos(e);
        const tile = this._getTileAt(pos);
        if (!tile) return;

        if (this.mode === 'path') {
            this._togglePathPoint(tile);
        } else if (this.mode === 'initTile') {
            this._toggleInitTile(tile);
        }

        this._draw();
    }

    _onRightClick(e) {
        if (this.mode !== 'path') return;
        const pos = this._getCanvasPos(e);
        const tile = this._getTileAt(pos);
        if (!tile) return;

        // 右键删除路径点
        const key = `${tile.row},${tile.col}`;
        const idx = this.pathPoints.findIndex(p => `${p.row},${p.col}` === key);
        if (idx >= 0) {
            this.pathPoints.splice(idx, 1);
            this._draw();
        }
    }

    _onMouseMove(e) {
        const pos = this._getCanvasPos(e);
        this._hoverTile = this._getTileAt(pos);
        this._draw();
    }

    /**
     * 切换路径点：已存在则删除，不存在则添加到末尾
     */
    _togglePathPoint(tile) {
        const key = `${tile.row},${tile.col}`;
        const idx = this.pathPoints.findIndex(p => `${p.row},${p.col}` === key);
        if (idx >= 0) {
            this.pathPoints.splice(idx, 1);
        } else {
            this.pathPoints.push({ row: tile.row, col: tile.col });
        }
    }

    /**
     * 切换初始地块：是在集合中则移除，否则加入
     * 路径点不能设为初始地块
     */
    _toggleInitTile(tile) {
        const key = `${tile.row},${tile.col}`;
        const isPath = this.pathPoints.some(p => `${p.row},${p.col}` === key);
        if (isPath) return; // 路径上的格子不能设置为初始地块

        if (this.initTileSet.has(key)) {
            this.initTileSet.delete(key);
        } else {
            this.initTileSet.add(key);
        }
    }

    // ==================== 保存/加载 ====================

    _saveMap() {
        if (this.pathPoints.length < 2) {
            alert('请至少设置2个路径点（起点和终点）！');
            return;
        }

        if (this.waves.length === 0) {
            alert('请至少添加一个波次！');
            return;
        }

        const saveData = {
            enemyPath: [...this.pathPoints],
            initialTileKeys: Array.from(this.initTileSet),
            waves: this.waves,
            startingInk: this.startingInk,
            wordHp: this.wordHp,
            spawnInterval: this.spawnInterval,
            gachaConfig: this.gachaConfig,
        };

        localStorage.setItem('textGuard_mapData', JSON.stringify(saveData));
        const totalEnemies = this.waves.reduce((sum, w) => 
            sum + w.enemies.reduce((s, e) => s + e.count, 0), 0);
        alert(`地图已保存！\n路径点: ${this.pathPoints.length} 个\n初始地块: ${this.initTileSet.size} 个\n波次: ${this.waves.length} 波（共${totalEnemies}个敌人）\n初始墨水: ${this.startingInk}`);
    }

    _loadSavedMap() {
        const saved = localStorage.getItem('textGuard_mapData');
        if (!saved) return;

        try {
            const data = JSON.parse(saved);
            if (data.enemyPath && Array.isArray(data.enemyPath)) {
                this.pathPoints = data.enemyPath;
            }
            if (data.initialTileKeys && Array.isArray(data.initialTileKeys)) {
                this.initTileSet = new Set(data.initialTileKeys);
            }
            if (data.waves && Array.isArray(data.waves)) {
                this.waves = data.waves;
            }
            if (typeof data.startingInk === 'number') {
                this.startingInk = data.startingInk;
                document.getElementById('config-ink').value = this.startingInk;
            }
            if (typeof data.wordHp === 'number') {
                this.wordHp = data.wordHp;
                document.getElementById('config-word-hp').value = this.wordHp;
            }
            if (typeof data.spawnInterval === 'number') {
                this.spawnInterval = data.spawnInterval;
                document.getElementById('config-spawn-interval').value = this.spawnInterval;
            }
            if (data.gachaConfig) {
                this.gachaConfig = {
                    slotCount: Math.max(1, parseInt(data.gachaConfig.slotCount, 10) || CONFIG.GACHA.SLOT_COUNT),
                    beastChance: data.gachaConfig.beastChance ?? CONFIG.GACHA.BEAST_CHANCE,
                    beastPity: data.gachaConfig.beastPity ?? CONFIG.GACHA.BEAST_PITY,
                    shovelChance: data.gachaConfig.shovelChance ?? CONFIG.GACHA.SHOVEL_CHANCE,
                    shovelPity: data.gachaConfig.shovelPity ?? CONFIG.GACHA.SHOVEL_PITY,
                };
            }
            this._syncGachaInputs();
            this._renderWaves();
        } catch (e) {
            console.error('加载地图数据失败:', e);
        }
    }

    // ==================== 波次编辑 ====================

    /** 征兵概率输入绑定 */
    _bindGachaEvents() {
        const gc = this.gachaConfig;
        this._syncGachaInputs();

        document.getElementById('gacha-slot-count').onchange = (e) => {
            gc.slotCount = Math.max(1, parseInt(e.target.value, 10) || CONFIG.GACHA.SLOT_COUNT);
            e.target.value = gc.slotCount;
        };
        document.getElementById('gacha-beast-chance').onchange = (e) => {
            gc.beastChance = parseFloat(e.target.value) || 0;
            e.target.value = gc.beastChance;
        };
        document.getElementById('gacha-beast-pity').onchange = (e) => {
            gc.beastPity = Math.max(1, parseInt(e.target.value, 10) || 20);
            e.target.value = gc.beastPity;
        };
        document.getElementById('gacha-shovel-chance').onchange = (e) => {
            gc.shovelChance = parseFloat(e.target.value) || 0;
            e.target.value = gc.shovelChance;
        };
        document.getElementById('gacha-shovel-pity').onchange = (e) => {
            gc.shovelPity = Math.max(1, parseInt(e.target.value, 10) || 3);
            e.target.value = gc.shovelPity;
        };
    }

    _syncGachaInputs() {
        const gc = this.gachaConfig;
        document.getElementById('gacha-slot-count').value = gc.slotCount;
        document.getElementById('gacha-beast-chance').value = gc.beastChance;
        document.getElementById('gacha-beast-pity').value = gc.beastPity;
        document.getElementById('gacha-shovel-chance').value = gc.shovelChance;
        document.getElementById('gacha-shovel-pity').value = gc.shovelPity;
    }

    /** 添加一个空白波次 */
    _addWave() {
        this.waves.push({ countdown: 15, levelMultiplier: 1.0, enemies: [] });
        this._renderWaves();
    }

    /** 删除指定波次 */
    _deleteWave(index) {
        if (this.waves.length <= 1) {
            alert('至少保留一个波次！');
            return;
        }
        this.waves.splice(index, 1);
        this._renderWaves();
    }

    /** 为指定波次添加一个默认敌人（类型取第一个，数量1，之后可编辑） */
    _addEnemyToWave(waveIndex) {
        const typeKeys = Object.keys(CONFIG.ENEMY.TYPES);
        if (typeKeys.length === 0) return;
        this.waves[waveIndex].enemies.push({ type: typeKeys[0], count: 1 });
        this._renderWaves();
    }

    /** 从波次中移除指定敌人 */
    _removeEnemyFromWave(waveIndex, enemyIndex) {
        this.waves[waveIndex].enemies.splice(enemyIndex, 1);
        this._renderWaves();
    }

    /** 渲染波次UI（每个敌人一行：下拉+数量+移除，变更即时同步数据） */
    _renderWaves() {
        const container = document.getElementById('waves-container');
        const enemyTypes = CONFIG.ENEMY.TYPES;
        const typeKeys = Object.keys(enemyTypes);

        const typeOptions = typeKeys.map(k =>
            `<option value="${k}">${enemyTypes[k].name}</option>`
        ).join('');

        container.innerHTML = this.waves.map((wave, wi) => {
            const enemyRows = wave.enemies.map((enemy, ei) =>
                `<div class="wave-enemy-row">
                    <select class="enemy-type-sel" data-wave="${wi}" data-enemy="${ei}">
                        ${typeKeys.map(k => `<option value="${k}" ${k === enemy.type ? 'selected' : ''}>${enemyTypes[k].name}</option>`).join('')}
                    </select>
                    <span style="color:#888;font-size:12px;">x</span>
                    <input type="number" class="enemy-count-inp" data-wave="${wi}" data-enemy="${ei}" value="${enemy.count}" min="1" max="99">
                    <button class="btn-remove" data-remove-enemy="${wi}" data-enemy="${ei}">移除</button>
                </div>`
            ).join('');

            return `<div class="wave-row" data-wave-index="${wi}">
                <div class="wave-header">
                <span class="wave-label">第${wi + 1}波</span>
                <label style="color:#888;font-size:11px;">倒计时：
                    <input type="number" class="wave-countdown-inp" data-wave-countdown="${wi}" value="${wave.countdown ?? 15}" min="1" step="1" style="width:40px;">秒
                </label>
                <label style="color:#888;font-size:11px;">系数：
                    <input type="number" class="wave-mult-inp" data-wave-mult="${wi}" value="${wave.levelMultiplier ?? 1.0}" min="0.1" step="0.1" style="width:50px;">
                </label>
                <button class="btn-remove" data-delete-wave="${wi}">删除</button>
            </div>
                ${enemyRows || '<div style="color:#666;font-size:12px;padding:2px 0;">暂无敌人</div>'}
                <button class="btn-add" data-add-enemy="${wi}">+ 添加敌人</button>
            </div>`;
        }).join('');

        // --- 事件绑定 ---

        // 删除波次
        container.querySelectorAll('[data-delete-wave]').forEach(btn => {
            btn.onclick = () => this._deleteWave(+btn.dataset.deleteWave);
        });

        // 添加敌人
        container.querySelectorAll('[data-add-enemy]').forEach(btn => {
            btn.onclick = () => this._addEnemyToWave(+btn.dataset.addEnemy);
        });

        // 移除敌人
        container.querySelectorAll('[data-remove-enemy]').forEach(btn => {
            btn.onclick = () => this._removeEnemyFromWave(+btn.dataset.removeEnemy, +btn.dataset.enemy);
        });

        // 敌人类型变更 → 即时同步
        container.querySelectorAll('.enemy-type-sel').forEach(sel => {
            sel.onchange = () => {
                const wi = +sel.dataset.wave;
                const ei = +sel.dataset.enemy;
                this.waves[wi].enemies[ei].type = sel.value;
            };
        });

        // 敌人数量变更 → 即时同步
        container.querySelectorAll('.enemy-count-inp').forEach(inp => {
            inp.onchange = () => {
                const wi = +inp.dataset.wave;
                const ei = +inp.dataset.enemy;
                this.waves[wi].enemies[ei].count = Math.max(1, +inp.value || 1);
                inp.value = this.waves[wi].enemies[ei].count;
            };
        });

        // 波次系数变更 → 即时同步
        container.querySelectorAll('.wave-mult-inp').forEach(inp => {
            inp.onchange = () => {
                const wi = +inp.dataset.waveMult;
                this.waves[wi].levelMultiplier = parseFloat(inp.value) || 1.0;
                inp.value = this.waves[wi].levelMultiplier;
            };
        });

        // 波次倒计时变更 → 即时同步
        container.querySelectorAll('.wave-countdown-inp').forEach(inp => {
            inp.onchange = () => {
                const wi = +inp.dataset.waveCountdown;
                this.waves[wi].countdown = Math.max(1, +inp.value || 15);
                inp.value = this.waves[wi].countdown;
            };
        });
    }

    // ==================== 渲染 ====================

    _draw() {
        const ctx = this.ctx;
        const size = this.tileSize;

        // 清空画布
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制所有格子
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const px = this.padding + c * (size + this.padding);
                const py = this.padding + r * (size + this.padding);
                const key = `${r},${c}`;
                const isPath = this.pathPoints.some(p => `${p.row},${p.col}` === key);
                const isInitTile = this.initTileSet.has(key);

                // 格子背景色
                if (isPath) {
                    ctx.fillStyle = '#4a6741';
                } else if (isInitTile) {
                    ctx.fillStyle = '#2d5a2d';
                } else {
                    ctx.fillStyle = '#2a2a4a';
                }

                // 绘制格子
                this._roundRect(ctx, px, py, size, size, 4);
                ctx.fill();

                // 边框
                ctx.strokeStyle = '#444';
                ctx.lineWidth = 1;
                this._roundRect(ctx, px, py, size, size, 4);
                ctx.stroke();

                // 悬停高亮
                if (this._hoverTile && this._hoverTile.row === r && this._hoverTile.col === c && !isPath) {
                    ctx.strokeStyle = '#f0d78c';
                    ctx.lineWidth = 2;
                    this._roundRect(ctx, px + 1, py + 1, size - 2, size - 2, 4);
                    ctx.stroke();
                }
            }
        }

        // 绘制路径连线
        this._drawPath(ctx);

        // 绘制路径点序号
        this.pathPoints.forEach((p, i) => {
            const { cx, cy } = this._getTileCenter(p.row, p.col);

            // 起点标记
            if (i === 0) {
                ctx.fillStyle = '#4caf50';
                ctx.beginPath();
                ctx.arc(cx, cy, size * 0.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 12px "Microsoft YaHei"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('起', cx, cy);
            }
            // 终点标记
            else if (i === this.pathPoints.length - 1) {
                ctx.fillStyle = '#f44336';
                ctx.beginPath();
                ctx.arc(cx, cy, size * 0.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 12px "Microsoft YaHei"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('字', cx, cy);
            }
            // 中间路径点
            else {
                ctx.fillStyle = '#8bc34a';
                ctx.beginPath();
                ctx.arc(cx, cy, size * 0.15, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = '10px "Microsoft YaHei"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(i + 1, cx, cy);
            }
        });

        // 绘制初始地块标记
        this.initTileSet.forEach(key => {
            const [r, c] = key.split(',').map(Number);
            const { cx, cy } = this._getTileCenter(r, c);
            ctx.fillStyle = '#4caf50';
            ctx.font = '10px "Microsoft YaHei"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('解锁', cx, cy);
        });
    }

    _drawPath(ctx) {
        if (this.pathPoints.length < 2) return;

        ctx.strokeStyle = '#f0d78c';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();

        const first = this._getTileCenter(this.pathPoints[0].row, this.pathPoints[0].col);
        ctx.moveTo(first.cx, first.cy);

        for (let i = 1; i < this.pathPoints.length; i++) {
            const p = this._getTileCenter(this.pathPoints[i].row, this.pathPoints[i].col);
            ctx.lineTo(p.cx, p.cy);
        }

        ctx.stroke();
        ctx.setLineDash([]);
    }

    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    }
}

// 启动编辑器
document.addEventListener('DOMContentLoaded', () => {
    new MapEditor();
});
