// ==UserScript==
// @name         IPFS CID Copy Helper
// @namespace    http://tampermonkey.net/
// @version      2.1
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

    // 样式
    GM_addStyle(`
        .ipfs-copy-btn {
            display: none;
            position: absolute;
            background: #4a90e2;
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            z-index: 10000;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            transform: translateX(-50%);
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

    // 创建配置面板
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

    // CID 正则表达式模式
    const CID_PATTERNS = [
        /\b(baf[yk][a-zA-Z0-9]{55})\b/i,    // IPFS CID v1
        /\b(Qm[a-zA-Z0-9]{44})\b/i,         // IPFS CID v0
        /\b(k51[a-zA-Z0-9]{59})\b/i         // IPNS Key
    ];

    // 创建UI元素
    const copyBtn = document.createElement('div');
    copyBtn.className = 'ipfs-copy-btn';
    copyBtn.textContent = '复制 CID';
    document.body.appendChild(copyBtn);

    const batchButtonsContainer = document.createElement('div');
    batchButtonsContainer.className = 'ipfs-batch-buttons';
    // 根据默认设置决定是否添加 collapsed 类
    if (localStorage.getItem('ipfsCopyHelperDefaultCollapsed') === 'true') {
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

    // 检查是否为 .crop.top 域名
    function isCropTop(url) {
        try {
            const hostname = new URL(url).hostname;
            return hostname.endsWith('.crop.top');
        } catch (e) {
            return false;
        }
    }

    // 提取CID函数
    function extractCID(url) {
        try {
            const urlObj = new URL(url);

            // 定义要排除的 CID
            const excludedCIDs = [
                'bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354',
                'QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'
            ];

            let extractedCID = null;

            // 处理 crop.top 域名
            if (isCropTop(url)) {
                const subdomain = urlObj.hostname.split('.')[0];
                if (subdomain.match(/^(baf[yk][a-zA-Z0-9]{55}|Qm[a-zA-Z0-9]{44})$/i)) {
                    extractedCID = subdomain;
                }
            }

            // 如果不是 crop.top 或没有从子域名中提取到 CID，继续其他匹配
            if (!extractedCID) {
                // 匹配子域名形式
                const subdomain = urlObj.hostname.split('.')[0];
                if (subdomain.match(/^(baf[yk][a-zA-Z0-9]{55}|Qm[a-zA-Z0-9]{44})$/i)) {
                    extractedCID = subdomain;
                }
                // 匹配 IPNS key
                if (subdomain.match(/^k51[a-zA-Z0-9]{59}$/i)) {
                    extractedCID = subdomain;
                }

                // 增强型路径匹配
                const ipfsPathMatch = urlObj.pathname.match(/\/ipfs\/(baf[yk][a-zA-Z0-9]{55}|Qm[a-zA-Z0-9]{44})/i) ||
                                    url.match(/\/ipfs\/(baf[yk][a-zA-Z0-9]{55}|Qm[a-zA-Z0-9]{44})/i);
                if (ipfsPathMatch) {
                    extractedCID = ipfsPathMatch[1];
                }

                if (!extractedCID) {
                    const pathParts = urlObj.pathname.split('/');
                    for (let i = 0; i < pathParts.length; i++) {
                        if (pathParts[i].toLowerCase() === 'ipfs' && i + 1 < pathParts.length) {
                            const potentialCID = pathParts[i + 1];
                            if (potentialCID.match(/^(baf[yk][a-zA-Z0-9]{55}|Qm[a-zA-Z0-9]{44})$/i)) {
                                extractedCID = potentialCID;
                                break;
                            }
                        }
                    }
                }

                // 匹配路径中的 IPNS key
                const ipnsKeyMatch = urlObj.pathname.match(/\/ipns\/(k51[a-zA-Z0-9]{59})/i) ||
                                   url.match(/\/ipns\/(k51[a-zA-Z0-9]{59})/i);
                if (ipnsKeyMatch) {
                    extractedCID = ipnsKeyMatch[1];
                }

                // 匹配路径中的独立 IPNS key
                const ipnsPathMatch = urlObj.pathname.match(/(k51[a-zA-Z0-9]{59})/i);
                if (ipnsPathMatch) {
                    extractedCID = ipnsPathMatch[1];
                }
            }

            // 检查是否为排除的 CID
            if (extractedCID && excludedCIDs.includes(extractedCID.toLowerCase())) {
                return null;
            }

            return extractedCID;
        } catch (e) {
            console.error('URL解析错误:', e);
            return null;
        }
    }

    // 判断是否为文件浏览页面
    function isIPFSBrowsingPage(url) {
        try {
            const pathname = new URL(url).pathname;
            return pathname.includes('/ipfs/') && pathname.split('/').length > 3;
        } catch (e) {
            return false;
        }
    }

    // 扫描页面中的文本节点
    // 扫描文本节点并添加监听器
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

    // 扫描页面函数
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
            if (!cid || cid === currentPageCID) continue;
    
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

    // 添加文本高亮处理
    document.addEventListener('mouseover', function(e) {
        if (e.target.classList.contains('ipfs-highlight')) {
            const cid = e.target.textContent;
            const type = cid.startsWith('k51') ? 'IPNS Key' : 'IPFS CID';
            const rect = e.target.getBoundingClientRect();
            showCopyButton(
                rect.left + (rect.width / 2),
                rect.bottom,
                cid,
                type
            );
        }
    });

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

    // 复制到剪贴板
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

    const linkInfo = new Map();
    let isCollapsed = false;

    function toggleCollapse() {
        isCollapsed = !isCollapsed;
        batchButtonsContainer.classList.toggle('collapsed', isCollapsed);
        localStorage.setItem('ipfsCopyHelperCollapsed', isCollapsed);
    }

    // 首先，将所有计数器更新统一到一个函数中
    function updateCounters(count) {
        // 更新所有计数器元素为确切的数值
        const countElements = document.querySelectorAll('.ipfs-copy-count');
        countElements.forEach(el => {
            el.textContent = count.toString(); // 强制转换为字符串
        });
    }

    function batchCopyItems(type, button) {
        const currentPageCID = extractCID(window.location.href);
        
        const sortedEntries = Array.from(linkInfo.entries())
            .filter(([cid]) => cid !== currentPageCID)
            .sort((a, b) => {
                if (!!a[1].isLink === !!b[1].isLink) return 0;
                return a[1].isLink ? -1 : 1;
            });
        
        const exactCount = sortedEntries.length;
        updateCounters(exactCount);
        
        if (exactCount === 0) {
            button.textContent = '没有可用的项目';
            setTimeout(() => {
                button.innerHTML = `批量复制${type === 'cid' ? 'CID' : 
                                  type === 'filename' ? '文件名' : 
                                  '下载链接'} <span class="ipfs-copy-count">${exactCount}</span>`;
            }, 1000);
            return;
        }
    
        const items = sortedEntries.map(([cid, info]) => {
            // 尝试从文本内容中提取 filename 参数
            let filenameFromText = null;
            if (!info.isLink && info.text) {
                // 查找 CID 后面的 filename 参数，直到遇到换行符或字符串结束
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
                    // 优先级：显式文件名 > 文本中的 filename 参数 > CID
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
                        // 优先使用已有的文件名
                        const validFilename = info.filename && !info.filename.includes('/ipfs/') 
                            ? info.filename 
                            : (filenameFromText || cid);
                        if (!url.includes('?filename=')) {
                            url += (url.includes('?') ? '&' : '?') + 'filename=' + 
                                encodeURIComponent(validFilename);
                        }
                        return url;
                    }
                    // 对于文本CID，使用检测到的文件名（如果有）
                    const filename = filenameFromText || cid;
                    return `https://ipfs.io/ipfs/${cid}?filename=${encodeURIComponent(filename)}`;
                    
                default:
                    return cid;
            }
        });
    
        const formattedItems = items.join('\n');
        copyToClipboard(formattedItems, button);
    }
    
    // 更新计数显示的辅助函数
    function updateBatchButtons() {
        const currentPageCID = extractCID(window.location.href);
        const totalCount = linkInfo.size;
        const effectiveCount = currentPageCID ? totalCount - 1 : totalCount;
        
        // 使用统一的计数器更新函数
        updateCounters(effectiveCount);
        
        if (effectiveCount > 0) {
            batchButtonsContainer.classList.add('visible');
            
            // 更新按钮可见性
            [batchCopyBtn, batchDownloadBtn, batchFilenameBtn].forEach(btn => {
                btn.style.display = 'block';
            });
            
            // 使用一致的计数更新按钮文本
            batchCopyBtn.innerHTML = `批量复制CID <span class="ipfs-copy-count">${effectiveCount}</span>`;
            batchDownloadBtn.innerHTML = `批量复制下载链接 <span class="ipfs-copy-count">${effectiveCount}</span>`;
            batchFilenameBtn.innerHTML = `批量复制文件名 <span class="ipfs-copy-count">${effectiveCount}</span>`;
        } else {
            batchButtonsContainer.classList.remove('visible');
            [batchCopyBtn, batchDownloadBtn, batchFilenameBtn].forEach(btn => {
                btn.style.display = 'none';
            });
        }
    }
    
    // 调用统一的处理函数
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
    function showCopyButton(x, y, cid, type) {
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
    
        copyBtn.style.display = 'block';
        copyBtn.style.top = `${y + window.scrollY + 5}px`;
        copyBtn.style.left = `${x + window.scrollX}px`;
        copyBtn.textContent = `复制 ${type}`;
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(cid).then(() => {
                copyBtn.textContent = '已复制！';
                setTimeout(() => {
                    copyBtn.textContent = `复制 ${type}`;
                    copyBtn.style.display = 'none';
                }, 1000);
            });
        };
    }

    // 修改隐藏按钮函数
    function hideButton() {
        // 如果在排除列表中，确保按钮隐藏
        if (isExcludedPage()) {
            copyBtn.style.display = 'none';
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
                copyBtn.style.display = 'none';
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

    // 初始化状态变量
    let currentHoveredElement = null;
    let currentHoveredLink = null;  // 添加这个变量声明
    let isButtonHovered = false;
    let hideTimeout = null;
    let showTimeout = null;

    // 统一处理文本和链接的悬停
    function handleElementHover(element, cid, type) {
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
                type
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
                handleElementHover(link, linkCID, detectLinkType(href));
            }
            return;
        }
    
        // 处理文本节点中的 CID
        const cidSpan = e.target.closest('[data-cid]');
        if (cidSpan && cidSpan.dataset.cid) {
            handleElementHover(cidSpan, cidSpan.dataset.cid, cidSpan.dataset.type);
            return;
        }
    });

    // mouseout 事件处理
    document.addEventListener('mouseout', function(e) {
        const relatedTarget = e.relatedTarget;
        if (!relatedTarget ||
            (!relatedTarget.closest('.ipfs-copy-btn') &&
            !relatedTarget.dataset?.cid &&
            !relatedTarget.closest('a'))) {
            currentHoveredElement = null;
            currentHoveredLink = null;  // 重置当前悬停的链接
            hideButton();
        }
    });

    // mousemove 事件处理
    // 处理在按钮和链接之间移动的情况
    document.addEventListener('mousemove', function(e) {
        const overLink = e.target.closest('a');
        const overButton = e.target.closest('.ipfs-copy-btn');

        if (!overLink && !overButton) {
            currentHoveredLink = null;
            isButtonHovered = false;
            hideButton();
        }
    });

    // 按钮的悬停处理
    copyBtn.addEventListener('mouseover', function() {
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

    copyBtn.addEventListener('mouseout', function(e) {
        if (isExcludedPage()) {
            return;
        }
        isButtonHovered = false;
        const relatedTarget = e.relatedTarget;
        if (!relatedTarget ||
            (!relatedTarget.dataset?.cid &&
             !relatedTarget.closest('a'))) {
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

    // 添加菜单命令
    GM_registerMenuCommand('切换右下角浮窗默认展开/收起状态', () => {
        const defaultCollapsed = localStorage.getItem('ipfsCopyHelperDefaultCollapsed');
        const newDefault = defaultCollapsed === 'true' ? 'false' : 'true';
        localStorage.setItem('ipfsCopyHelperDefaultCollapsed', newDefault);
        alert(`默认状态已更改为：${newDefault === 'true' ? '收起' : '展开'}`);
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

    // 绑定批量按钮事件
    batchCopyBtn.addEventListener('click', batchCopyCIDs);
    batchFilenameBtn.addEventListener('click', batchCopyFilenames);
    batchDownloadBtn.addEventListener('click', batchCopyDownloadLinks);
    toggleBtn.addEventListener('click', toggleCollapse);

    // 启动文本选择功能和初始扫描
    // initTextSelection();
    initPageScan();
})();
