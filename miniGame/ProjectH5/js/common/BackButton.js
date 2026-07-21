/**
 * BackButton.js - 全局返回按钮
 * 
 * 自动在非主页页面的左上角注入返回按钮，点击返回上一级页面。
 * 后续新建的任何页面无需额外代码，只需引入此文件即可自动获得返回按钮。
 * 
 * 使用方式：在页面 </body> 前添加
 *   <script src="js/common/BackButton.js"></script>
 */

(function () {
    'use strict';

    // 主页(index.html)不显示返回按钮
    const path = window.location.pathname.toLowerCase();
    const filename = path.split('/').pop() || '';
    if (!filename || filename === 'index.html' || filename === '') return;

    // 创建返回按钮容器
    const container = document.createElement('div');
    container.id = 'global-back-btn';
    container.title = '返回上一页';
    container.innerHTML = '← 返回';
    container.addEventListener('click', () => {
        if (document.referrer && document.referrer.indexOf(window.location.origin) === 0) {
            window.history.back();
        } else {
            window.location.href = 'index.html';
        }
    });

    // 注入到页面顶部
    document.body.prepend(container);
})();
