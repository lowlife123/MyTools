/**
 * eventBus.js - 事件总线
 * 用于模块间解耦通信，替代直接函数调用
 * 
 * 使用方式:
 *   EventBus.on('eventName', callback);
 *   EventBus.emit('eventName', data);
 *   EventBus.off('eventName', callback);
 */

const EventBus = {
    /** 事件监听器Map: { eventName: [callback1, callback2, ...] } */
    _listeners: {},

    /**
     * 注册事件监听
     * @param {string} event - 事件名
     * @param {Function} callback - 回调函数
     */
    on(event, callback) {
        if (!this._listeners[event]) {
            this._listeners[event] = [];
        }
        // 避免重复注册
        if (!this._listeners[event].includes(callback)) {
            this._listeners[event].push(callback);
        }
    },

    /**
     * 移除事件监听
     */
    off(event, callback) {
        if (!this._listeners[event]) return;
        this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    },

    /**
     * 派发事件
     * @param {string} event - 事件名
     * @param {*} data - 传递的数据
     */
    emit(event, data) {
        if (!this._listeners[event]) return;
        // 复制数组遍历，防止回调中修改listeners
        [...this._listeners[event]].forEach(callback => {
            try {
                callback(data);
            } catch (err) {
                Helpers.error(`EventBus [${event}] 回调出错:`, err);
            }
        });
    },

    /**
     * 一次性监听
     */
    once(event, callback) {
        const wrapper = (data) => {
            this.off(event, wrapper);
            callback(data);
        };
        this.on(event, wrapper);
    },

    /**
     * 清除所有监听
     */
    clear() {
        this._listeners = {};
    },
};

// ==================== 事件名称常量 ====================
/**
 * 所有游戏事件统一管理，方便查找和修改
 */
const GAME_EVENTS = {
    // 经济
    INK_CHANGE: 'ink_change',          // 墨水变化 { amount, delta }
    SHOVEL_CHANGE: 'shovel_change',    // 铲子数量变化 { count }

    // 棋盘
    TILE_UNLOCKED: 'tile_unlocked',    // 地块解锁 { row, col }
    UNIT_PLACED: 'unit_placed',        // 单位放置 { unit, tile }
    UNIT_REMOVED: 'unit_removed',      // 单位移除 { unit, tile }

    // 抽卡
    GACHA_RESULT: 'gacha_result',      // 抽卡结果 { units }

    // 合成
    MERGE_SUCCESS: 'merge_success',    // 合成成功 { from, to }

    // 战斗
    WAVE_START: 'wave_start',          // 波次开始 { waveNum }
    WAVE_END: 'wave_end',              // 波次结束 { waveNum }
    WAVE_COUNTDOWN: 'wave_countdown',  // 波次倒计时更新 { seconds }
    ENEMY_SPAWNED: 'enemy_spawned',    // 敌人生成 { enemy }
    ENEMY_KILLED: 'enemy_killed',      // 敌人击杀 { enemy, killer, inkReward }
    DAMAGE_DEALT: 'damage_dealt',      // 造成伤害 { target, amount, source }
    WORD_DAMAGED: 'word_damaged',      // "字"受伤 { hp, maxHp }
    WORD_DESTROYED: 'word_destroyed',  // "字"被摧毁 → 游戏失败

    // 游戏状态
    GAME_START: 'game_start',
    GAME_OVER: 'game_over',            // 游戏结束 { result: 'win'|'lose' }
    GAME_RESTART: 'game_restart',

    // UI
    UNIT_SELECTED: 'unit_selected',    // 单位被选中 { unit }
    UNIT_DESELECTED: 'unit_deselected',
    TILE_CLICKED: 'tile_clicked',      // 地块右键点击(打开详情) { row, col, tile }
    TILE_LEFT_CLICK: 'tile_left_click', // 地块左键点击(显示攻击范围) { row, col, tile }

    // 拖拽合成
    UNIT_DROP_MERGE: 'unit_drop_merge', // 拖拽单位到另一个单位上触发合成 { fromTile, toTile, unitA, unitB }
    UNIT_MOVE: 'unit_move',             // 拖拽单位到空地移动位置 { fromTile, toTile, unit }

    // 征兵栏拖放
    RECRUIT_PLACE: 'recruit_place',   // 征兵栏拖单位到空地 { unitIndex, tile }
    RECRUIT_MERGE: 'recruit_merge',   // 征兵栏拖单位到有单位的地块合成 { unitIndex, tile }
    RECRUIT_SHOVEL: 'recruit_shovel', // 征兵栏拖铲子到未解锁地块 { unitIndex, tile }
    BOARD_TO_RECRUIT: 'board_to_recruit', // 主棋盘拖单位到征兵槽 { fromTile, slotIndex, unitId }

    // 异兽字词语组合
    COMBO_FORMED: 'combo_formed',           // 词语组合形成 { beast, comboName }
    COMBO_BROKEN: 'combo_broken',           // 词语组合断开 { beast, charA, charB }
    COMBO_BREAK_REQUEST: 'combo_break_request', // 拖拽请求断开组合 { beast }
};
