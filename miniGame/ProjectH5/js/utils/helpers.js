/**
 * helpers.js - 工具函数模块
 * 提供全局通用的辅助方法
 */

const Helpers = {
    /**
     * 生成指定范围内的随机整数
     * 修改方式：调整min/max传入值即可
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * 按权重随机选择
     * @param {Array} items - [{value, weight}] 权重数组
     * 修改方式：调整各物品的weight值控制概率
     */
    weightedRandom(items) {
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        let rand = Math.random() * totalWeight;
        for (const item of items) {
            rand -= item.weight;
            if (rand <= 0) return item.value;
        }
        return items[items.length - 1].value;
    },

    /**
     * 生成唯一ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    },

    /**
     * 防抖函数
     * 修改方式：调整delay参数控制防抖间隔
     */
    debounce(func, delay = 200) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => func.apply(this, args), delay);
        };
    },

    /**
     * 限流函数
     */
    throttle(func, delay = 200) {
        let lastCall = 0;
        return function (...args) {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                func.apply(this, args);
            }
        };
    },

    /**
     * 将十六进制颜色转为rgba
     * 示例: hexToRgba('#f0d78c', 0.3) → 'rgba(240,215,140,0.3)'
     */
    hexToRgba(hex, alpha = 1) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    },

    /**
     * 日志输出（开发模式）
     * 修改方式：将DEBUG改为false即可关闭日志
     */
    DEBUG: true,
    log(...args) {
        if (this.DEBUG) console.log('[文字守卫]', ...args);
    },
    warn(...args) {
        if (this.DEBUG) console.warn('[文字守卫]', ...args);
    },
    error(...args) {
        console.error('[文字守卫]', ...args);
    }
};
