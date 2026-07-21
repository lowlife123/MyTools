/**
 * GachaSystem.js - 征兵(抽卡)系统
 * 消耗墨水随机抽取单位，含保底机制
 * 
 * 抽取逻辑：
 * 1. 先判定铲子（含保底），铲子占1个栏位
 * 2. 剩余栏位按概率出普通字/异兽字
 * 3. 异兽字含保底机制
 * 
 * 修改指南：
 * - 调整异兽概率 → 修改CONFIG.GACHA.BEAST_CHANCE
 * - 调整异兽保底 → 修改CONFIG.GACHA.BEAST_PITY
 * - 调整铲子概率 → 修改CONFIG.GACHA.SHOVEL_CHANCE
 * - 调整铲子保底 → 修改CONFIG.GACHA.SHOVEL_PITY
 */
class GachaSystem {
    constructor(economy) {
        /** 经济系统引用 */
        this.economy = economy;

        /** 连续未出异兽字的次数 */
        this._beastPityCount = 0;

        /** 连续未出铲子的征兵次数 */
        this._shovelPityCount = 0;

        /** 本次抽卡结果缓存 */
        this._lastResult = [];
    }

    /**
     * 执行一次征兵(抽卡)
     * @returns {{ success: boolean, units: Unit[], message: string }}
     */
    draw() {
        const cost = CONFIG.ECONOMY.GACHA_COST;
        if (!this.economy.spendInk(cost)) {
            return { success: false, units: [], message: '墨水不足！' };
        }

        const units = [];
        const drawCount = CONFIG.GACHA.DRAW_COUNT;

        // 先判定是否掉落铲子（含保底）
        let hasShovel = Math.random() < CONFIG.GACHA.SHOVEL_CHANCE;
        this._shovelPityCount++;
        if (this._shovelPityCount >= CONFIG.GACHA.SHOVEL_PITY) {
            hasShovel = true;
        }
        if (hasShovel) {
            this._shovelPityCount = 0;
        }
        const unitCount = hasShovel ? drawCount - 1 : drawCount;

        for (let i = 0; i < unitCount; i++) {
            const unit = this._generateUnit();
            if (unit) {
                units.push(unit);
            }
        }

        // 铲子占据征兵栏一个栏位
        if (hasShovel) {
            units.push({
                displayName: '铲子',
                color: '#8d6e63',
                quality: 'common',
                level: 1,
                isShovel: true,
                id: Helpers.generateId(),
                getQualityColor: () => '#8d6e63',
            });
            Helpers.log('获得了铲子，拖到未解锁地块即可使用！');
        }

        this._lastResult = units;
        EventBus.emit(GAME_EVENTS.GACHA_RESULT, { units, hasShovel });

        return {
            success: true,
            units,
            message: units.length > 0 ? `获得了 ${units.length} 个单位！` : '什么也没抽到...',
        };
    }

    /**
     * 生成一个随机单位
     * @returns {Unit|null}
     */
    _generateUnit() {
        // 异兽字保底触发
        if (this._beastPityCount >= CONFIG.GACHA.BEAST_PITY) {
            this._beastPityCount = 0;
            return this._generateBeastChar();
        }

        // 按概率出异兽字
        if (Math.random() < CONFIG.GACHA.BEAST_CHANCE) {
            this._beastPityCount = 0;
            return this._generateBeastChar();
        }

        // 普通字（小兵）
        this._beastPityCount++;
        return this._generateSoldier();
    }

    /**
     * 生成随机小兵（普通字）
     */
    _generateSoldier() {
        const types = Object.keys(CONFIG.SOLDIER_TYPES);
        const randType = types[Helpers.randomInt(0, types.length - 1)];
        return new Soldier(randType, 1, 'common');
    }

    /**
     * 生成随机异兽单字
     */
    _generateBeastChar() {
        const beastKeys = Object.keys(CONFIG.BEASTS);
        const randKey = beastKeys[Helpers.randomInt(0, beastKeys.length - 1)];
        const randBeast = CONFIG.BEASTS[randKey];
        
        const chr = Math.random() < 0.5 ? randBeast.nameFirst : randBeast.nameSecond;
        
        const unit = new Soldier('jin', 1, randBeast.quality);
        unit.displayName = chr;
        unit._beastChar = chr;
        unit._beastKey = randKey;
        unit.color = '#f0d78c';
        return unit;
    }

    /**
     * 获取上次抽卡结果
     */
    getLastResult() {
        return this._lastResult;
    }

    /**
     * 获取保底进度
     */
    getPityProgress() {
        return {
            beastCurrent: this._beastPityCount,
            beastMax: CONFIG.GACHA.BEAST_PITY,
        };
    }
}
