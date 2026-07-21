/**
 * main.js - 游戏入口文件
 * 创建GameManager实例，启动游戏
 * 
 * 这是整个项目的入口点，所有其他模块都从这里开始加载
 * 
 * 修改指南：
 * - 修改初始化逻辑 → 修改此文件
 * - 添加预加载/启动动画等 → 在此文件添加
 */
(function () {
    'use strict';

    // 等待DOM加载完毕
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startGame);
    } else {
        startGame();
    }

    function startGame() {
        // 创建游戏主管理器
        const game = new GameManager();
        
        // 初始化所有系统
        game.init();

        // 暴露到全局方便调试(可在控制台用window.game访问)
        window.game = game;

        Helpers.log('文字守卫 启动成功！');
        Helpers.log('点击"征兵"获取单位 → 点击卡片放置到棋盘 → 点击"出战"开始防御');
    }
})();
