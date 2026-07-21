/**
 * Beast.js - 异兽单位类
 * 继承自Unit基类，由两个单字拼合而成
 * 例如："青"+"龙" = 青龙
 * 
 * 异兽特点：
 * - 拥有特殊技能(眩晕、击退、灼烧、贯穿等)
 * - 可通过击杀敌人积累经验自动升级
 * - 支持拆分为两个单字(战术撤回)
 * 
 * 修改指南：
 * - 新增异兽 → 在CONFIG.BEASTS中添加新条目
 * - 修改技能效果 → 在BattleSystem中修改对应技能逻辑
 * - 调整异兽属性 → 修改CONFIG中对应baseAtk等值
 */
class Beast extends Unit {
    /**
     * @param {string} beastKey - 异兽key: 'qinglong'|'baihu'|'zhuque'|'xuanwu'
     * @param {number} level - 等级
     */
    constructor(beastKey, level = 1) {
        const config = CONFIG.BEASTS[beastKey];
        if (!config) {
            Helpers.error('未知异兽:', beastKey);
        }

        super({
            displayName: config?.displayName || '?',
            type: 'beast',
            level,
            quality: config?.quality || 'legendary',
            baseAtk: config?.baseAtk || 50,
            baseSpeed: config?.baseSpeed || 1.0,
            range: config?.range || 4,
            attackType: config?.skill?.type || 'single',
            color: config?.color || '#00e5ff',
        });

        /** 异兽key */
        this.beastKey = beastKey;
        /** 组成异兽的第一个字 */
        this.charFirst = config?.nameFirst || '?';
        /** 组成异兽的第二个字 */
        this.charSecond = config?.nameSecond || '?';
        /** 技能信息 */
        this.skill = config?.skill || { name: '无', desc: '', type: 'single' };
        /** 原始配置引用 */
        this.config = config;

        /** 击杀经验值(击杀一定数量敌人自动升级) */
        this.xp = 0;
        this.xpToLevel = CONFIG.MERGE.BEAST_XP_PER_LEVEL;
    }

    /**
     * 击杀敌人获得经验
     * @returns {boolean} 是否升级了
     */
    gainKillXP() {
        this.xp++;
        if (this.xp >= this.xpToLevel && this.level < this.getMaxLevel()) {
            this.xp = 0;
            this.levelUp();
            return true;
        }
        return false;
    }

    /**
     * 拆分为两个单字(用于战术操作)
     * @returns {{first: string, second: string}} 拆分后的两个字
     */
    split() {
        return {
            first: this.charFirst,
            second: this.charSecond,
        };
    }

    /**
     * 获取技能描述
     */
    getSkillInfo() {
        return {
            name: this.skill.name,
            desc: this.skill.desc,
            type: this.skill.type,
        };
    }
}
