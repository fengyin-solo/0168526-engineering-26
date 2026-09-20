#!/usr/bin/env bash
# UI 检查流水线入口：起服务 → 窄屏/宽屏两套布局 → 抽屉/设置/模板面板逐步确认。
# 任何一步失败都会以「步骤名 + 原因」的形式输出，退出码非零。
set -euo pipefail
cd "$(dirname "$0")/.."

# 本机若无 root 权限安装浏览器系统依赖，可使用本地解压的依赖库（见 README）
LIB_ROOT=".browser-libs/root"
if [ -d "$LIB_ROOT" ]; then
  for d in "$LIB_ROOT"/usr/lib/* "$LIB_ROOT"/lib/*; do
    [ -d "$d" ] && LD_LIBRARY_PATH="$(cd "$d" && pwd)${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  done
  export LD_LIBRARY_PATH
fi

exec npx playwright test "$@"
