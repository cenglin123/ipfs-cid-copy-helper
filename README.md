# IPFS CID Copy Helper

自动为网页中的 IPFS 链接添加 CID 复制功能，右下角可以显示批量操作窗口。
支持多种 IPFS/IPNS 格式和批量复制。

<div align="center">
  <img src="img/example1.4.jpg" width="800" alt="示例1">
</div>

## 安装 / Installation

### 方式一：点击安装
[点击安装 / Click to Install](https://github.com/cenglin123/ipfs-cid-copy-helper/raw/main/ipfs-cid-copy.user.js)

### 方式二：手动安装
1. 确保浏览器已安装 Tampermonkey 或其他用户脚本管理器
2. 在本仓库中打开 `ipfs-cid-copy.user.js`
3. 点击 "Raw" 按钮
4. Tampermonkey 会自动识别并提示安装

## 功能特性 / Features
- 鼠标悬停在 IPFS/IPNS 链接上时可快速复制 CID
- 右下角批量功能窗口：
  - 批量复制所有 CID
  - 批量复制下载链接
  - 批量复制文件名
- 支持各种 IPFS 链接格式（Qm/bafy 开头的 CID、IPNS 密钥等）
- 可收起的悬浮窗，不影响页面浏览
- 自动排除当前页面 CID，避免重复

[测试 IPFS 链接](https://gw-seattle.crustcloud.io/ipfs/bafybeihzpvolsy7kt2ug37nwau2d4a5cfcl3bvafsssphpdw7voi5rjadm?filename=wukong.png)

[测试 IPNS 链接](https://gw-seattle.crustcloud.io/ipns/k51qzi5uqu5dh1ts2qvcw3069src00zyjw0qmwdkb102k8q4ft8bztw75iwi25)

点击配置和切换浮窗默认显示

![Clip_2024-10-29_18-35-45](https://github.com/user-attachments/assets/05158531-d314-4406-978c-8616ad2bd4b8)


## 更新日志 / Changelog

### v1.8 (2024-10-29)
- 首次发布

## 开源协议 / License
MIT License
