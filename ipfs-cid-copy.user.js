// ==UserScript==
// @name         IPFS CID Copy Helper
// @namespace    http://tampermonkey.net/
// @version      2.4
// @description  自动为网页中的 IPFS 链接和文本添加 CID 复制功能，支持普通文本中的 CID。
// @author       cenglin123
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
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
        navigator.clipboard.writeText(text).then(() => {
            button.textContent = '已复制！';
            setTimeout(() => {
                button.textContent = originalText;
            }, 1000);
        }).catch(err => {
            console.error('复制失败:', err);
            button.textContent = '复制失败';
            setTimeout(() => {
                button.textContent = originalText;
            }, 1000);
        });
    }

    // 批量复制函数
    function batchCopyItems(type, button) {
        const validEntries = getValidEntries();
        const totalCount = validEntries.length;
        
        if (totalCount === 0) {
            button.textContent = '没有可用的项目';
            setTimeout(() => {
                button.innerHTML = `批量复制${type === 'cid' ? 'CID' : 
                                type === 'filename' ? '文件名' : 
                                '下载链接'} <span class="ipfs-copy-count">${totalCount}</span>`;
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
                        if (!url.includes('?filename=')) {
                            url += (url.includes('?') ? '&' : '?') + 'filename=' + 
                                encodeURIComponent(validFilename);
                        }
                        return url;
                    }
                    const gateway = getGateway();
                    const filename = filenameFromText || cid;
                    return `${gateway}/ipfs/${cid}?filename=${encodeURIComponent(filename)}`;
                    
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
            [batchCopyBtn, batchDownloadBtn, batchFilenameBtn].forEach(btn => {
                btn.style.display = 'block';
                btn.innerHTML = `${btn.innerHTML.split('<')[0]}<span class="ipfs-copy-count">${totalCount}</span>`;
            });
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
    function showCopyButton(x, y, cid, type, isLink = false) {
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
    
        copyBtnGroup.style.display = 'block';
        copyBtnGroup.style.top = `${y + window.scrollY + 5}px`;
        copyBtnGroup.style.left = `${x + window.scrollX}px`;
    
        copyBtn.textContent = `复制 ${type}`;
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(cid).then(() => {
                copyBtn.textContent = '已复制！';
                setTimeout(() => {
                    copyBtn.textContent = `复制 ${type}`;
                    copyBtnGroup.style.display = 'none';
                }, 1000);
            });
        };
    
        // 只为纯文本CID显示下载链接按钮
        if (!isLink) {
            copyLinkBtn.style.display = 'inline-block';
            copyLinkBtn.textContent = '复制下载链接';
            copyLinkBtn.onclick = () => {
                const gateway = getGateway();
                const downloadLink = `${gateway}/ipfs/${cid}`;
                navigator.clipboard.writeText(downloadLink).then(() => {
                    copyLinkBtn.textContent = '已复制！';
                    setTimeout(() => {
                        copyLinkBtn.textContent = '复制下载链接';
                        copyBtnGroup.style.display = 'none';
                    }, 1000);
                });
            };
        } else {
            copyLinkBtn.style.display = 'none';
        }
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
    function handleElementHover(element, cid, type, isLink = false) {
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
                isLink
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
                handleElementHover(link, linkCID, detectLinkType(href), true); // 添加 isLink 参数
            }
            return;
        }

        // 处理文本节点中的 CID
        const cidSpan = e.target.closest('[data-cid]');
        if (cidSpan && cidSpan.dataset.cid) {
            handleElementHover(cidSpan, cidSpan.dataset.cid, cidSpan.dataset.type, false); // 添加 isLink 参数
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
    const observer = new MutationObserver((mutations) => {
        if (isExcludedPage()) {
            observer.disconnect(); // 如果页面在排除列表中，停止观察
            batchButtonsContainer.classList.remove('visible');
            return;
        }
        initPageScan();
    });

    // DOM 初始化代码
    document.addEventListener('DOMContentLoaded', () => {
        if (!isExcludedPage()) {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            initPageScan();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });










    //// 4. 添加油猴菜单命令 ////

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

    // 获取排除列表
    function getExcludedUrls() {
        return GM_getValue('excludedUrls', []);
    }

    // 保存排除列表
    function saveExcludedUrls(urls) {
        GM_setValue('excludedUrls', urls);
    }

    // 将URL模式转换为正则表达式
    function urlPatternToRegex(pattern) {
        let escapedPattern = pattern
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
            .replace(/\\\*/g, '.*'); // 还原 * 为通配符
        return new RegExp(`^${escapedPattern}`, 'i');
    }

    // 检查URL是否在排除列表中
    function isExcludedPage() {
        const currentUrl = window.location.href;
        const excludedUrls = getExcludedUrls();
        
        return excludedUrls.some(pattern => {
            const regex = urlPatternToRegex(pattern);
            return regex.test(currentUrl);
        });
    }

    // 显示配置面板
    function showConfigPanel() {
        const excludedUrls = getExcludedUrls();
        document.getElementById('excludeUrlList').value = excludedUrls.join('\n');
        configPanel.classList.add('visible');
    }

    // 注册菜单命令
    GM_registerMenuCommand('管理排除网址', showConfigPanel);

    // 事件处理
    document.getElementById('addCurrentUrl').addEventListener('click', () => {
        const textarea = document.getElementById('excludeUrlList');
        const currentUrl = window.location.href;
        const urls = textarea.value.split('\n').filter(url => url.trim());
        
        if (!urls.includes(currentUrl)) {
            urls.push(currentUrl);
            textarea.value = urls.join('\n');
        }
    });

    // 在保存排除列表后添加清理功能
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

    document.getElementById('cancelConfig').addEventListener('click', () => {
        configPanel.classList.remove('visible');
    });

    GM_registerMenuCommand('设置纯文本 CID 复制下载链接的默认 IPFS 网关', setGateway);

    // 获取网关地址，优先使用用户设置的网关，默认 ipfs.io
    function getGateway() {
        return GM_getValue('ipfsGateway', 'https://ipfs.io');
    }
    
    // 设置网关地址
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

    // 绑定批量按钮事件
    batchCopyBtn.addEventListener('click', batchCopyCIDs);
    batchFilenameBtn.addEventListener('click', batchCopyFilenames);
    batchDownloadBtn.addEventListener('click', batchCopyDownloadLinks);
    toggleBtn.addEventListener('click', toggleCollapse);

    // 启动文本选择功能和初始扫描
    // initTextSelection();
    initPageScan();
})();
