// ==UserScript==
// @name         IPFS CID Copy Helper
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  自动为网页中的 IPFS 链接和文本添加 CID 复制功能，支持普通文本中的 CID。
// @author       cenglin123
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
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
    `);

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

    // 查找文本中的 CID
    function findCIDInText(text) {
        for (const pattern of CID_PATTERNS) {
            const match = text.match(pattern);
            if (match) {
                return {
                    cid: match[1],
                    type: match[1].startsWith('k51') ? 'IPNS Key' : 'IPFS CID'
                };
            }
        }
        return null;
    }

    // 获取选中文本
    function getSelectedText() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return null;

        const range = selection.getRangeAt(0);
        const text = range.toString().trim();

        if (text.length === 0) return null;

        return {
            text: text,
            range: range
        };
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

    // 扫描页面函数
    function scanPageForLinks() {
        const links = document.getElementsByTagName('a');
        linkInfo.clear();

        const currentPageCID = extractCID(window.location.href);
        const currentPageBase = window.location.origin + window.location.pathname.split('/').slice(0, -1).join('/');

        for (const link of links) {
            const cid = extractCID(link.href);
            if (!cid || cid === currentPageCID) continue;

            try {
                const linkUrl = new URL(link.href);
                const linkBase = linkUrl.origin + linkUrl.pathname.split('/').slice(0, -1).join('/');
                if (linkBase === currentPageBase) continue;
            } catch (e) {
                console.error('URL解析错误:', e);
            }

            const filename = extractFilename(link.href, link.textContent);
            linkInfo.set(cid, {
                type: detectLinkType(link.href),
                url: link.href,
                text: link.textContent.trim(),
                filename: filename
            });
        }

        const count = linkInfo.size;
        const countElements = document.querySelectorAll('.ipfs-copy-count');
        countElements.forEach(el => {
            el.textContent = count;
        });

        // 修改：根据是否有 CID 来显示/隐藏整个浮窗
        if (count > 0) {
            batchButtonsContainer.classList.add('visible');
            [batchCopyBtn, batchDownloadBtn, batchFilenameBtn].forEach(btn => {
                btn.style.display = 'block';
            });
        } else {
            batchButtonsContainer.classList.remove('visible');
            [batchCopyBtn, batchDownloadBtn, batchFilenameBtn].forEach(btn => {
                btn.style.display = 'none';
            });
        }
    }


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

    function batchCopyCIDs() {
        const cids = Array.from(linkInfo.keys());
        if (cids.length > 0) {
            const formattedCIDs = cids.join('\n');
            copyToClipboard(formattedCIDs, batchCopyBtn);
        }
    }

    function batchCopyFilenames() {
        const filenames = Array.from(linkInfo.values())
            .map(info => info.filename || '未知文件名')
            .filter(filename => filename !== '未知文件名');

        if (filenames.length > 0) {
            const formattedFilenames = filenames.join('\n');
            copyToClipboard(formattedFilenames, batchFilenameBtn);
        } else {
            batchFilenameBtn.textContent = '没有可用的文件名';
            setTimeout(() => {
                batchFilenameBtn.innerHTML = '批量复制文件名 <span class="ipfs-copy-count">' +
                    linkInfo.size + '</span>';
            }, 1000);
        }
    }

    function batchCopyDownloadLinks() {
        const links = Array.from(linkInfo.values()).map(info => {
            let url = info.url;
            if (info.filename && !url.includes('?filename=')) {
                url += (url.includes('?') ? '&' : '?') + 'filename=' +
                    encodeURIComponent(info.filename);
            }
            return url;
        });

        if (links.length > 0) {
            const formattedLinks = links.join('\n');
            copyToClipboard(formattedLinks, batchDownloadBtn);
        }
    }

    // 显示复制按钮
    function showCopyButton(x, y, cid, type) {
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

    // 初始化文本选择功能
    function initTextSelection() {
        document.addEventListener('mouseup', function(e) {
            if (e.target.classList.contains('ipfs-copy-btn')) return;

            setTimeout(() => {
                const selection = getSelectedText();
                if (!selection) return;

                const cidInfo = findCIDInText(selection.text);
                if (cidInfo) {
                    const rect = selection.range.getBoundingClientRect();
                    showCopyButton(
                        rect.left + (rect.width / 2),
                        rect.bottom,
                        cidInfo.cid,
                        cidInfo.type
                    );
                }
            }, 10);
        });

        // 点击其他地方时隐藏按钮
        document.addEventListener('mousedown', function(e) {
            if (!e.target.classList.contains('ipfs-copy-btn')) {
                copyBtn.style.display = 'none';
            }
        });
    }

    let scanTimeout;
    function initPageScan() {
        if (scanTimeout) {
            clearTimeout(scanTimeout);
        }
        scanTimeout = setTimeout(scanPageForLinks, 1000);
    }

    // 添加新的变量来跟踪状态
    let currentHoveredLink = null;
    let isButtonHovered = false;
    let hideTimeout = null;

    // 用于检查鼠标是否在元素或其子元素上
    function isMouseOverElement(element, event) {
        const rect = element.getBoundingClientRect();
        return (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
        );
    }

    // 链接悬停处理
    function hideButton() {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
        }
        hideTimeout = setTimeout(() => {
            if (!isButtonHovered && !currentHoveredLink) {
                copyBtn.style.display = 'none';
            }
        }, 100); // 添加100ms延迟
    }

    // 链接悬停处理
    document.addEventListener('mouseover', function(e) {
        const link = e.target.closest('a');
        if (link) {
            currentHoveredLink = link;
            const href = link.href;
            if (!href) return;

            const linkCID = extractCID(href);
            if (!linkCID) return;

            const shouldShow = isIPFSBrowsingPage(window.location.href) ||
                             linkCID !== extractCID(window.location.href);

            if (shouldShow) {
                const linkType = detectLinkType(href);
                const rect = link.getBoundingClientRect();
                showCopyButton(
                    rect.left + (rect.width / 2),
                    rect.bottom,
                    linkCID,
                    linkType
                );
            }
        }
    });

    document.addEventListener('mouseout', function(e) {
        const link = e.target.closest('a');
        if (link) {
            if (!isMouseOverElement(link, e)) {
                currentHoveredLink = null;
                hideButton();
            }
        }
    });

    // 复制按钮自身的悬停处理
    copyBtn.addEventListener('mouseover', function() {
        isButtonHovered = true;
        if (hideTimeout) {
            clearTimeout(hideTimeout);
        }
    });

    copyBtn.addEventListener('mouseout', function(e) {
        isButtonHovered = false;
        // 检查鼠标是否移动到了链接上
        const relatedTarget = e.relatedTarget;
        const isOverLink = relatedTarget && (relatedTarget.closest('a') === currentHoveredLink);

        if (!isOverLink) {
            hideButton();
        }
    });

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

    // 观察DOM变化
    const observer = new MutationObserver(() => {
        initPageScan();
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
    initTextSelection();
    initPageScan();
})();
