// ==UserScript==
// @name         IPFS CID Copy Helper
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  自动为网页中的 IPFS 链接添加 CID 复制功能，右下角可以显示批量操作窗口。 支持多种 IPFS/IPNS 格式和批量复制。
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
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 10000;
            transition: transform 0.3s ease;
            min-height: 100px;
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
            background: #ff4444;
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

    // 创建UI元素
    const copyBtn = document.createElement('div');
    copyBtn.className = 'ipfs-copy-btn';
    copyBtn.textContent = '复制 CID';
    document.body.appendChild(copyBtn);

    const batchButtonsContainer = document.createElement('div');
    batchButtonsContainer.className = 'ipfs-batch-buttons';
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

    // 添加检查是否为 .crop.top 域名的辅助函数
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
            
            // 匹配子域名形式
            const subdomain = urlObj.hostname.split('.')[0];
            if (subdomain.match(/^(baf[yk][a-zA-Z0-9]{55}|Qm[a-zA-Z0-9]{44})$/i)) {
                extractedCID = subdomain;
            }
            // 更精确的 IPNS key 匹配
            if (subdomain.match(/^k51[a-zA-Z0-9]{59}$/i)) {
                extractedCID = subdomain;
            }
    
            // 匹配路径中的 IPFS CID
            const ipfsPathMatch = urlObj.pathname.match(/\/ipfs\/(baf[yk][a-zA-Z0-9]{55}|Qm[a-zA-Z0-9]{44})/i) ||
                                url.match(/\/ipfs\/(baf[yk][a-zA-Z0-9]{55}|Qm[a-zA-Z0-9]{44})/i);
            if (ipfsPathMatch) {
                extractedCID = ipfsPathMatch[1];
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

    // 扫描页面函数
    function scanPageForLinks() {
        const links = document.getElementsByTagName('a');
        linkInfo.clear();

        // 获取当前页面的 CID 以便排除
        const currentPageCID = extractCID(window.location.href);
        const currentPageBase = window.location.origin + window.location.pathname.split('/').slice(0, -1).join('/');

        // 扫描页面上的所有链接
        for (const link of links) {
            const cid = extractCID(link.href);
            if (!cid || cid === currentPageCID) continue;  // 跳过当前页面的 CID

            // 检查链接是否为当前目录下的链接
            try {
                const linkUrl = new URL(link.href);
                const linkBase = linkUrl.origin + linkUrl.pathname.split('/').slice(0, -1).join('/');
                if (linkBase === currentPageBase) continue;  // 跳过当前目录下的链接
            } catch (e) {
                console.error('URL解析错误:', e);
            }

            // 如果通过了上面的检查，添加到列表中
            const filename = extractFilename(link.href, link.textContent);
            linkInfo.set(cid, {
                type: detectLinkType(link.href),
                url: link.href,
                text: link.textContent.trim(),
                filename: filename
            });
        }

        // 更新按钮显示和计数
        const count = linkInfo.size;
        const countElements = document.querySelectorAll('.ipfs-copy-count');
        countElements.forEach(el => {
            el.textContent = count;
        });

        // 更新按钮显示状态
        [batchCopyBtn, batchDownloadBtn, batchFilenameBtn].forEach(btn => {
            btn.style.display = count > 0 ? 'block' : 'none';
        });
    }

    // 其他辅助函数
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

    const linkInfo = new Map();
    let isCollapsed = false;

    function toggleCollapse() {
        isCollapsed = !isCollapsed;
        batchButtonsContainer.classList.toggle('collapsed', isCollapsed);
        localStorage.setItem('ipfsCopyHelperCollapsed', isCollapsed);
    }

    // 事件处理初始化代码
    const savedCollapsedState = localStorage.getItem('ipfsCopyHelperCollapsed');
    if (savedCollapsedState !== null) {
        isCollapsed = (savedCollapsedState === 'true');
        batchButtonsContainer.classList.toggle('collapsed', isCollapsed);
    }

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

    let scanTimeout;
    function initPageScan() {
        if (scanTimeout) {
            clearTimeout(scanTimeout);
        }
        scanTimeout = setTimeout(scanPageForLinks, 1000);
    }

    const observer = new MutationObserver((mutations) => {
        initPageScan();
    });


    // 初始化配置和观察器
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 初始化事件监听器
    document.addEventListener('mouseover', function(e) {
        const link = e.target.closest('a');
        if (!link) return;

        const href = link.href;
        if (!href) return;

        const cid = extractCID(href);
        const currentPageCID = extractCID(window.location.href);
        
        // 如果是当前页面的 CID 或当前目录下的链接，则不显示复制按钮
        if (!cid || cid === currentPageCID) return;

        try {
            const currentPageBase = window.location.origin + window.location.pathname.split('/').slice(0, -1).join('/');
            const linkUrl = new URL(href);
            const linkBase = linkUrl.origin + linkUrl.pathname.split('/').slice(0, -1).join('/');
            if (linkBase === currentPageBase) return;
        } catch (e) {
            console.error('URL解析错误:', e);
        }

        const linkType = detectLinkType(href);
        const rect = link.getBoundingClientRect();
        copyBtn.style.display = 'block';
        copyBtn.style.top = `${rect.bottom + window.scrollY + 5}px`;
        copyBtn.style.left = `${rect.left + (rect.width / 2) + window.scrollX}px`;
        copyBtn.textContent = `复制 ${linkType}`;
        copyBtn.onclick = () => copyToClipboard(cid, copyBtn);
    });

    document.addEventListener('mouseout', function(e) {
        if (!e.target.closest('a') && !e.target.closest('.ipfs-copy-btn')) {
            copyBtn.style.display = 'none';
        }
    });

    copyBtn.addEventListener('mouseover', function() {
        copyBtn.style.display = 'block';
    });

    copyBtn.addEventListener('mouseout', function(e) {
        if (!e.relatedTarget || !e.relatedTarget.closest('a')) {
            copyBtn.style.display = 'none';
        }
    });

    // 添加菜单命令
    GM_registerMenuCommand('切换右下角浮窗默认展开/收起状态', () => {
        const defaultCollapsed = localStorage.getItem('ipfsCopyHelperDefaultCollapsed');
        const newDefault = defaultCollapsed === 'true' ? 'false' : 'true';
        localStorage.setItem('ipfsCopyHelperDefaultCollapsed', newDefault);
        alert(`默认状态已更改为：${newDefault === 'true' ? '收起' : '展开'}`);
    });

    // 检查默认配置
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

    // 执行初始扫描
    initPageScan();
})();
