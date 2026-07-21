/**
 * Path.js - 敌人路径管理系统
 * 管理5×8棋盘上的固定敌人行进路线
 * 
 * 路径由CONFIG.ENEMY_PATH定义，是一个坐标数组[{row, col}, ...]
 * 从起点走到终点("字"所在位置)
 * 
 * 修改指南：
 * - 修改路径 → 直接改CONFIG.ENEMY_PATH数组
 * - 每条路径必须连续(相邻)
 */
class Path {
    constructor() {
        /** 路径坐标点数组 [{row, col}, ...] */
        this.waypoints = CONFIG.ENEMY_PATH;
        /** 起点 */
        this.startPoint = this.waypoints[0];
        /** 终点("字"位置) */
        this.endPoint = this.waypoints[this.waypoints.length - 1];
    }

    /**
     * 检查某个坐标是否在路径上
     */
    isOnPath(row, col) {
        return this.waypoints.some(p => p.row === row && p.col === col);
    }

    /**
     * 获取路径上的下一个坐标点
     * @param {number} currentIndex - 当前所在路径索引
     * @returns {{row, col}|null} 下一个点，终点返回null
     */
    getNextWaypoint(currentIndex) {
        if (currentIndex >= this.waypoints.length - 1) return null;
        return this.waypoints[currentIndex + 1];
    }

    /**
     * 获取某个坐标在路径中的索引
     * @returns {number} 索引，不在路径上返回-1
     */
    getWaypointIndex(row, col) {
        return this.waypoints.findIndex(p => p.row === row && p.col === col);
    }

    /**
     * 获取路径总长度
     */
    get length() {
        return this.waypoints.length;
    }
}
