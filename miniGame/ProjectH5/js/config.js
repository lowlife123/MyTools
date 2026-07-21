/**
 * config.js - 游戏全局配置
 * 集中管理所有游戏数值参数，修改数值只需改此文件
 * 
 * 修改指南：
 * - 调整游戏难度 → 修改 ENEMY, WAVE 相关
 * - 调整抽卡概率 → 修改 GACHA 相关
 * - 调整单位属性 → 修改 UNITS 相关
 * - 调整经济数值 → 修改 ECONOMY 相关
 */
const CONFIG = {
    // ==================== 棋盘配置 ====================
    BOARD: {
        ROWS: 6,           // 棋盘行数
        COLS: 8,           // 棋盘列数
        TILE_SIZE: 60,     // 格子大小(像素)
        INITIAL_TILES: 8,  // 初始可用地块数量
        MAX_TILES: 48,     // 最大地块数(6×8=48)
    },

    // ==================== "字"防守目标配置 ====================
    WORD: {
        HP: 3,             // 初始血量(红心数)
        MAX_HP: 5,         // 最大血量
        /** 目标位置：通常放在敌方路径终点 */
        POSITION: { row: 5, col: 7 },
    },

    // ==================== 敌方路径配置 ====================
    /** 敌人行进路径（坐标数组，从入口到"字"位置） */
    ENEMY_PATH: [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 0 },
        { row: 3, col: 0 },
        { row: 4, col: 0 },
        { row: 5, col: 0 },
        { row: 5, col: 1 },
        { row: 5, col: 2 },
        { row: 4, col: 2 },
        { row: 3, col: 2 },
        { row: 2, col: 2 },
        { row: 1, col: 2 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
        { row: 1, col: 3 },
        { row: 2, col: 3 },
        { row: 3, col: 3 },
        { row: 4, col: 3 },
        { row: 5, col: 3 },
        { row: 5, col: 4 },
        { row: 5, col: 5 },
        { row: 4, col: 5 },
        { row: 3, col: 5 },
        { row: 2, col: 5 },
        { row: 1, col: 5 },
        { row: 0, col: 5 },
        { row: 0, col: 6 },
        { row: 1, col: 6 },
        { row: 2, col: 6 },
        { row: 3, col: 6 },
        { row: 4, col: 6 },
        { row: 5, col: 6 },
        { row: 5, col: 7 },  // 终点（"字"所在位置）
    ],

    // ==================== 经济系统配置 ====================
    ECONOMY: {
        STARTING_INK: 1000,      // 初始墨水
        GACHA_COST: 10,          // 单次征兵消耗
        SELL_REFUND_RATIO: 0.5,  // 出售单位返还比例
        SHOVEL_COST: 30,         // 铲子价格(墨水)
    },

    // ==================== 征兵(抽卡)配置 ====================
    GACHA: {
        /** 单次抽取单位数量 */
        DRAW_COUNT: 6,

        /** 征兵副棋盘槽位数量 */
        SLOT_COUNT: 6,
        
        /** 异兽单字出现概率（每个非铲子栏位） */
        BEAST_CHANCE: 0.15,

        /** 异兽字保底：连续N次未出异兽字，第N+1次必出 */
        BEAST_PITY: 20,

        /** 铲子掉落概率（每次征兵额外判定） */
        SHOVEL_CHANCE: 0.3,

        /** 铲子保底：连续N次未出铲子，第N+1次必出 */
        SHOVEL_PITY: 3,
    },

    // ==================== 小兵单位配置 ====================
    /**
     * 五大元素兵种信息
     * 修改方式：调整各属性值
     * 
     * 攻击距离(格数)：直接填写格数数字，如 2/3/4 等
     * 攻击类型：
     *   single(单体) / splash(范围) / pierce(穿刺直线) / burning(灼烧持续)
     */
    SOLDIER_TYPES: {
        mu: {  // 木
            name: '木', displayName: '木兵',
            range: 3, attackType: 'splash',
            baseAtk: 15, baseSpeed: 1.0,
            quality: 'common',
            color: '#4caf50',
            /** 升级链: 木→林→森 */
            upgradeNames: ['木', '林', '森'],
        },
        huo: {  // 火
            name: '火', displayName: '火兵',
            range: 2, attackType: 'burning',
            baseAtk: 20, baseSpeed: 0.8,
            quality: 'common',
            color: '#f44336',
            upgradeNames: ['火', '炎', '焱'],
        },
        shui: {  // 水
            name: '水', displayName: '水兵',
            range: 4, attackType: 'single',
            baseAtk: 12, baseSpeed: 1.2,
            quality: 'common',
            color: '#2196f3',
            upgradeNames: ['水', '冰', '淼'],
        },
        tu: {  // 土
            name: '土', displayName: '土兵',
            range: 2, attackType: 'single',
            baseAtk: 25, baseSpeed: 0.6,
            quality: 'common',
            color: '#795548',
            upgradeNames: ['土', '圭', '垚'],
        },
        jin: {  // 金
            name: '金', displayName: '金兵',
            range: 3, attackType: 'pierce',
            baseAtk: 18, baseSpeed: 0.9,
            quality: 'common',
            color: '#ffc107',
            upgradeNames: ['金', '鍂', '鑫'],
        },
    },

    // ==================== 异兽配置 ====================
    /**
     * 异兽由两个单字拼合而成
     * 例如："青"+"龙" = 青龙
     * nameFirst: 姓(第一个字)
     * nameSecond: 名(第二个字)
     */
    BEASTS: {
        qinglong: {
            nameFirst: '青', nameSecond: '龙', displayName: '青龙',
            quality: 'legendary',
            baseAtk: 50, baseSpeed: 1.0, range: 4,
            skill: { name: '龙息', desc: '对路径上所有敌人造成150%伤害', type: 'pierce' },
            color: '#00e5ff',
        },
        baihu: {
            nameFirst: '白', nameSecond: '虎', displayName: '白虎',
            quality: 'legendary',
            baseAtk: 60, baseSpeed: 1.3, range: 2,
            skill: { name: '虎啸', desc: '击退周围敌人1格', type: 'knockback' },
            color: '#ffffff',
        },
        zhuque: {
            nameFirst: '朱', nameSecond: '雀', displayName: '朱雀',
            quality: 'epic',
            baseAtk: 40, baseSpeed: 1.5, range: 3,
            skill: { name: '烈焰', desc: '点燃目标持续灼烧3秒', type: 'burning' },
            color: '#ff5722',
        },
        xuanwu: {
            nameFirst: '玄', nameSecond: '武', displayName: '玄武',
            quality: 'epic',
            baseAtk: 30, baseSpeed: 0.7, range: 3,
            skill: { name: '龟甲', desc: '眩晕目标2秒', type: 'stun' },
            color: '#4caf50',
        },
    },

    // ==================== 敌方配置 ====================
    ENEMY: {
        /** 敌人类型定义 */
        TYPES: {
            guai: {  // 怪
                name: '怪', hp: 30, speed: 2, atk: 5, category: 'normal',
                inkReward: 3, color: '#81c784',
            },
            shou: {  // 兽
                name: '兽', hp: 60, speed: 1.7, atk: 10, category: 'normal',
                inkReward: 6, color: '#ffb74d',
            },
            xiongshou: {  // 凶兽
                name: '凶兽', hp: 150, speed: 1.3, atk: 20, category: 'boss',
                inkReward: 15, color: '#ef5350',
            },
        },

        /** 波次生成间隔(秒) */
        WAVE_INTERVAL: 15,

        /** 波次间倒计时(秒) */
        WAVE_COUNTDOWN: 15,

        /** 敌人生成间隔(秒) */
        SPAWN_INTERVAL: 1.5,

        /** 敌方波次配置 */
        FIRST_WAVE_DELAY: 3,

        /** 波次配置(波次号 → 敌人数量与类型, countdown=本轮开始前倒计时秒数) */
        WAVES: [
            { countdown: 15, levelMultiplier: 1.0, enemies: [{ type: 'guai', count: 3 }] },
            { countdown: 15, levelMultiplier: 1.0, enemies: [{ type: 'guai', count: 4 }, { type: 'shou', count: 1 }] },
            { countdown: 15, levelMultiplier: 1.0, enemies: [{ type: 'guai', count: 3 }, { type: 'shou', count: 2 }] },
            { countdown: 15, levelMultiplier: 1.0, enemies: [{ type: 'shou', count: 2 }, { type: 'shou', count: 3 }] },
            { countdown: 15, levelMultiplier: 1.5, enemies: [{ type: 'xiongshou', count: 1 }, { type: 'guai', count: 2 }] },
        ],
    },

    // ==================== 合成升级配置 ====================
    MERGE: {
        /** 小兵最大等级 */
        SOLDIER_MAX_LEVEL: 5,

        /** 异兽最大等级 */
        BEAST_MAX_LEVEL: 3,

        /**
         * 升级系数表
         * levelLevel[n] = n级单位的属性倍率
         * 例如 levelMultiplier[2] = 2.0 → 2级单位攻击力为基础值×2
         */
        LEVEL_MULTIPLIER: [1.0, 2.0, 3.5, 5.5, 8.0],

        /** 异兽每击杀多少敌人升1级 */
        BEAST_XP_PER_LEVEL: 10,
    },

    // ==================== 道具配置 ====================
    ITEMS: {
        active: {
            freeze: {
                name: '冰冻术', desc: '冻结所有敌人3秒',
                cost: 20, duration: 3,
            },
            lightning: {
                name: '雷霆一击', desc: '对路径上所有敌人造成30点伤害',
                cost: 25,
            },
        },
        passive: {
            inkPlus: {
                name: '墨水源泉', desc: '墨水自然恢复速度+50%',
                cost: 40,
            },
            attackUp: {
                name: '攻击强化', desc: '所有单位攻击力+20%',
                cost: 35,
            },
        },
    },
};

// 导出到全局作用域(非模块化项目的折中方案)
// 后续可改为 export default CONFIG
