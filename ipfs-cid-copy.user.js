// ==UserScript==
// @name         IPFS CID Copy Helper
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  自动为网页中的 IPFS 链接和文本添加 CID 复制功能，可以管理排除网址，打开 IPFS-SCAN，以及对 CID 进行网关测速。
// @author       cenglin123
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @homepage     https://github.com/cenglin123/ipfs-cid-copy-helper
// @updateURL    https://github.com/cenglin123/ipfs-cid-copy-helper/raw/main/ipfs-cid-copy.user.js
// @downloadURL  https://github.com/cenglin123/ipfs-cid-copy-helper/raw/main/ipfs-cid-copy.user.js
// @supportURL   https://github.com/cenglin123/ipfs-cid-copy-helper/issues
// @license MIT
// ==/UserScript==

(function() {
    'use strict';

    //// 1. 样式及UI初始化 ////

    // 默认网关列表
    const DEFAULT_GATEWAYS = [
        'https://ipfs.io',
        'https://dweb.link',
        'https://w3s.link',
        'https://gw.crustgw.work',
        'https://gw.crust-gateway.xyz',
        'https://gateway.pinata.cloud',
        'https://content.sado.space',
        'https://ipfs03.food-chain.it',
        'https://ipfs.hypha.coop',
        'https://gw.ipfs-lens.dev',
        'https://ipfs-us1.apillon.io',
        'https://flk-ipfs.xyz',
        'https://i0.img2ipfs.com',
        'https://gw.w3ipfs.net:7443',
        'https://gw.w3ipfs.cn:10443',
        'https://ipfs.interface.social',
        'https://ipfs-5.yoghourt.cloud ',
        'https://ipfs-8.yoghourt.cloud',
        'https://ipfs-11.yoghourt.cloud',
        'https://ipfs-13.yoghourt.cloud',
        'https://snapshot.4everland.link',
        'https://lensshare.4everland.link',
        'https://flair-indexing.4everland.link',
        'https://ogpotheads.4everland.link',
        'https://lxdaoipfs.4everland.link',
        'https://ipfs.runfission.com',
        'https://nftstorage.link',
        'https://ipfs.raribleuserdata.com',
        'https://gw.smallwolf.me',
        'https://eth.sucks',
    ];

    // 样式配置
    GM_addStyle(`
        .ipfs-copy-btn-group {
            display: none;
            position: absolute;
            z-index: 10000;
            transform: translateX(-50%);
        }
        .ipfs-copy-btn {
            display: inline-block;  /* 内联块级元素 */
            background: #4a90e2;
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            margin: 0 2px;  /* 添加水平间距 */
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        .ipfs-copy-btn:hover {
            background: #357abd;
        }
        .ipfs-batch-buttons {
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: none; /* 默认隐藏 */
            flex-direction: column;
            gap: 10px;
            z-index: 10000;
            transition: transform 0.3s ease;
            height: 150px;
        }
        .ipfs-batch-buttons.visible {
            display: flex; /* 显示时改为 flex */
        }
        .ipfs-batch-buttons.collapsed {
            transform: translateX(calc(100% + 20px));
        }
        .ipfs-batch-btn {
            background: #4a90e2;
            color: white;
            padding: 8px 15px;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            display: none;
            position: relative;
            white-space: nowrap;
            transition: transform 0.3s ease;
        }
        .ipfs-batch-btn:hover {
            background: #357abd;
        }
        .ipfs-copy-count {
            background: #5cb3ff;
            color: white;
            border-radius: 50%;
            padding: 2px 6px;
            font-size: 12px;
            position: absolute;
            top: -8px;
            right: -8px;
        }
        .ipfs-toggle-btn {
            position: absolute;
            left: -28px;
            top: 0;
            width: 28px;
            height: 28px;
            background: #4a90e2;
            color: white;
            border: none;
            border-radius: 4px 0 0 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: -2px 0 5px rgba(0,0,0,0.2);
        }
        .ipfs-toggle-btn:hover {
            background: #357abd;
        }
        .ipfs-toggle-btn svg {
            width: 16px;
            height: 16px;
            transition: transform 0.3s ease;
            transform: rotate(180deg);
        }
        .collapsed .ipfs-toggle-btn svg {
            transform: rotate(0deg);
        }
        .ipfs-config-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10001;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            display: none;
            flex-direction: column;
            gap: 10px;
        }

        .ipfs-config-panel.visible {
            display: flex;
        }

        .ipfs-config-panel textarea {
            width: 100%;
            height: 200px;
            margin: 10px 0;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            resize: vertical;
        }

        .ipfs-config-panel .button-group {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }

        .ipfs-config-panel button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            background: #4a90e2;
            color: white;
        }

        .ipfs-config-panel button:hover {
            background: #357abd;
        }

        .ipfs-config-panel h2 {
            margin: 0 0 10px 0;
            padding-bottom: 10px;
            border-bottom: 1px solid #ddd;
        }

        .ipfs-config-panel .help-text {
            font-size: 12px;
            color: #666;
            margin-bottom: 10px;
        }

        /* 网关测速窗口样式 */
        .ipfs-speed-test-window {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 900px;
            max-width: 90vw;
            // height: 750px; /* 固定高度 */
            max-height: 80vh;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10001;
            padding: 20px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            // resize: none; /* 防止用户调整大小 */
        }
        
        /* 添加标题栏拖动样式 */
        .ipfs-speed-test-title {
            font-size: 24px;
            font-weight: bold;
            margin-top: -5px;
            margin-bottom: 10px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move; /* 显示拖动光标 */
            user-select: none; /* 防止文本被选中 */
        }
        
        /* 确保内容区域可滚动 */
        .ipfs-speed-test-content {
            flex: 1;
            overflow-y: auto;
            padding-right: 10px;
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        .ipfs-speed-test-close {
            cursor: pointer;
            font-size: 24px;
            color: #666;
        }
        .ipfs-speed-test-results {
            max-height: 140px;
            overflow-y: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-top: 5px;
            margin-bottom: 10px;
        }
        .ipfs-gateway-item {
            padding: 10px 15px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .ipfs-gateway-item:last-child {
            border-bottom: none;
        }
        .ipfs-gateway-item:hover {
            background-color: #f0f7ff;
        }
        .ipfs-gateway-item.selected {
            background-color: #e3f0ff;
        }
        .ipfs-gateway-url {
            font-weight: bold;
            flex: 1;
        }
        .ipfs-gateway-ping {
            margin-left: 10px;
            color: #555;
            width: 70px;
            text-align: right;
        }
        .ipfs-gateway-status {
            margin-left: 10px;
            width: 40px;
            text-align: center;
        }
        .ipfs-gateway-status.success {
            color: #4caf50;
        }
        .ipfs-gateway-status.fail {
            color: #f44336;
        }
        .ipfs-speed-test-progress {
            height: 4px;
            background-color: #eee;
            margin-top: 5px;
            margin-bottom: 5px;
            border-radius: 2px;
            overflow: hidden;
            display: none;
        }
        .ipfs-speed-test-progress-bar {
            height: 100%;
            background-color: #4a90e2;
            width: 0%;
            transition: width 0.3s;
        }
        .ipfs-speed-test-info {
            font-size: 14px;
            color: #666;
            margin-top: -10px;
            margin-bottom: 5px;
            display: none;
            height: 10px;  /* 添加固定高度 */
        }
        /* 修改链接预览区域CSS以支持横向滚动 */
        .ipfs-link-preview {
            padding: 10px 15px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background-color: #f5f5f5;
            margin-top: -5px;
            margin-bottom: 5px;
            white-space: nowrap;      /* 防止文本换行 */
            overflow-x: auto;         /* 添加横向滚动条 */
            overflow-y: hidden;       /* 隐藏垂直滚动条 */
            max-width: 100%;          /* 限制最大宽度 */
            
            /* 提升用户体验的额外样式 */
            scrollbar-width: thin;    /* Firefox中使用细滚动条 */
            scrollbar-color: #ccc transparent; /* Firefox中设置滚动条颜色 */
        }
        
        /* 为Webkit浏览器(Chrome、Safari等)定制滚动条样式 */
        .ipfs-link-preview::-webkit-scrollbar {
            height: 8px;              /* 滚动条高度 */
        }
        
        .ipfs-link-preview::-webkit-scrollbar-track {
            background: transparent;  /* 滚动条轨道背景 */
        }
        
        .ipfs-link-preview::-webkit-scrollbar-thumb {
            background-color: #ccc;   /* 滚动条颜色 */
            border-radius: 4px;       /* 滚动条圆角 */
        }
        
        /* 改进支持手机触摸滚动 */
        @media (pointer: coarse) {
            .ipfs-link-preview {
                -webkit-overflow-scrolling: touch; /* 在iOS上启用惯性滚动 */
                padding-bottom: 15px;              /* 在触摸设备上增加一些额外的空间 */
            }
        }

        .ipfs-button-group {
            display: flex;
            justify-content: space-between;
            gap: 10px;
        }
        .ipfs-button {
            padding: 8px 15px;
            border-radius: 4px;
            border: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
        }
        .ipfs-primary-button {
            background-color: #4a90e2;
            color: white;
        }
        .ipfs-primary-button:hover {
            background-color: #357abd;
        }
        .ipfs-secondary-button {
            background-color: #f0f0f0;
            color: #333;
        }
        .ipfs-secondary-button:hover {
            background-color: #e0e0e0;
        }
        .ipfs-danger-button {
            background-color: #f5f5f5;
            color: #d32f2f;
        }
        .ipfs-danger-button:hover {
            background-color: #fbe9e7;
        }
        
        /* 网关管理窗口样式 */
        .ipfs-gateway-manager {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 500px;
            max-width: 90vw;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10002;
            padding: 20px;
            display: flex;
            flex-direction: column;
        }
        
        /* 网关管理窗口标题栏样式 */
        .ipfs-gateway-manager-title {
            font-size: 22px;
            font-weight: bold;
            margin-top: -5px;
            margin-bottom: 15px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move; /* 显示拖动光标 */
            user-select: none; /* 防止文本被选中 */
        }

        .ipfs-gateway-manager-close {
            cursor: pointer;
            font-size: 24px;
            color: #666;
        }
        .ipfs-gateway-manager textarea {
            width: 100%;
            height: 150px;
            margin-bottom: 15px;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            resize: vertical;
            font-family: monospace;
        }
        .ipfs-gateway-manager-help {
            font-size: 13px;
            color: #666;
            margin-bottom: 15px;
        }
        .ipfs-selected-cid-box {
            padding: 10px 15px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background-color: #f8f8f8;
            word-break: break-all;
            margin-bottom: 5px;
            display: flex;
            align-items: center;
        }
        .ipfs-selected-cid-label {
            font-weight: bold;
            margin-right: 5px;
            white-space: nowrap;
        }
        .ipfs-selected-cid-input {
            flex: 1;
            border: 1px solid #ddd;
            border-radius: 3px;
            padding: 5px 8px;
            font-family: monospace;
            font-size: 13px;
            background-color: white;
        }
        .ipfs-filename-input {
            flex: 1;
            border: 1px solid #ddd;
            border-radius: 3px;
            padding: 5px 8px;
            font-family: monospace;
            font-size: 13px;
            background-color: white;
        }
    `);

    // 创建悬停按钮 UI
    const copyBtnGroup = document.createElement('div');
    copyBtnGroup.className = 'ipfs-copy-btn-group';
    document.body.appendChild(copyBtnGroup);

    const copyBtn = document.createElement('div');
    copyBtn.className = 'ipfs-copy-btn';
    copyBtnGroup.appendChild(copyBtn);

    const copyLinkBtn = document.createElement('div');
    copyLinkBtn.className = 'ipfs-copy-btn';
    copyBtnGroup.appendChild(copyLinkBtn);

    //// 添加测速按钮:
    const speedTestBtn = document.createElement('div');
    speedTestBtn.className = 'ipfs-copy-btn';
    speedTestBtn.textContent = '网关测速';
    copyBtnGroup.appendChild(speedTestBtn);    

    // 创建右下角批量复制浮窗 UI
    const batchButtonsContainer = document.createElement('div');
    batchButtonsContainer.className = 'ipfs-batch-buttons';

    if (localStorage.getItem('ipfsCopyHelperDefaultCollapsed') === 'true') { // 根据默认设置决定是否添加 collapsed 类
        batchButtonsContainer.classList.add('collapsed');
    }
    document.body.appendChild(batchButtonsContainer);

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'ipfs-toggle-btn';
    toggleBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
    `;
    batchButtonsContainer.appendChild(toggleBtn);

    const batchCopyBtn = document.createElement('div');
    batchCopyBtn.className = 'ipfs-batch-btn';
    batchCopyBtn.innerHTML = '批量复制 CID <span class="ipfs-copy-count">0</span>';
    batchButtonsContainer.appendChild(batchCopyBtn);

    const batchFilenameBtn = document.createElement('div');
    batchFilenameBtn.className = 'ipfs-batch-btn';
    batchFilenameBtn.innerHTML = '批量复制文件名 <span class="ipfs-copy-count">0</span>';
    batchButtonsContainer.appendChild(batchFilenameBtn);

    const batchDownloadBtn = document.createElement('div');
    batchDownloadBtn.className = 'ipfs-batch-btn';
    batchDownloadBtn.innerHTML = '批量复制下载链接 <span class="ipfs-copy-count">0</span>';
    batchButtonsContainer.appendChild(batchDownloadBtn);

    // 定义一个全局变量来存储showSpeedTestWindow函数的引用
    let globalShowSpeedTestWindow = null;








    //// 2. 提取CID及页面扫描 ////

    // CID 正则表达式模式
    const CID_PATTERNS = [
        /\b(baf[yk][a-zA-Z0-9]{55})\b/i,    // IPFS CID v1
        /\b(Qm[a-zA-Z0-9]{44})\b/i,         // IPFS CID v0
        /\b(k51[a-zA-Z0-9]{59})\b/i         // IPNS Key
    ];

    function extractCID(input) {
        try {
            // 定义要排除的 CID
            const excludedCIDs = [
                'bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354',
                'QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'
            ];

            let extractedCID = null;

            // 如果输入看起来像是URL，进行URL解析
            if (input.includes('://') || input.startsWith('//')) {
                const urlObj = new URL(input);

                // 匹配子域名形式
                const subdomain = urlObj.hostname.split('.')[0];
                if (subdomain.match(/^(baf[yk][a-zA-Z0-9]{55}|Qm[a-zA-Z0-9]{44})$/i)) {
                    extractedCID = subdomain;
                }

                // 匹配 IPNS key
                if (subdomain.match(/^k51[a-zA-Z0-9]{59}$/i)) {
                    extractedCID = subdomain;
                }

                // 匹配路径形式
                const ipfsMatch = urlObj.pathname.match(/\/ipfs\/(baf[yk][a-zA-Z0-9]{55}|Qm[a-zA-Z0-9]{44})/i);
                if (ipfsMatch) {
                    extractedCID = ipfsMatch[1];
                }

                // 匹配 IPNS 路径
                const ipnsMatch = urlObj.pathname.match(/\/ipns\/(k51[a-zA-Z0-9]{59})/i);
                if (ipnsMatch) {
                    extractedCID = ipnsMatch[1];
                }
            } else {
                // 直接尝试匹配CID格式
                const cidMatch = input.match(/^(baf[yk][a-zA-Z0-9]{55}|Qm[a-zA-Z0-9]{44}|k51[a-zA-Z0-9]{59})$/i);
                if (cidMatch) {
                    extractedCID = cidMatch[1];
                }
            }

            // 检查是否为排除的 CID
            if (extractedCID && excludedCIDs.includes(extractedCID.toLowerCase())) {
                return null;
            }

            return extractedCID;
        } catch (e) {
            console.error('CID提取错误:', e);
            return null;
        }
    }

    // 判断是否为IPFS文件夹浏览页面
    function isIPFSBrowsingPage(url) {
        try {
            const urlObj = new URL(url);

            // 检查子域名形式（支持 .ipfs. 和 .eth. 形式）
            const hostParts = urlObj.hostname.split('.');
            if (hostParts.length >= 3) {
                const possibleCid = hostParts[0];
                // 如果子域名是有效的 CID
                if (extractCID(possibleCid)) {
                    // 检查是否包含 .ipfs. 或 .eth.
                    const isIpfsDomain = hostParts.some((part, index) =>
                        index < hostParts.length - 1 &&
                        (part === 'ipfs' || part === 'eth')
                    );
                    // 如果是子域名形式，且路径长度大于1（不只是根路径），则认为是浏览页面
                    if (isIpfsDomain && urlObj.pathname.length > 1) {
                        return true;
                    }
                }
            }

            // 检查路径形式
            if (!urlObj.pathname.includes('/ipfs/')) {
                return false;
            }

            // 对于 Web UI 的特殊处理
            if (urlObj.hash && urlObj.hash.includes('/files')) {
                return false;
            }

            // 普通文件浏览页面检查
            const parts = urlObj.pathname.split('/');
            return parts.length > 3;

        } catch (e) {
            console.error('URL解析错误:', e);
            return false;
        }
    }

    // 扫描页面中纯文本节点的函数
    function scanTextNodes(node) {
        // 首先检查是否在排除列表中
        if (isExcludedPage()) {
            return;
        }

        if (node.nodeType === Node.TEXT_NODE) {
            let hasMatch = false;
            let matches = [];

            // 收集所有匹配
            for (const pattern of CID_PATTERNS) {
                const patternMatches = [...node.textContent.matchAll(new RegExp(pattern, 'g'))];
                if (patternMatches.length > 0) {
                    matches = matches.concat(patternMatches);
                    hasMatch = true;
                }
            }

            if (hasMatch) {
                const container = document.createElement('span');
                container.style.position = 'relative';
                container.textContent = node.textContent;

                // 将匹配的 CID 添加到 linkInfo
                matches.forEach(match => {
                    const cid = match[0];
                    const type = cid.startsWith('k51') ? 'IPNS Key' : 'IPFS CID';
                    // 只有当这个 CID 还不存在时才添加
                    if (!linkInfo.has(cid)) {
                        linkInfo.set(cid, {
                            type: type,
                            url: null,
                            text: cid,
                            filename: null,
                            isLink: false // 标记这是文本
                        });
                    }

                    // 为每个CID创建一个内部span
                    const cidSpan = document.createElement('span');
                    cidSpan.style.position = 'relative';
                    cidSpan.textContent = cid;
                    cidSpan.dataset.cid = cid;
                    cidSpan.dataset.type = type;

                    // 替换原文本中的CID
                    const textBefore = container.textContent.substring(0, match.index);
                    const textAfter = container.textContent.substring(match.index + cid.length);
                    container.textContent = '';
                    if (textBefore) container.appendChild(document.createTextNode(textBefore));
                    container.appendChild(cidSpan);
                    if (textAfter) container.appendChild(document.createTextNode(textAfter));
                });

                // 添加鼠标事件监听器
                container.addEventListener('mouseover', function(e) {
                    const target = e.target;
                    if (target.dataset && target.dataset.cid) {
                        const rect = target.getBoundingClientRect();
                        showCopyButton(
                            rect.left + (rect.width / 2),
                            rect.bottom,
                            target.dataset.cid,
                            target.dataset.type
                        );
                    }
                });

                node.parentNode.replaceChild(container, node);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE &&
                   !['SCRIPT', 'STYLE', 'TEXTAREA', 'A'].includes(node.tagName)) {
            Array.from(node.childNodes).forEach(scanTextNodes);
        }
    }

    // 扫描页面超链接的函数
    function scanPageForLinks() {
        // 首先检查是否在排除列表中
        if (isExcludedPage()) {
            console.log('当前页面在排除列表中，停止扫描');
            // 清理已有的批量按钮
            batchButtonsContainer.classList.remove('visible');
            return;
        }

        linkInfo.clear();

        // 先扫描文本节点，确保文本 CID 在后面
        scanTextNodes(document.body);

        // 再扫描链接
        const currentPageCID = extractCID(window.location.href);
        const currentPageBase = window.location.origin + window.location.pathname.split('/').slice(0, -1).join('/');

        const links = document.getElementsByTagName('a');
        for (const link of links) {
            const cid = extractCID(link.href);
            if (!cid) continue; // 只过滤无效的 CID，不再过滤当前页面的 CID

            try {
                const linkUrl = new URL(link.href);
                const linkBase = linkUrl.origin + linkUrl.pathname.split('/').slice(0, -1).join('/');
                if (linkBase === currentPageBase) continue;

                const existingInfo = linkInfo.get(cid);
                const filename = extractFilename(link.href, link.textContent);

                linkInfo.set(cid, {
                    type: detectLinkType(link.href),
                    url: link.href,
                    text: link.textContent.trim(),
                    filename: filename,
                    isLink: true
                });
            } catch (e) {
                console.error('URL解析错误:', e);
            }
        }

        updateBatchButtons();
    }

    // 提取文件名的函数
    function extractFilename(url, linkText) {
        const filenameParam = new URL(url).searchParams.get('filename');
        if (filenameParam) {
            return decodeURIComponent(filenameParam);
        }

        const pathParts = new URL(url).pathname.split('/');
        const lastPart = pathParts[pathParts.length - 1];

        if (lastPart && !lastPart.match(/^(Qm[a-zA-Z0-9]{44}|baf[a-zA-Z0-9]+|k51[a-zA-Z0-9]+)$/i)) {
            return decodeURIComponent(lastPart);
        }

        if (linkText && linkText.trim() && !linkText.includes('...')) {
            return linkText.trim();
        }

        return null;
    }

    // 探测超链接IPFS类型的函数
    function detectLinkType(url) {
        try {
            const urlObj = new URL(url);
            const subdomain = urlObj.hostname.split('.')[0];
            if (subdomain.match(/^(k51[a-zA-Z0-9]{1,})$/i)) {
                return 'IPNS Key';
            }
            if (subdomain.match(/^(baf[a-zA-Z0-9]{1,}|Qm[a-zA-Z0-9]{44})$/i)) {
                return 'IPFS CID';
            }

            if (url.includes('/ipns/') || url.match(/k51[a-zA-Z0-9]{1,}/i)) {
                return 'IPNS Key';
            }
            return 'IPFS CID';
        } catch (e) {
            console.error('URL解析错误:', e);
            return 'IPFS CID';
        }
    }

    // 复制某个内容到剪贴板的函数
    function copyToClipboard(text, button) {
        const originalText = button.textContent;

        // 创建后备复制方案
        function fallbackCopy() {
            try {
                const textArea = document.createElement('textarea');
                textArea.value = text;

                // 将文本区域放在不可见位置
                textArea.style.position = 'fixed';
                textArea.style.left = '-9999px';
                textArea.style.top = '-9999px';
                document.body.appendChild(textArea);

                // 选择并复制文本
                textArea.select();
                const success = document.execCommand('copy');
                document.body.removeChild(textArea);

                if (success) {
                    button.textContent = '已复制！';
                } else {
                    button.textContent = '复制失败';
                }
            } catch (err) {
                console.error('复制失败:', err);
                button.textContent = '复制失败';
            }

            setTimeout(() => {
                button.textContent = originalText;
            }, 1000);
        }

        // 优先使用 Clipboard API，如果不支持则使用后备方案
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(text)
                .then(() => {
                    button.textContent = '已复制！';
                    setTimeout(() => {
                        button.textContent = originalText;
                    }, 1000);
                })
                .catch(err => {
                    console.warn('Clipboard API 失败，使用后备方案:', err);
                    fallbackCopy();
                });
        } else {
            console.warn('Clipboard API 不可用，使用后备方案');
            fallbackCopy();
        }
    }

    // 批量复制函数
    function batchCopyItems(type, button) {
        const validEntries = getValidEntries();
        const totalCount = validEntries.length;

        if (totalCount === 0) {
            const originalText = button.innerHTML;
            button.textContent = '没有可用的项目';
            setTimeout(() => {
                button.innerHTML = originalText;
            }, 1000);
            return;
        }
        const items = validEntries.map(([cid, info]) => {
            let filenameFromText = null;
            if (!info.isLink && info.text) {
                const cidIndex = info.text.indexOf(cid);
                if (cidIndex !== -1) {
                    const afterCid = info.text.slice(cidIndex + cid.length);
                    const filenameMatch = afterCid.match(/[?&]filename=([^&\n\r]+)/);
                    if (filenameMatch) {
                        try {
                            filenameFromText = decodeURIComponent(filenameMatch[1]);
                        } catch (e) {
                            console.error('文件名解码错误:', e);
                        }
                    }
                }
            }

            switch (type) {
                case 'cid':
                    return cid;

                case 'filename':
                    if (info.filename && !info.filename.includes('/ipfs/')) {
                        return info.filename;
                    }
                    if (filenameFromText) {
                        return filenameFromText;
                    }
                    return cid;

                case 'url':
                    if (info.isLink && info.url) {
                        let url = info.url;
                        const validFilename = info.filename && !info.filename.includes('/ipfs/')
                            ? info.filename
                            : (filenameFromText || cid);
                            
                        // 实现编码修复：先解码再编码
                        let decodedFilename;
                        try {
                            decodedFilename = decodeURIComponent(validFilename);
                        } catch (e) {
                            decodedFilename = validFilename;
                        }
                        const encodedFilename = encodeURIComponent(decodedFilename);
                            
                        if (!url.includes('?filename=')) {
                            url += (url.includes('?') ? '&' : '?') + 'filename=' + encodedFilename;
                        } else {
                            // 如果URL已经包含filename参数，但可能有编码问题，尝试修复它
                            url = url.replace(/(\?|&)filename=([^&]*)/, 
                                    (match, prefix, oldFilename) => `${prefix}filename=${encodedFilename}`);
                        }
                        return url;
                    }
                    const gateway = getGateway();
                    const filename = filenameFromText || cid;
                    
                    // 编码修复：先解码再编码
                    let decodedFilename;
                    try {
                        decodedFilename = decodeURIComponent(filename);
                    } catch (e) {
                        decodedFilename = filename;
                    }
                    const encodedFilename = encodeURIComponent(decodedFilename);
                    
                    // 修正参数名：filenames → filename
                    return `${gateway}/ipfs/${cid}?filename=${encodedFilename}`;
                

                default:
                    return cid;
            }
        });

        const formattedItems = items.join('\n');
        copyToClipboard(formattedItems, button);
    }

    function getValidEntries() {
        // 定义要排除的 CID 列表
        const excludedCIDs = [
            'bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354',
            'QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'
        ];
        const currentPageCID = extractCID(window.location.href);

        // 获取并过滤条目
        return Array.from(linkInfo.entries())
            .filter(([cid]) => {
                // 排除当前页面的 CID
                if (cid === currentPageCID) return false;

                // 排除空文件夹 CID（根据CID版本选择比较方式）
                return !excludedCIDs.some(excluded => {
                    // CID v0 (Qm开头) - 大小写敏感
                    if (excluded.startsWith('Qm')) {
                        return excluded === cid;
                    }
                    // CID v1 (baf开头) - 大小写不敏感
                    return excluded.toLowerCase() === cid.toLowerCase();
                });
            });
    }

    // 更新显示计数的函数
    function updateBatchButtons() {
        const validEntries = getValidEntries();
        const totalCount = validEntries.length;

        if (totalCount > 0) {
            batchButtonsContainer.classList.add('visible');
            
            // 更新批量复制CID按钮
            batchCopyBtn.style.display = 'block';
            batchCopyBtn.innerHTML = `批量复制CID <span class="ipfs-copy-count">${totalCount}</span>`;
            
            // 更新批量复制文件名按钮
            batchFilenameBtn.style.display = 'block';
            batchFilenameBtn.innerHTML = `批量复制文件名 <span class="ipfs-copy-count">${totalCount}</span>`;
            
            // 更新批量复制下载链接按钮
            batchDownloadBtn.style.display = 'block';
            batchDownloadBtn.innerHTML = `批量复制下载链接 <span class="ipfs-copy-count">${totalCount}</span>`;
        } else {
            batchButtonsContainer.classList.remove('visible');
            [batchCopyBtn, batchDownloadBtn, batchFilenameBtn].forEach(btn => {
                btn.style.display = 'none';
            });
        }
    }

    // 调用统一的复制处理函数
    function batchCopyCIDs() {
        batchCopyItems('cid', batchCopyBtn);
    }

    function batchCopyFilenames() {
        batchCopyItems('filename', batchFilenameBtn);
    }

    function batchCopyDownloadLinks() {
        batchCopyItems('url', batchDownloadBtn);
    }

    // 显示复制按钮
    function showCopyButton(x, y, cid, type, isLink = false, url = null) {
        // 如果在排除列表中，不显示按钮
        if (isExcludedPage()) {
            return;
        }
    
        // 清除可能存在的定时器
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
        if (showTimeout) {
            clearTimeout(showTimeout);
            showTimeout = null;
        }
    
        // 保存CID和相关信息到按钮组，供网关测速按钮使用
        copyBtnGroup.dataset.lastCid = cid;
        copyBtnGroup.dataset.lastType = type;
        
        // 保存URL信息，如果可用
        if (url) {
            copyBtnGroup.dataset.lastUrl = url;
        } else {
            delete copyBtnGroup.dataset.lastUrl;
        }
    
        copyBtnGroup.style.display = 'block';
        copyBtnGroup.style.top = `${y + window.scrollY + 5}px`;
        copyBtnGroup.style.left = `${x + window.scrollX}px`;
    
        copyBtn.textContent = `复制 ${type}`;
        copyBtn.onclick = () => {
            copyToClipboard(cid, copyBtn);
        };
    
        // 只为纯文本CID显示下载链接按钮
        if (!isLink) {
            copyLinkBtn.style.display = 'inline-block';
            copyLinkBtn.textContent = '复制下载链接';
            copyLinkBtn.onclick = () => {
                const gateway = getGateway();
                const downloadLink = `${gateway}/ipfs/${cid}`;
                copyToClipboard(downloadLink, copyLinkBtn);
            };
        } else {
            copyLinkBtn.style.display = 'none';
        }
        
        // 显示网关测速按钮
        speedTestBtn.style.display = 'inline-block';
        speedTestBtn.textContent = '网关测速';
    }

    // 修改隐藏按钮函数
    function hideButton() {
        // 如果在排除列表中，确保按钮隐藏
        if (isExcludedPage()) {
            copyBtnGroup.style.display = 'none';
            return;
        }

        if (hideTimeout) {
            clearTimeout(hideTimeout);
        }
        if (showTimeout) {
            clearTimeout(showTimeout);
        }

        hideTimeout = setTimeout(() => {
            if (!isButtonHovered && !currentHoveredElement) {
                copyBtnGroup.style.display = 'none';
            }
        }, 150);
    }

    let scanTimeout;
    function initPageScan() {
        if (isExcludedPage()) {
            console.log('当前页面在排除列表中，不初始化扫描');
            // 确保批量按钮被隐藏
            batchButtonsContainer.classList.remove('visible');
            return;
        }

        if (scanTimeout) {
            clearTimeout(scanTimeout);
        }
        scanTimeout = setTimeout(scanPageForLinks, 1000);
    }









    //// 3. 鼠标悬停事件处理 ////

    // 初始化状态变量
    let currentHoveredElement = null;
    let currentHoveredLink = null;  // 添加这个变量声明
    let isButtonHovered = false;
    let hideTimeout = null;
    let showTimeout = null;

    // 统一处理文本和链接的悬停
    function handleElementHover(element, cid, type, isLink = false, url = null) {
        // 首先检查是否在排除列表中
        if (isExcludedPage()) {
            return;
        }
    
        if (currentHoveredElement === element) return;  // 如果是同一个元素，不重复处理
    
        currentHoveredElement = element;
        const rect = element.getBoundingClientRect();
    
        // 使用延时显示，避免快速划过时的闪烁
        if (showTimeout) {
            clearTimeout(showTimeout);
        }
        showTimeout = setTimeout(() => {
            showCopyButton(
                rect.left + (rect.width / 2),
                rect.bottom,
                cid,
                type,
                isLink,
                url
            );
        }, 50);
    }

    // mouseover 事件处理
    document.addEventListener('mouseover', function(e) {
        // 如果在排除列表中，直接返回
        if (isExcludedPage()) {
            return;
        }
    
        // 处理链接
        const link = e.target.closest('a');
        if (link) {
            const href = link.href;
            if (!href) return;
    
            const linkCID = extractCID(href);
            if (!linkCID) return;
    
            const shouldShow = isIPFSBrowsingPage(window.location.href) ||
                            linkCID !== extractCID(window.location.href);
    
            if (shouldShow) {
                handleElementHover(link, linkCID, detectLinkType(href), true, href);
                return;
            }
        }
    
        // 处理文本节点中的 CID
        const cidSpan = e.target.closest('[data-cid]');
        if (cidSpan && cidSpan.dataset.cid) {
            handleElementHover(cidSpan, cidSpan.dataset.cid, cidSpan.dataset.type, false);
            return;
        }
    });

    // mousemove 事件处理
    document.addEventListener('mousemove', function(e) {
        const overLink = e.target.closest('a');
        const overButton = e.target.closest('.ipfs-copy-btn-group');

        if (!overLink && !overButton) {
            currentHoveredLink = null;
            isButtonHovered = false;
            hideButton();
        }
    });

    // mouseout 事件处理
    document.addEventListener('mouseout', function(e) {
        const relatedTarget = e.relatedTarget;
        if (!relatedTarget ||
            (!relatedTarget.closest('.ipfs-copy-btn-group') &&
            !relatedTarget.dataset?.cid &&
            !relatedTarget.closest('a'))) {
            currentHoveredElement = null;
            currentHoveredLink = null;
            hideButton();
        }
    });

    // 按钮组的事件监听
    copyBtnGroup.addEventListener('mouseover', function() {
        if (isExcludedPage()) {
            return;
        }
        isButtonHovered = true;
        if (hideTimeout) {
            clearTimeout(hideTimeout);
        }
        if (showTimeout) {
            clearTimeout(showTimeout);
        }
    });

    copyBtnGroup.addEventListener('mouseout', function(e) {
        if (isExcludedPage()) {
            return;
        }
        isButtonHovered = false;
        const relatedTarget = e.relatedTarget;
        if (!relatedTarget ||
            (!relatedTarget.dataset?.cid &&
            !relatedTarget.closest('a') &&
            !relatedTarget.closest('.ipfs-copy-btn-group'))) {
            hideButton();
        }
    });

    // observer 的设置，观察DOM变化
    let scanScheduled = false;
    const observer = new MutationObserver(() => {
        if (!scanScheduled) {
            scanScheduled = true;
            setTimeout(() => {
                initPageScan();
                scanScheduled = false;
            }, 1500); // 在1500ms后再执行扫描，避免频繁触发
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });











    //// 4. 网关测速逻辑实现 ////
    
    // 创建测速结果窗口
    const speedTestWindow = document.createElement('div');
    speedTestWindow.className = 'ipfs-speed-test-window';
    speedTestWindow.style.display = 'none';
    document.body.appendChild(speedTestWindow);

    // 创建网关管理窗口
    const gatewayManagerWindow = document.createElement('div');
    gatewayManagerWindow.className = 'ipfs-gateway-manager';
    gatewayManagerWindow.style.display = 'none';
    document.body.appendChild(gatewayManagerWindow);

    // 填充测速窗口内容
    speedTestWindow.innerHTML = `
        <div class="ipfs-speed-test-title">
            <span>IPFS 网关测速器</span>
            <span class="ipfs-speed-test-close">&times;</span>
        </div>
        <div class="ipfs-selected-cid-box">
            <span class="ipfs-selected-cid-label">当前选择CID/IPNS key (或手动输入)：</span>
            <input type="text" class="ipfs-selected-cid-input" placeholder="请输入CID或IPNS key">
        </div>
        <div class="ipfs-selected-cid-box">
            <span class="ipfs-selected-cid-label">文件名 (可选)：</span>
            <input type="text" class="ipfs-filename-input" placeholder="请输入或自动获取的文件名">
        </div>
        <div class="ipfs-speed-test-content">
            <div class="ipfs-speed-test-progress">
                <div class="ipfs-speed-test-progress-bar"></div>
            </div>
            <div class="ipfs-speed-test-info">正在测速中，请稍候...</div>
            <div class="ipfs-speed-test-results"></div>
            <div class="ipfs-link-preview"></div>
            <div class="ipfs-button-group">
                <button class="ipfs-button ipfs-primary-button ipfs-copy-link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    复制下载链接
                </button>
                <button class="ipfs-button ipfs-primary-button ipfs-open-link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                    在新标签页打开
                </button>
            </div>
            <div class="ipfs-button-group">
                <button class="ipfs-button ipfs-secondary-button ipfs-start-test">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    开始测速
                </button>
                <button class="ipfs-button ipfs-secondary-button ipfs-manage-gateways">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                    管理网关
                </button>
                <button class="ipfs-button ipfs-danger-button ipfs-clear-results">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    清除测速结果
                </button>
            </div>
        </div>
    `;

    // 填充网关管理窗口内容
    gatewayManagerWindow.innerHTML = `
        <div class="ipfs-gateway-manager-title">
            <span>管理测速网关</span>
            <span class="ipfs-gateway-manager-close">&times;</span>
        </div>
        <div class="ipfs-gateway-manager-help">
            每行输入一个网关地址，必须以 https:// 开头。<br>
            例如：https://ipfs.io
        </div>
        <textarea class="ipfs-gateway-list"></textarea>
        <div class="ipfs-button-group">
            <button class="ipfs-button ipfs-secondary-button ipfs-reset-gateways">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M23 4v6h-6"></path>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                重置为默认
            </button>
            <button class="ipfs-button ipfs-primary-button ipfs-save-gateways">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                保存修改
            </button>
        </div>
    `;
    // 网关测速功能
    function setupGatewaySpeedTest() {
        // 当前测试状态
        let currentCID = null;
        let currentType = null; // 'ipfs' 或 'ipns'
        let selectedGateway = null;
        let isTestRunning = false;
        let testResults = [];
        
        // 从存储中获取保存的测试结果和网关列表
        function getSavedTestResults() {
            return GM_getValue('ipfsGatewayTestResults', []);
        }
        
        function saveTestResults(results) {
            GM_setValue('ipfsGatewayTestResults', results);
        }
        
        function getGatewayList() {
            return GM_getValue('ipfsGatewayList', DEFAULT_GATEWAYS);
        }
        
        function saveGatewayList(gateways) {
            GM_setValue('ipfsGatewayList', gateways);
        }

        // 添加拖动功能
        function makeDraggable(element) {
            const titleBar = element.querySelector('.ipfs-speed-test-title, .ipfs-gateway-manager-title');
            let isDragging = false;
            let offsetX, offsetY;
            
            // 鼠标按下事件
            titleBar.addEventListener('mousedown', (e) => {
                // 只有点击标题栏区域才启用拖动
                if (e.target.classList.contains('ipfs-speed-test-close') || 
                    e.target.classList.contains('ipfs-gateway-manager-close')) {
                    return; // 如果点击的是关闭按钮，不启用拖动
                }
                
                isDragging = true;
                
                // 计算鼠标在窗口中的相对位置
                const rect = element.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                
                // 移除 transform 属性，改为使用 top 和 left 定位
                element.style.transform = 'none';
                element.style.top = rect.top + 'px';
                element.style.left = rect.left + 'px';
                
                // 修改鼠标样式
                document.body.style.cursor = 'move';
                
                // 防止事件冒泡和默认行为
                e.preventDefault();
                e.stopPropagation();
            });
            
            // 鼠标移动事件
            const mouseMoveHandler = (e) => {
                if (!isDragging) return;
                
                // 计算新位置
                element.style.top = (e.clientY - offsetY) + 'px';
                element.style.left = (e.clientX - offsetX) + 'px';
                
                // 防止事件冒泡和默认行为
                e.preventDefault();
            };
            
            // 鼠标松开事件
            const mouseUpHandler = () => {
                if (isDragging) {
                    isDragging = false;
                    document.body.style.cursor = 'default';
                }
            };
            
            // 使用 document 级别的事件监听，确保即使鼠标移出窗口也能继续拖动
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
            
            // 返回清理函数，用于移除事件监听器
            return () => {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            };
        }
        
        // 应用拖动功能到测速窗口和网关管理窗口
        makeDraggable(speedTestWindow);
        makeDraggable(gatewayManagerWindow);
        
        // 显示网关管理窗口函数修改
        function showGatewayManager() {
            const gatewayList = getGatewayList();
            const textarea = gatewayManagerWindow.querySelector('.ipfs-gateway-list');
            textarea.value = gatewayList.join('\n');
            
            // 重置窗口位置到屏幕中央
            gatewayManagerWindow.style.display = 'block';
            gatewayManagerWindow.style.top = '50%';
            gatewayManagerWindow.style.left = '50%';
            gatewayManagerWindow.style.transform = 'translate(-50%, -50%)';
        }
        
        // 显示测速窗口
        function showSpeedTestWindow(cid, type, filename) {
            // 如果传入了CID，则使用传入的值，否则保持当前值
            if (cid) {
                currentCID = cid;
                currentType = (type === 'IPNS Key') ? 'ipns' : 'ipfs';
            }
            
            // 更新输入框的值
            if (cidInputElement && currentCID) {
                cidInputElement.value = currentCID;
            }
            
            // 更新文件名输入框的值
            const filenameInputElement = speedTestWindow.querySelector('.ipfs-filename-input');
            if (filenameInputElement && filename) {
                filenameInputElement.value = filename;
            } else if (filenameInputElement) {
                filenameInputElement.value = ''; // 清空之前的值
            }
            
            // 加载保存的测试结果
            testResults = getSavedTestResults();
            
            // 重置窗口位置到屏幕中央
            speedTestWindow.style.display = 'block';
            speedTestWindow.style.top = '50%';
            speedTestWindow.style.left = '50%';
            speedTestWindow.style.transform = 'translate(-50%, -50%)';
            
            updateResultsDisplay();
            updateLinkPreview();
        }

        // 监听CID输入框变化
        const cidInputElement = speedTestWindow.querySelector('.ipfs-selected-cid-input');
        if (cidInputElement) {
            cidInputElement.addEventListener('change', function() {
                const newCID = this.value.trim();
                if (newCID) {
                    // 自动检测是否为IPNS key
                    currentCID = newCID;
                    currentType = newCID.startsWith('k51') ? 'ipns' : 'ipfs';
                    
                    // 清除之前的测试结果，因为CID已经变化
                    testResults = [];
                    selectedGateway = null;
                    updateResultsDisplay();
                    updateLinkPreview();
                }
            });
        }
        
        // 测速结果显示函数
        function updateResultsDisplay() {
            const resultsElement = speedTestWindow.querySelector('.ipfs-speed-test-results');
            
            if (testResults.length === 0) {
                resultsElement.innerHTML = '<div style="padding: 15px; text-align: center; color: #666;">暂无测速结果，请点击"开始测速"按钮</div>';
                return;
            }
            
            // 首先按照可访问性分组，然后按照响应时间排序
            const accessibleGateways = testResults.filter(result => result.status === 'success')
                                                .sort((a, b) => a.ping - b.ping);
            
            const inaccessibleGateways = testResults.filter(result => result.status !== 'success')
                                                .sort((a, b) => a.ping - b.ping);
            
            // 合并两个数组，确保可访问的网关在上方
            const sortedResults = [...accessibleGateways, ...inaccessibleGateways];
            
            // 如果没有选中的网关，默认选择第一个可访问的网关
            if (!selectedGateway && accessibleGateways.length > 0) {
                selectedGateway = accessibleGateways[0].gateway;
            }
            
            let html = '';
            for (const result of sortedResults) {
                const isSelected = result.gateway === selectedGateway;
                html += `
                    <div class="ipfs-gateway-item ${isSelected ? 'selected' : ''}" data-gateway="${result.gateway}">
                        <div class="ipfs-gateway-url">${result.gateway}</div>
                        <div class="ipfs-gateway-ping">${result.ping} ms</div>
                        <div class="ipfs-gateway-status ${result.status === 'success' ? 'success' : 'fail'}">
                            ${result.status === 'success' ? '✓' : '✗'}
                        </div>
                    </div>
                `;
            }
            resultsElement.innerHTML = html;
            
            // 添加点击事件选择网关
            const gatewayItems = resultsElement.querySelectorAll('.ipfs-gateway-item');
            gatewayItems.forEach(item => {
                item.addEventListener('click', () => {
                    selectedGateway = item.dataset.gateway;
                    gatewayItems.forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                    updateLinkPreview();
                });
            });
        }
        
        // 更新链接预览
        function updateLinkPreview() {
            const linkPreview = speedTestWindow.querySelector('.ipfs-link-preview');
            
            if (!selectedGateway || !currentCID) {
                linkPreview.textContent = '测速完成后单击以选择网关';
                return;
            }
            
            // 获取文件名
            const filenameInputElement = speedTestWindow.querySelector('.ipfs-filename-input');
            let filename = filenameInputElement ? filenameInputElement.value.trim() : '';
            
            // 构建基本链接
            let link = `${selectedGateway}/${currentType}/${currentCID}`;
            
            // 如果有文件名，添加到链接中
            if (filename) {
                // 处理文件名编码，去除多余的25占位符
                const encodedFilename = encodeURIComponent(filename).replace(/%25/g, '%');
                link += `?filename=${encodedFilename}`;
            }
            
            linkPreview.textContent = link;
            
            // 同时更新复制链接和打开链接按钮的行为
            const copyLinkBtn = speedTestWindow.querySelector('.ipfs-copy-link');
            const openLinkBtn = speedTestWindow.querySelector('.ipfs-open-link');
            
            copyLinkBtn.onclick = function() {
                copyToClipboard(link, copyLinkBtn);
            };
            
            openLinkBtn.onclick = function() {
                window.open(link, '_blank');
            };
        }
        
        // 执行网关测速
        async function runSpeedTest() {
            if (isTestRunning || !currentCID) return;
            
            isTestRunning = true;
            testResults = [];
            selectedGateway = null;
            
            const gateways = getGatewayList();
            const progressBar = speedTestWindow.querySelector('.ipfs-speed-test-progress');
            const progressBarInner = speedTestWindow.querySelector('.ipfs-speed-test-progress-bar');
            const infoText = speedTestWindow.querySelector('.ipfs-speed-test-info');
            
            progressBar.style.display = 'block';
            infoText.style.display = 'block';
            infoText.textContent = '正在测速中，请稍候...';
            
            // 并发测试多个网关
            const MAX_CONCURRENT = 50;
            let completedCount = 0;
            
            for (let i = 0; i < gateways.length; i += MAX_CONCURRENT) {
                const batch = gateways.slice(i, i + MAX_CONCURRENT);
                const testPromises = batch.map(gateway => testGateway(gateway));
                
                await Promise.all(testPromises);
                
                completedCount += batch.length;
                const progress = (completedCount / gateways.length) * 100;
                progressBarInner.style.width = `${progress}%`;
                infoText.textContent = `正在测速中，已完成 ${completedCount}/${gateways.length}...`;
                
                // 更新显示
                updateResultsDisplay();
            }
            
            // 测试完成
            progressBar.style.display = 'none';
            infoText.style.display = 'none';
            updateResultsDisplay();
            updateLinkPreview();
            
            // 保存测速结果
            saveTestResults(testResults);
            
            isTestRunning = false;
        }
        
        // 测试单个网关速度 - 只测响应速度
        async function testGateway(gateway) {
            try {
                const startTime = performance.now();
                
                // 构建请求 URL
                const url = `${gateway}/${currentType}/${currentCID}`;
                
                // 使用 fetch 发起 HEAD 请求，仅测试响应速度
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
                
                const response = await fetch(url, {
                    method: 'HEAD', // 只请求头信息，不下载内容
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                // 计算响应时间
                const ping = Math.round(performance.now() - startTime);
                
                // 添加测试结果
                testResults.push({
                    gateway,
                    ping,
                    status: response.ok ? 'success' : 'fail'
                });
                
            } catch (error) {
                // 请求出错
                testResults.push({
                    gateway,
                    ping: 10000, // 默认最大值
                    status: 'fail'
                });
            }
        }
        
        // 修改悬停按钮组中的网关测速按钮
        speedTestBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            
            // 尝试获取CID和文件名信息
            let cid = null;
            let type = null;
            let filename = null;
            
            // 首先检查当前悬停的元素
            if (currentHoveredElement) {
                console.log('当前悬停元素:', currentHoveredElement);
                
                // 检查是否是带有cid数据属性的元素
                if (currentHoveredElement.dataset && currentHoveredElement.dataset.cid) {
                    cid = currentHoveredElement.dataset.cid;
                    type = currentHoveredElement.dataset.type;
                    
                    // 检查是否在文本内容中有文件名信息
                    const textContent = currentHoveredElement.textContent || '';
                    if (textContent.includes('filename=')) {
                        const filenameMatch = textContent.match(/[?&]filename=([^&\n\r]+)/);
                        if (filenameMatch) {
                            try {
                                filename = decodeURIComponent(filenameMatch[1]);
                                console.log('从文本内容提取的文件名:', filename);
                            } catch (e) {
                                console.error('文件名解码错误:', e);
                            }
                        }
                    }
                } 
                // 检查是否是链接元素或在链接内部
                else if (currentHoveredElement.tagName === 'A' || currentHoveredElement.closest('a')) {
                    const link = currentHoveredElement.tagName === 'A' ? 
                                currentHoveredElement : currentHoveredElement.closest('a');
                                
                    console.log('从链接中提取信息:', link.href);
                    
                    const linkCID = extractCID(link.href);
                    if (linkCID) {
                        cid = linkCID;
                        type = detectLinkType(link.href);
                        
                        // 尝试从链接中提取文件名 - 增强版
                        try {
                            // 首先尝试从URL参数获取
                            const url = new URL(link.href);
                            const filenameParam = url.searchParams.get('filename');
                            
                            if (filenameParam) {
                                try {
                                    filename = decodeURIComponent(filenameParam);
                                    console.log('从URL参数提取的文件名:', filename);
                                } catch (e) {
                                    filename = filenameParam;
                                    console.error('文件名解码错误:', e);
                                }
                            } 
                            // 然后尝试从URL路径获取
                            else {
                                const extractedFilename = extractFilename(link.href, link.textContent);
                                if (extractedFilename) {
                                    filename = extractedFilename;
                                    console.log('从URL路径或链接文本提取的文件名:', filename);
                                }
                            }
                            
                            // 最后，如果没有文件名，尝试使用链接的文本内容
                            if (!filename && link.textContent && link.textContent.trim() && 
                                !link.textContent.includes(cid) && !link.textContent.includes('...')) {
                                filename = link.textContent.trim();
                                console.log('使用链接文本作为文件名:', filename);
                            }
                        } catch (e) {
                            console.error('从链接提取文件名失败:', e);
                        }
                    }
                }
            }
            
            // 如果未从当前悬停元素获取CID，尝试从按钮组数据属性获取
            if (!cid && copyBtnGroup.dataset.lastCid) {
                cid = copyBtnGroup.dataset.lastCid;
                type = copyBtnGroup.dataset.lastType;
                console.log('从按钮组数据属性获取CID:', cid);
                
                // 尝试从复制按钮组数据属性获取更多信息
                if (copyBtnGroup.dataset.lastUrl) {
                    try {
                        const url = new URL(copyBtnGroup.dataset.lastUrl);
                        const filenameParam = url.searchParams.get('filename');
                        if (filenameParam) {
                            filename = decodeURIComponent(filenameParam);
                            console.log('从按钮组URL提取的文件名:', filename);
                        }
                    } catch (e) {
                        console.error('从按钮组URL提取文件名失败:', e);
                    }
                }
            }
            
            // 如果有CID，显示测速窗口
            if (cid) {
                console.log('打开测速窗口:', cid, type, filename);
                showSpeedTestWindow(cid, type, filename);
            } else {
                alert("无法识别当前内容的CID，请重新尝试");
            }
        });
        
        // 关闭测速窗口
        speedTestWindow.querySelector('.ipfs-speed-test-close').addEventListener('click', () => {
            speedTestWindow.style.display = 'none';
            isTestRunning = false;
        });
        
        // 开始测速按钮
        speedTestWindow.querySelector('.ipfs-start-test').addEventListener('click', () => {
            if (!isTestRunning) {
                runSpeedTest();
            }
        });
        
        // 复制下载链接按钮
        speedTestWindow.querySelector('.ipfs-copy-link').addEventListener('click', () => {
            const linkPreview = speedTestWindow.querySelector('.ipfs-link-preview');
            if (linkPreview.textContent && linkPreview.textContent !== '请先选择一个网关') {
                const copyButton = speedTestWindow.querySelector('.ipfs-copy-link');
                copyToClipboard(linkPreview.textContent, copyButton);
            }
        });
        
        // 在新标签页打开链接按钮
        speedTestWindow.querySelector('.ipfs-open-link').addEventListener('click', () => {
            const linkPreview = speedTestWindow.querySelector('.ipfs-link-preview');
            if (linkPreview.textContent && linkPreview.textContent !== '请先选择一个网关') {
                window.open(linkPreview.textContent, '_blank');
            }
        });
        
        // 清除测速结果按钮
        speedTestWindow.querySelector('.ipfs-clear-results').addEventListener('click', () => {
            testResults = [];
            selectedGateway = null;
            saveTestResults([]);
            updateResultsDisplay();
            updateLinkPreview();
        });
        
        // 管理网关按钮
        speedTestWindow.querySelector('.ipfs-manage-gateways').addEventListener('click', () => {
            showGatewayManager();
        });
        
        // 网关管理窗口
        function showGatewayManager() {
            const gatewayList = getGatewayList();
            const textarea = gatewayManagerWindow.querySelector('.ipfs-gateway-list');
            textarea.value = gatewayList.join('\n');
            gatewayManagerWindow.style.display = 'block';
        }
        
        // 关闭网关管理窗口
        gatewayManagerWindow.querySelector('.ipfs-gateway-manager-close').addEventListener('click', () => {
            gatewayManagerWindow.style.display = 'none';
        });
        
        // 重置网关列表
        gatewayManagerWindow.querySelector('.ipfs-reset-gateways').addEventListener('click', () => {
            const textarea = gatewayManagerWindow.querySelector('.ipfs-gateway-list');
            textarea.value = DEFAULT_GATEWAYS.join('\n');
        });
        
        // 保存网关列表
        gatewayManagerWindow.querySelector('.ipfs-save-gateways').addEventListener('click', () => {
            const textarea = gatewayManagerWindow.querySelector('.ipfs-gateway-list');
            const lines = textarea.value.split('\n').map(line => line.trim()).filter(line => line);
            
            // 验证网关格式
            const validGateways = [];
            const invalidGateways = [];
            
            for (const line of lines) {
                if (line.startsWith('https://')) {
                    validGateways.push(line.replace(/\/$/, '')); // 移除末尾斜杠
                } else {
                    invalidGateways.push(line);
                }
            }
            
            if (invalidGateways.length > 0) {
                alert(`以下网关格式无效 (必须以 https:// 开头):\n${invalidGateways.join('\n')}`);
                return;
            }
            
            saveGatewayList(validGateways);
            gatewayManagerWindow.style.display = 'none';
            
            // 清除之前的测速结果
            testResults = [];
            selectedGateway = null;
            saveTestResults([]);
            updateResultsDisplay();
            alert('网关列表已保存！');
        });

        // 将showSpeedTestWindow函数返回，以便可以全局访问
        return showSpeedTestWindow;
    }

    // 监听 IPFS 网关测速器 CID 输入框变化
    speedTestWindow.querySelector('.ipfs-selected-cid-input').addEventListener('change', function() {
        const newCID = this.value.trim();
        if (newCID) {
            // 自动检测是否为IPNS key
            currentCID = newCID;
            currentType = newCID.startsWith('k51') ? 'ipns' : 'ipfs';
            
            // 清除之前的测试结果，因为CID已经变化
            testResults = [];
            selectedGateway = null;
            updateResultsDisplay();
            updateLinkPreview();
        }
    });








    //// 5. 添加油猴菜单命令 GM_registerMenuCommand 部分 ////

    // 切换右下角浮窗默认展开/收起状态
    GM_registerMenuCommand('切换右下角浮窗默认展开/收起状态', () => {
        const defaultCollapsed = localStorage.getItem('ipfsCopyHelperDefaultCollapsed');
        const newDefault = defaultCollapsed === 'true' ? 'false' : 'true';
        localStorage.setItem('ipfsCopyHelperDefaultCollapsed', newDefault);
        alert(`默认状态已更改为：${newDefault === 'true' ? '收起' : '展开'}`);
    });

    // 创建排除网址的配置面板
    const configPanel = document.createElement('div');
    configPanel.className = 'ipfs-config-panel';
    configPanel.innerHTML = `
        <h2>排除网址管理</h2>
        <div class="help-text">
            每行一个网址。支持以下格式：<br>
            - 完整网址: https://example.com/page<br>
            - 通配符匹配: https://example.com/admin/*<br>
            - 关键词匹配: *example.com*
        </div>
        <textarea id="excludeUrlList" placeholder="在此输入要排除的网址，每行一个"></textarea>
        <div class="button-group">
            <button id="addCurrentUrl">添加当前页面</button>
            <button id="saveExcludeList">保存</button>
            <button id="cancelConfig">取消</button>
        </div>
    `;
    document.body.appendChild(configPanel);

    //// 获取排除列表
    function getExcludedUrls() {
        return GM_getValue('excludedUrls', []);
    }

    //// 保存排除列表
    function saveExcludedUrls(urls) {
        GM_setValue('excludedUrls', urls);
    }

    //// 将URL模式转换为正则表达式
    function urlPatternToRegex(pattern) {
        let escapedPattern = pattern
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
            .replace(/\\\*/g, '.*'); // 还原 * 为通配符
        return new RegExp(`^${escapedPattern}`, 'i');
    }

    //// 检查URL是否在排除列表中
    function isExcludedPage() {
        const currentUrl = window.location.href;
        const excludedUrls = getExcludedUrls();

        return excludedUrls.some(pattern => {
            const regex = urlPatternToRegex(pattern);
            return regex.test(currentUrl);
        });
    }

    //// 显示排除网址的配置面板
    function showConfigPanel() {
        const excludedUrls = getExcludedUrls();

        // 如果没有保存的排除列表，则填入默认规则
        if (excludedUrls.length === 0) {
            excludedUrls.push('*cangku.moe/admin/post/*');
        }

        document.getElementById('excludeUrlList').value = excludedUrls.join('\n');
        configPanel.classList.add('visible');
    }

    //// 注册菜单命令：管理排除网址
    GM_registerMenuCommand('管理排除网址', showConfigPanel);

    //// 事件处理：添加当前页面到排除列表
    document.getElementById('addCurrentUrl').addEventListener('click', () => {
        const textarea = document.getElementById('excludeUrlList');
        const currentUrl = window.location.href;
        const urls = textarea.value.split('\n').filter(url => url.trim());

        if (!urls.includes(currentUrl)) {
            urls.push(currentUrl);
            textarea.value = urls.join('\n');
        }
    });

    //// 事件处理：保存排除列表
    document.getElementById('saveExcludeList').addEventListener('click', () => {
        const urls = document.getElementById('excludeUrlList').value
            .split('\n')
            .map(url => url.trim())
            .filter(url => url);

        saveExcludedUrls(urls);
        configPanel.classList.remove('visible');

        // 保存后检查并清理
        if (isExcludedPage()) {
            observer.disconnect();
            // 清理已有的批量按钮和其他UI元素
            batchButtonsContainer.classList.remove('visible');
            copyBtn.style.display = 'none';
            // 清理 linkInfo
            linkInfo.clear();
            console.log('当前页面已被添加到排除列表，已停止扫描');
        } else {
            // 重新初始化
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            initPageScan();
        }
    });

    //// 事件处理：取消
    document.getElementById('cancelConfig').addEventListener('click', () => {
        configPanel.classList.remove('visible');
    });

    // 设置纯文本 CID 复制下载链接的默认 IPFS 网关
    GM_registerMenuCommand('设置纯文本 CID 复制下载链接的默认 IPFS 网关', setGateway);

    //// 获取复制时默认网关地址，优先使用用户设置的网关，默认 ipfs.io
    function getGateway() {
        return GM_getValue('ipfsGateway', 'https://ipfs.io');
    }

    //// 设置复制时默认网关地址
    function setGateway() {
        const currentGateway = getGateway();
        const newGateway = prompt(
            '请输入复制纯文本 CID 下载链接的 IPFS 网关（含 https://）：\n' +
            '留空则使用默认网关 https://ipfs.io',
            currentGateway
        );

        if (newGateway === null) {
            // 用户点击取消
            return;
        }

        let gateway = newGateway.trim();

        // 如果用户输入为空，使用默认网关
        if (!gateway) {
            gateway = 'https://ipfs.io';
        }

        // 确保网关地址以 https:// 开头
        if (!gateway.startsWith('https://')) {
            alert('网关地址必须以 https:// 开头！');
            return;
        }

        // 移除末尾的斜杠
        gateway = gateway.replace(/\/+$/, '');

        // 保存设置
        GM_setValue('ipfsGateway', gateway);
        alert(`网关已设置为：${gateway}`);
    }

    // 浮窗隐藏/显示切换函数
    const linkInfo = new Map();
    let isCollapsed = false;

    function toggleCollapse() {
        isCollapsed = !isCollapsed;
        batchButtonsContainer.classList.toggle('collapsed', isCollapsed);
        localStorage.setItem('ipfsCopyHelperCollapsed', isCollapsed);
    }
    
    // 打开 IPFS-SCAN
    GM_registerMenuCommand('打开 IPFS-SCAN', () => {
        // 在新标签页打开 IPFS-SCAN
        window.open('https://ipfs-scan.io/', '_blank');
    });

    // 打开 IPFS 网关测速器
    GM_registerMenuCommand('打开 IPFS 网关测速器', () => {
        // 使用全局引用调用showSpeedTestWindow函数
        if (globalShowSpeedTestWindow) {
            globalShowSpeedTestWindow();
        } else {
            alert("网关测速功能尚未初始化，请稍后再试");
        }
    });

    

    // 检查默认配置和初始化
    const defaultCollapsedState = localStorage.getItem('ipfsCopyHelperDefaultCollapsed');
    if (defaultCollapsedState === 'false') {
        isCollapsed = false;
        batchButtonsContainer.classList.remove('collapsed');
    } else if (defaultCollapsedState === 'true') {
        isCollapsed = true;
        batchButtonsContainer.classList.add('collapsed');
    }









    //// 5. 初始化 ////

    // 初始化网关测速功能并保存showSpeedTestWindow函数引用
    function initGatewaySpeedTest() {
        // 初始化网关测速功能并获取showSpeedTestWindow函数引用
        globalShowSpeedTestWindow = setupGatewaySpeedTest();
    }

    // 在脚本初始化部分调用 setupGatewaySpeedTest 函数
    document.addEventListener('DOMContentLoaded', () => {
        if (!isExcludedPage()) {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            // 初始化网关测速功能
            initGatewaySpeedTest();
            // 初始化页面扫描功能
            initPageScan();
        }
    });
    
    // 确保在脚本加载后也调用
    initGatewaySpeedTest();

    // 绑定批量按钮事件
    batchCopyBtn.addEventListener('click', batchCopyCIDs);
    batchFilenameBtn.addEventListener('click', batchCopyFilenames);
    batchDownloadBtn.addEventListener('click', batchCopyDownloadLinks);
    toggleBtn.addEventListener('click', toggleCollapse);

    // 监听文件名输入框变化
    const filenameInputElement = speedTestWindow.querySelector('.ipfs-filename-input');
    if (filenameInputElement) {
        filenameInputElement.addEventListener('input', function() {
            updateLinkPreview(); // 文件名变化时更新链接预览
        });
    }

    // 启动文本选择功能和初始扫描
    // initTextSelection();
    initPageScan();
})();
