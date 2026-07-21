/**
 * ConfigEditor.js - 功能配置编辑器
 * 
 * 可编辑四类数值：
 * 1. 敌方单位（怪、兽、凶兽）：hp, speed(格/秒), atk, inkReward, category, color
 * 2. 小兵棋子（木、火、水、土、金）：baseAtk, baseSpeed, range, attackType, color
 * 3. 异兽棋子（青龙、白虎、朱雀、玄武）：baseAtk, baseSpeed, range, quality, color
 * 4. 等级配置：每级攻击系数、小兵/异兽最大等级、异兽升级所需击杀数
 * 
 * 保存到 localStorage，游戏启动时加载覆盖默认 CONFIG
 */
class ConfigEditor {
    constructor() {
        // 从 CONFIG 深拷贝默认值，再与 localStorage 已保存配置合并（确保新字段不丢失）
        const defaults = {
            enemyData: JSON.parse(JSON.stringify(CONFIG.ENEMY.TYPES)),
            soldierData: JSON.parse(JSON.stringify(CONFIG.SOLDIER_TYPES)),
            beastData: JSON.parse(JSON.stringify(CONFIG.BEASTS)),
            mergeData: {
                levelMultiplier: [...CONFIG.MERGE.LEVEL_MULTIPLIER],
                beastXpPerLevel: CONFIG.MERGE.BEAST_XP_PER_LEVEL,
                soldierMaxLevel: CONFIG.MERGE.SOLDIER_MAX_LEVEL,
                beastMaxLevel: CONFIG.MERGE.BEAST_MAX_LEVEL,
            },
        };
        const saved = this._loadSaved();
        this.enemyData = { ...defaults.enemyData, ...(saved.enemyData || {}) };
        this.soldierData = { ...defaults.soldierData, ...(saved.soldierData || {}) };
        this.beastData = { ...defaults.beastData, ...(saved.beastData || {}) };
        const savedMergeData = saved.mergeData || {};
        this.mergeData = {
            ...defaults.mergeData,
            ...savedMergeData,
            soldierMaxLevel: savedMergeData.soldierMaxLevel ?? defaults.mergeData.soldierMaxLevel,
            beastMaxLevel: savedMergeData.beastMaxLevel ?? defaults.mergeData.beastMaxLevel,
        };
        this.mergeData.levelMultiplier = this._normalizeLevelMultiplier(
            this.mergeData.levelMultiplier,
            this.mergeData.soldierMaxLevel
        );

        this._bindTabs();
        this._bindButtons();
        this._renderAll();
    }

    // ==================== 数据持久化 ====================

    _loadSaved() {
        try {
            const raw = localStorage.getItem('textGuard_configData');
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    _normalizeLevelMultiplier(levelMultiplier, targetLevel) {
        const defaults = [...CONFIG.MERGE.LEVEL_MULTIPLIER];
        const maxLevel = Math.max(1, parseInt(targetLevel, 10) || defaults.length);
        const merged = Array.isArray(levelMultiplier) ? [...levelMultiplier] : [];

        for (let i = 0; i < maxLevel; i++) {
            if (typeof merged[i] !== 'number' || Number.isNaN(merged[i])) {
                merged[i] = defaults[i] ?? merged[i - 1] ?? 1;
            }
        }

        return merged.slice(0, maxLevel);
    }

    _save() {
        const data = {
            enemyData: this.enemyData,
            soldierData: this.soldierData,
            beastData: this.beastData,
            mergeData: this.mergeData,
        };
        localStorage.setItem('textGuard_configData', JSON.stringify(data));
        alert('配置已保存！重新开始游戏生效。');
    }

    _reset() {
        if (!confirm('确定恢复为默认配置？当前修改将丢失。')) return;
        this.enemyData = JSON.parse(JSON.stringify(CONFIG.ENEMY.TYPES));
        this.soldierData = JSON.parse(JSON.stringify(CONFIG.SOLDIER_TYPES));
        this.beastData = JSON.parse(JSON.stringify(CONFIG.BEASTS));
        this.mergeData = {
            levelMultiplier: [...CONFIG.MERGE.LEVEL_MULTIPLIER],
            beastXpPerLevel: CONFIG.MERGE.BEAST_XP_PER_LEVEL,
            soldierMaxLevel: CONFIG.MERGE.SOLDIER_MAX_LEVEL,
            beastMaxLevel: CONFIG.MERGE.BEAST_MAX_LEVEL,
        };
        localStorage.removeItem('textGuard_configData');
        this._renderAll();
        alert('已恢复默认配置。');
    }

    // ==================== Tab 切换 ====================

    _bindTabs() {
        document.querySelectorAll('.config-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.config-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.config-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
            });
        });
    }

    // ==================== 按钮事件 ====================

    _bindButtons() {
        document.getElementById('btn-save-config').addEventListener('click', () => this._save());
        document.getElementById('btn-reset-config').addEventListener('click', () => this._reset());
    }

    // ==================== 渲染 ====================

    _renderAll() {
        this._renderEnemy();
        this._renderSoldier();
        this._renderBeast();
        this._renderLevel();
    }

    /**
     * 渲染敌方单位配置
     */
    _renderEnemy() {
        const container = document.getElementById('enemy-fields');
        container.innerHTML = '';

        const fieldDefs = [
            { key: 'name', label: '名称', type: 'text', readonly: true },
            { key: 'hp', label: '血量', type: 'number', min: 1 },
            { key: 'speed', label: '速度(格/秒)', type: 'number', min: 0.1, step: 0.1 },
            { key: 'atk', label: '攻击力', type: 'number', min: 0 },
            { key: 'inkReward', label: '击杀奖励(墨水)', type: 'number', min: 0 },
            { key: 'category', label: '类别(normal/boss)', type: 'text' },
            { key: 'color', label: '颜色', type: 'color' },
        ];

        this._renderUnitCards(container, this.enemyData, 'enemy', fieldDefs);
    }

    /**
     * 渲染小兵棋子配置
     */
    _renderSoldier() {
        const container = document.getElementById('soldier-fields');
        container.innerHTML = '';

        const fieldDefs = [
            { key: 'name', label: '名称', type: 'text', readonly: true },
            { key: 'displayName', label: '显示名称', type: 'text' },
            { key: 'baseAtk', label: '基础攻击力', type: 'number', min: 0 },
            { key: 'baseSpeed', label: '攻速(秒/次)', type: 'number', min: 0.1, step: 0.1 },
            { key: 'range', label: '攻击距离(格数)', type: 'number', min: 0.5, step: 0.1 },
            { key: 'attackType', label: '攻击类型(single/splash/pierce/burning)', type: 'text' },
            { key: 'color', label: '颜色', type: 'color' },
        ];

        this._renderUnitCards(container, this.soldierData, 'soldier', fieldDefs);
    }

    /**
     * 渲染异兽棋子配置
     */
    _renderBeast() {
        const container = document.getElementById('beast-fields');
        container.innerHTML = '';

        const fieldDefs = [
            { key: 'nameFirst', label: '第一个字', type: 'text', readonly: true },
            { key: 'nameSecond', label: '第二个字', type: 'text', readonly: true },
            { key: 'displayName', label: '显示名称', type: 'text', readonly: true },
            { key: 'quality', label: '稀有度(common/rare/epic/legendary)', type: 'text' },
            { key: 'baseAtk', label: '基础攻击力', type: 'number', min: 0 },
            { key: 'baseSpeed', label: '攻速(次/秒)', type: 'number', min: 0.1, step: 0.1 },
            { key: 'range', label: '攻击距离(格数)', type: 'number', min: 0.5, step: 0.1 },
            { key: 'color', label: '颜色', type: 'color' },
        ];

        this._renderUnitCards(container, this.beastData, 'beast', fieldDefs);
    }

    /**
     * 渲染等级配置
     */
    _renderLevel() {
        const container = document.getElementById('level-fields');
        container.innerHTML = '';

        // 小兵最大等级
        this._addFieldRow(container, 'soldierMaxLevel', '小兵最大等级', 'number', { min: 1, max: 5 },
            () => this.mergeData.soldierMaxLevel, (v) => {
                this.mergeData.soldierMaxLevel = Math.min(5, Math.max(1, parseInt(v, 10) || 5));
                this.mergeData.levelMultiplier = this._normalizeLevelMultiplier(
                    this.mergeData.levelMultiplier,
                    this.mergeData.soldierMaxLevel
                );
                this._renderLevel();
            });

        // 异兽最大等级
        this._addFieldRow(container, 'beastMaxLevel', '异兽最大等级', 'number', { min: 1, max: 5 },
            () => this.mergeData.beastMaxLevel, (v) => {
                this.mergeData.beastMaxLevel = Math.min(5, Math.max(1, parseInt(v, 10) || 3));
            });

        // 异兽升级所需击杀数
        this._addFieldRow(container, 'beastXpPerLevel', '异兽升级所需击杀数', 'number', { min: 1 },
            () => this.mergeData.beastXpPerLevel, (v) => { this.mergeData.beastXpPerLevel = parseInt(v) || 10; });

        // 等级攻击系数
        const multCard = document.createElement('div');
        multCard.className = 'unit-card';
        const multHeader = document.createElement('div');
        multHeader.className = 'unit-card-header';
        multHeader.textContent = '小兵等级攻击系数（基础攻击 × 系数 = 实际攻击）';
        multCard.appendChild(multHeader);

        const multFields = document.createElement('div');
        multFields.className = 'unit-card-fields';

        for (let i = 0; i < this.mergeData.soldierMaxLevel; i++) {
            const row = document.createElement('div');
            row.className = 'field-row';
            const label = document.createElement('label');
            label.className = 'field-label';
            label.textContent = `Lv${i + 1} 系数`;
            row.appendChild(label);

            const input = document.createElement('input');
            input.className = 'field-input';
            input.type = 'number';
            input.min = 0.1;
            input.step = 0.1;
            input.value = this.mergeData.levelMultiplier[i] || 1;
            input.addEventListener('change', () => {
                this.mergeData.levelMultiplier[i] = parseFloat(input.value) || 1;
            });

            row.appendChild(input);
            multFields.appendChild(row);
        }

        multCard.appendChild(multFields);
        container.appendChild(multCard);
    }

    /**
     * 添加单个字段行
     */
    _addFieldRow(container, key, label, type, attrs, getValue, setValue) {
        const card = document.createElement('div');
        card.className = 'unit-card';

        const header = document.createElement('div');
        header.className = 'unit-card-header';
        header.textContent = label;
        card.appendChild(header);

        const fields = document.createElement('div');
        fields.className = 'unit-card-fields';

        const row = document.createElement('div');
        row.className = 'field-row';

        const lbl = document.createElement('label');
        lbl.className = 'field-label';
        lbl.textContent = label;
        row.appendChild(lbl);

        const input = document.createElement('input');
        input.className = 'field-input';
        input.type = type;
        if (attrs.min !== undefined) input.min = attrs.min;
        if (attrs.max !== undefined) input.max = attrs.max;
        if (attrs.step !== undefined) input.step = attrs.step;
        input.value = getValue();
        input.addEventListener('change', () => setValue(input.value));

        row.appendChild(input);
        fields.appendChild(row);
        card.appendChild(fields);
        container.appendChild(card);
    }

    /**
     * 通用单位卡片渲染
     */
    _renderUnitCards(container, dataObj, section, fieldDefs) {
        for (const [key, unit] of Object.entries(dataObj)) {
            const card = document.createElement('div');
            card.className = 'unit-card';
            card.dataset.key = key;

            // 卡片头部：显示名称 + key
            const header = document.createElement('div');
            header.className = 'unit-card-header';
            header.innerHTML = `<span style="color:${unit.color || '#ccc'}">${unit.displayName || unit.name || key}</span><span class="unit-key">${key}</span>`;
            card.appendChild(header);

            // 字段区域
            const fields = document.createElement('div');
            fields.className = 'unit-card-fields';

            for (const def of fieldDefs) {
                const row = document.createElement('div');
                row.className = 'field-row';

                const label = document.createElement('label');
                label.className = 'field-label';
                label.textContent = def.label;
                row.appendChild(label);

                const input = document.createElement('input');
                input.className = 'field-input';
                input.type = def.type;
                if (def.readonly) input.readOnly = true;
                if (def.min !== undefined) input.min = def.min;
                if (def.step !== undefined) input.step = def.step;

                // 设置当前值
                const val = unit[def.key];
                if (def.type === 'color') {
                    input.classList.add('color-input');
                    input.value = val || '#888888';
                    // 监听实时预览
                    input.addEventListener('input', () => this._syncColor(dataObj, key, 'color', input.value));
                } else {
                    input.value = val !== undefined ? val : '';
                }

                // 数值型变更处理
                if (def.type === 'number') {
                    input.addEventListener('change', () => {
                        const parsed = def.step && def.step < 1
                            ? parseFloat(input.value)
                            : parseInt(input.value, 10);
                        dataObj[key][def.key] = Number.isFinite(parsed) ? parsed : 0;
                    });
                } else if (!def.readonly) {
                    // 文本型变更处理
                    input.addEventListener('change', () => {
                        dataObj[key][def.key] = input.value;
                    });
                }

                row.appendChild(input);
                fields.appendChild(row);
            }

            card.appendChild(fields);
            container.appendChild(card);
        }
    }

    /** 颜色实时同步到卡片标题 */
    _syncColor(dataObj, key, field, value) {
        if (dataObj[key]) {
            dataObj[key][field] = value;
            // 实时更新卡片标题颜色
            const card = document.querySelector(`.unit-card[data-key="${key}"]`);
            if (!card) return;
            const span = card.querySelector('.unit-card-header span');
            if (span) span.style.color = value;
        }
    }
}

// 页面加载后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.configEditor = new ConfigEditor();
});
