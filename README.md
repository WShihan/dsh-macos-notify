# dsh-macos-notify

[English](README.en.md) | 中文 | [GitHub](https://github.com/WShihan/dsh-macos-notify)

源码、issue 与发布：<https://github.com/WShihan/dsh-macos-notify>。

一个面向 macOS 的 DeepSeek Harness 插件：当 agent（智能体）轮次结束，或权限请求需要你处理时，通过 `/usr/bin/osascript` 弹出原生通知中心横幅；同时提供独立的 **通知** 设置页，让每一种触发操作各自配置提示音、标题与内容。

本包分为两半：Host 半声明可实时编辑的 Cordis 配置并监听 agent 事件；浏览器半贡献一个 **通知** 设置分区（section），通过共享的 `ctx.configForms` 服务编辑本插件在 profile 里的配置项。把本包同时挂载到两个平面就是全部接线——页面写的是同一个 profile 条目，Host 直接在运行中的 volatile 引用上读到新值，两半互不知道对方的代码。

本版本对应 DeepSeek Harness 0.2.1；`package.json` 用 `engines.dsh` 声明兼容范围，安装和 profile 启动都会检查。

## 触发操作、提示音与文本

| 操作 | 事件 | 默认提示音 | 默认标题 | 默认内容 | 设置项 |
|---|---|---|---|---|---|
| 轮次完成 | `session/event` → `turn/end`（`completed`） | Glass | `Task completed` | `The agent finished its turn.` | `sounds.completed`、`messages.completed` |
| 轮次受阻 | `turn/end`（`blocked`） | Funk | `Task blocked` | `The agent could not proceed.` | `sounds.blocked`、`messages.blocked` |
| 轮次取消 | `turn/end`（`aborted`） | Basso | `Task cancelled` | `The agent was cancelled.` | `sounds.aborted`、`messages.aborted` |
| 轮次失败 | `turn/end`（`error`） | Basso | `Task failed` | `{error}` | `sounds.error`、`messages.error` |
| 达到 token 上限 | `turn/end`（`max-tokens`） | Funk | `Token limit reached` | `The agent hit the output token ceiling.` | `sounds.maxTokens`、`messages.maxTokens` |
| 轮次中断 | `turn/end`（`interrupted`） | Basso | `Turn interrupted` | `The turn was interrupted.` | `sounds.interrupted`、`messages.interrupted` |
| 权限请求 | `approval/request` | Ping | `Permission requested` | `{tool} needs {reason}` | `sounds.approval`、`messages.approval` |

本插件不认识的、由其他插件合并扩展出来的轮次结束原因，会退化为“轮次完成”这一项——沿用它的提示音与文本。

可选提示音就是 macOS 系统提示音——`Basso`、`Blow`、`Bottle`、`Frog`、`Funk`、`Glass`、`Hero`、`Morse`、`Ping`、`Pop`、`Purr`、`Sosumi`、`Submarine`、`Tink`——外加 `default`（你在系统中配置的提醒声音）与 `none`（静音横幅，完全不生成 sound 子句）。

### 可用变量

标题与内容可以使用该操作暴露的变量；其他内容（包括写错的变量名）原样出现在横幅里，因此拼错时你能一眼看见，而不会让整句话消失。

| 操作 | 变量 | 含义 |
|---|---|---|
| 所有轮次结束操作 | `{turn}` | 已关闭轮次的编号。 |
| 轮次取消 | `{cause}` | 取消原因类型（`user` 等）。 |
| 轮次失败 | `{error}` | 失败信息。 |
| 权限请求 | `{tool}` | 需要授权的工具名。 |
| 权限请求 | `{reason}` | 询问方给出的原因；没有时替换为单词 `approval`。 |

`{error}` 与 `{reason}` 在代入前已按上限截断，最终渲染出的标题与内容也各自限制在 160 个字符以内——这正是横幅能显示的长度。



## 截图

![配置](./example/dsh-macos-notify.png)

![-test](./example/dsh-macos-notify-test.png)

## 安装

### 从 GitHub 仓库安装

```sh
dsh plugin --profile web add github:WShihan/dsh-macos-notify
```

本仓库把构建产物 `lib/` 一并纳入版本管理，因此安装过程中没有任何构建步骤：pnpm 找不到安装脚本，不会要求任何构建放行，下次重启 `dsh web` 即可加载。若希望安装固定在你审阅过的那个版本，就锁定提交：

```sh
dsh plugin --profile web add github:WShihan/dsh-macos-notify#<sha>
```

以后更新用同样的命令，或 `dsh plugin --profile web update dsh-macos-notify`。

要改动本插件时，则是克隆下来在本地构建：

```sh
git clone https://github.com/WShihan/dsh-macos-notify
cd dsh-macos-notify
pnpm install
pnpm run build
dsh plugin --profile web add "$PWD"
```

### 从 npm 安装

```sh
dsh plugin --profile web add dsh-macos-notify
```

这种方式要求本包已发布到 registry。`pnpm pack` 会把同样这份已提交的 `lib/` 打成可安装的 tarball：

```sh
pnpm pack
dsh plugin --profile web add ./dsh-macos-notify-0.2.0.tgz
```

### 从本地目录安装

```sh
pnpm run build     # 在插件目录内执行，确保 lib/ 存在
dsh plugin --profile web add /absolute/path/to/macos-notify
```

本地目录会以 `link:` 方式安装，而 pnpm 不会为它构建、也不会安装它的依赖，所以请先构建。Host 半是自包含的——除相对模块外，它唯一的运行时导入是 schema 库，构建时会内联——因此即使 profile 的包不在这条解析路径上，被链接的目录也能正常加载。

被链接的目录是由 `lib/` 提供服务的，因此每次改源码都要重新构建并重启服务：

```sh
cd /absolute/path/to/macos-notify
pnpm run dev          # tsdown --watch：保存即重建 lib/
# 然后重启 dsh web，并刷新页面
```

`dsh web` 在启动时导入 `lib/index.js`，并把 `lib/client.js` 快照进对外提供的启动图（boot graph），所以只重建而不重启是看不到效果的；刷新页面才会加载新的启动图。改设置则完全不需要这些——在「通知」页改的值由 Loader 提交进运行中的配置引用，下一条横幅立即生效。被链接的目录始终提供它自己的 `lib/`，所以请把重建后的文件与源码改动一起提交（见[已提交的构建产物](#已提交的构建产物)）。

如果安装输出 `declares no dsh.bundle … installed as a plain dependency`，说明加进去的是另一个包，或是没有该清单的检出目录。请先移除它，再添加本目录。

### 在 deepseek-harness 检出目录内使用

用一个 patch 覆盖层指向构建后的入口：

```yaml
- id: macos-notify
  name: 'file:///absolute/path/to/deepseek-harness/macos-notify/lib/index.js'
```

`id` 不能省：它既是配置命名空间，也是设置页寻址本插件表单所用的键。

请把构建后的插件挂载到运行构建产物的 harness 上。以源码方式启动（`tsx`）的 harness 会从源码解析 `@deepseek-ai/*`，此时构建后的插件会加载第二个 Cordis 实例；请先构建 harness（`pnpm run build`）。

## 从 0.1.x 升级

DSH 0.2.1 取消了独立的设置文档：设置页现在直接编辑 profile 中本插件条目的 `config`，字段名与 0.1.x 相同。旧版本的 `$DSH_HOME/settings.yaml` 会被 DSH 一次性导入并改名为 `settings.yaml.imported`；如果导入发生时本插件尚未加载（例如它正因为版本不兼容而无法启动），其中 `macos-notify` 这一节会留在该文件里，而没有写进 profile。此时把它手工迁到 profile 覆盖层即可：

```yaml
# $DSH_HOME/profiles/web/cordis.patch.yml
- id: macos-notify
  config:
    sounds:
      completed: Funk
    messages:
      completed:
        title: DSH 本轮完成
        message: 第{turn}轮任务完成。
```

旧的 `macos-notify-preview` 一节只是当时的预览通道，直接忽略。`engines.dsh` 会拒绝 0.2.1 之前的运行时，因此升级 DSH 后必须同时升级本插件。

## 设置页

在插件已挂载、并且组合了设置服务（`@deepseek-ai/dsh-settings`，随 `@deepseek-ai/dsh-base` 一起提供）时，设置面板会多出一个独立的 **通知** 页，在导航里排在通用、模型、插件、Agent 预设之后：

- **通知时机** 分组：轮次结束时通知、权限请求时通知、仅通知我自己的会话三个开关；
- **轮次结束横幅** 与 **权限请求横幅** 两个分组：上表每一种操作一个区块，内含该操作的提示音下拉框、标题、内容、**测试** 按钮；一旦你的 profile 覆盖层带有其中任一字段，就多出一个 **恢复默认** 按钮。

提示音与开关在选择时立即提交；文本则先暂存，由 **保存** 一次性写入（**放弃** 丢弃暂存）。因为一次设置写入就是一次持久化文档改动，若逐字符提交就会存入你并未确认的修改。所有改动的下一条横幅立即生效，无需重启。只有在 Host 对外提供 `macos-notify` 条目时页面才会渲染控件；没有设置服务时，下面的组合配置仍是唯一来源，页面为空。

### 测试横幅

**测试** 会立刻发出该操作的横幅，让你在真正等待某个轮次之前就能判断提示音与措辞是否合适。它预览的是页面上当前的文本——包括尚未保存的修改——并把该操作的变量替换为示例值（`{turn}` → `1`、`{tool}` → `shell`、`{error}` → `出了点问题。` 等）。测试不会保存文本，也不会改变已存储的提示音与措辞。

预览请求借道本插件配置里一个瞬态的 `preview` 字段（见[设计说明](#设计说明)）：页面写入后 Host 立即发出横幅并清除该请求；单调递增的 `nonce` 保证残留或重复的请求不会被重复触发。这个字段属于管道而非配置，正常情况下它不会留在 profile 里。

本插件的配置项拥有自己的页面，因此 Host 会关闭自动生成的配置页（`settings.configure({ auto: false })`），它不会在 **设置 → 插件** 里再出现一张重复的卡片。

## 组合配置（`cordis.yml`）

每个字段都可省略；设置页写入的 profile 覆盖层优先级高于它。

| 字段 | 默认值 | 含义 |
|---|---|---|
| `notifyOnTurnEnd` | `true` | 每个关闭的 agent 轮次弹出一条通知。 |
| `notifyOnApproval` | `true` | 审批请求到达应答链时弹出通知。 |
| `topLevelOnly` | `true` | 跳过委托子 agent（`delegationDepth > 0`）所属的会话；用户分叉出的会话仍视为顶层。 |
| `sounds.completed` … `sounds.approval` | 见上表 | 每种操作的提示音。未知名称会在加载时明确失败，作为设置写入也会被拒绝。 |
| `messages.<操作>.title` | 见上表 | 横幅标题。`sounds` 下的每一种操作在这里都有对应项。 |
| `messages.<操作>.message` | 见上表 | 横幅内容；横幅触发时会代入上表的可用变量。 |

```yaml
- id: macos-notify
  name: dsh-macos-notify
  config:
    sounds:
      completed: Hero
      approval: Submarine
    messages:
      completed:
        title: 任务完成
        message: 第 {turn} 轮已结束
      error:
        title: 任务失败
        message: '第 {turn} 轮失败：{error}'
      approval:
        title: 需要授权：{tool}
        message: 原因：{reason}
```

## 已提交的构建产物

本仓库把 `lib/` 纳入版本管理，而不是在安装时生成。`lib/index.js` 是 Loader 导入的入口，`lib/client.js` 是客户端模块系统对外提供的包体——正是因为它们被提交，`dsh plugin add github:WShihan/dsh-macos-notify` 才能在没有安装脚本、也不需要 pnpm 构建放行的情况下装好。

改动本插件的人都要遵守这份约定：

- **重建与提交成对出现。** 任何 `src/` 下的改动之后，先跑 `pnpm run build`，并在同一次提交里带上重新生成的 `lib/`。仓库对外提供的就是 `lib/` 里的内容，只改源码而落下 `lib/` 等于发布旧代码。
- **不要手改 `lib/`。** 它是生成产物：改 `src/`，再重建。
- **本包不声明 `prepare` 或 `postinstall` 脚本。** 这是有意为之，也是 git 安装不需要 `allowBuilds` 的原因。新克隆下来就已经带着提交好的 `lib/`；只有在改过源码之后才需要 `pnpm run build`。
- **在本包自己的仓库里提交。** 开发期间本包位于 deepseek-harness 检出目录内，而该检出根部的 `.gitignore` 会排除 `lib/`；git 采用最外层的那份配置，嵌套的 `.gitignore` 也无法把被父级排除的目录重新纳入。请先把本包复制到它自己的仓库，或在检出目录内提交产物时用 `git add -f lib`。
- **评审看 `src/`，不看 `lib/`。** 打包产物的 diff 是生成出来的、又很大；即使跳过它，也要确认这次提交里带着重建后的副本——下面的 `pnpm run check` 顺序正是保证这一点的做法。
- **发布的就是已提交的内容。** `pnpm pack` 与 `npm publish` 原样上传当前的 `lib/`，所以发布前请先构建。

## 构建、测试、检查

```sh
pnpm install       # 安装工具链与类型包
pnpm run build     # tsdown → lib/index.js（Host）+ lib/client.js（浏览器）
pnpm run typecheck
pnpm run test      # vitest：Host 监听器、设置接线、页面模型、页面渲染
pnpm run smoke     # 先构建，再按模块加载器的方式加载 lib/client.js
pnpm run check     # typecheck + test + smoke
```

提交前请跑一次 `pnpm run check`：它会重新构建 `lib/`，因此你提交的产物正是测试跑过的那一份。

`vitest.config.ts` 会在两种布局下寻找 harness 检出：本包位于 `<harness>/plugins/macos-notify`，或与本包同级（例如 `<parent>/deepseek-harness`）。找到时把 `@deepseek-ai/*` 别名到该 workspace 源码，直接跑 `pnpm run test` 无需先构建 harness；两种布局都不存在时，测试使用 `node_modules` 里已发布的包，因此独立克隆也能通过。`tsconfig.json` 始终解析已安装包发布的声明文件，所以 typecheck 只要求 `pnpm install` 成功。

## 页面没有出现

按顺序排查，每一步排除两半未能配对的一种原因。

1. **插件行已挂载。** `dsh plugin --profile web add …` 不应输出 `declares no dsh.bundle`；`dsh --profile web --dump-config` 里能看到 `# == dsh-macos-notify` 层和 `- id: macos-notify` 行。
2. **`lib/` 是最新的。** profile 提供的是构建后的 `lib/client.js`——来自本仓库已提交的那份，或来自你自己的重建；改了源码却没跑 `pnpm run build`（也没重启）等于没改。
3. **重启后刷新过页面。** 启动图（boot graph）注入在首页响应里，已打开的标签页会一直用旧图。
4. **组合了设置服务。** 页面的控件通过 `ctx.configForms` 读写 `macos-notify` 条目，而这需要 `@deepseek-ai/dsh-settings`（行 id `settings`）随 `@deepseek-ai/dsh-base` 一起提供，因此 `web` profile 默认就有。导航行本身与条目是否就绪无关，只有控件会等待它。
5. **在设置导航里找“通知”这一行。** 它是一个独立分区，排在通用、模型、插件、Agent 预设之后，不是插件页里的卡片。

## 设计说明

- **横幅走受管子进程 seam。** 每条横幅都是一次 `ctx.subprocess.spawn`，执行 `/usr/bin/osascript -e 'display notification …'`；卸载时会终止仍在运行的横幅，通知也永远不会阻塞触发它的事件。启动失败或非零退出只写入警告日志，不会到达模型。
- **AppleScript 字面量，而非 shell。** 标题与消息按 AppleScript 字符串字面量转义（JSON 的 `\"`/`\\` 子集，控制字符替换为空格），并作为单个 `-e` 参数传入，任何消息内容都不会被 shell 解释。
- **只观察，不裁决。** `session/event` 监听器只读取 `turn/end` 的原因；`approval/request` waterfall 监听器总是用 `next()` 委托，因此永远不会替人做审批决定。`'never'` 审批策略会在进入应答链之前短路，确定性拒绝不会产生横幅。
- **实时事件，而非回放。** `session/event` 只广播实时追加，因此重载或恢复会话不会引发横幅风暴。
- **实时配置引用，而非重挂载。** 所有可编辑字段都声明为 `.volatile()`；Loader 在一次设置写入后把新值提交进稳定的引用并发出 `loader/volatile-update`，插件实例、监听器与在途横幅都不受影响。每个监听器在触发时读取 `.get()`，这正是设置页改动能对下一条横幅立即生效的原因。
- **设置页编辑的是 profile 条目本身。** 页面通过共享的 `ctx.configForms`（按 profile 条目 id 寻址）做带 revision 围栏、经完整 Config 校验的写入；持久化落在 profile 的 `cordis.patch.yml`，不再有独立的 `settings.yaml`。
- **文本是模板，不是格式化字符串。** `{名称}` 就是全部语法：触发操作暴露的值会替换同名变量，其余字符——包括写错的变量名——原样进入横幅。
- **测试按钮借道配置文档。** 插件的浏览器半只能通过生成出来的 remote 命名空间触达 Host，而本包发布在那一套装配之外，因此两半唯一共有的通道就是配置。测试把一个 `preview` 对象写进本插件的 profile 条目，Loader 提交后 Host 读取它、发出横幅并清除该字段；每个请求里单调递增的 `nonce` 保证残留或重复的请求不会被重复触发。这个字段只是管道而非配置：上表不记录它，正常情况下它是空的。
- **浏览器半只有一个 lazy-CJS 包。** `lib/client.js` 调用 `window.__ModuleLoader__.load({ id, factory })`，React 取自共享模块表；其余全部内联（提示音目录、页面及其 store）。`pnpm run smoke` 无需浏览器即可验证这一约定。
- **两个产物都是自包含的。** Host 包内联了 schema 库（schemastery 用 `Symbol.for('schemastery')` 作为 schema 标识，因此内联副本仍能被 harness 自己的副本识别），而 `src/` 里所有 `@deepseek-ai/*` 导入都只是类型导入、会被擦除。正因如此，以 `link:` 方式安装的检出目录不需要 profile 的包出现在自己的解析路径上；Cordis 通过服务名而非模块身份找到插件。

## 已知限制

- **仅支持 macOS。** 在其他平台挂载会在加载时抛错，而不是静默丢弃通知；也没有跨平台回退方案。
- **通知的归属方是“脚本编辑器”。** `osascript` 以脚本宿主身份投递横幅，因此 macOS 在“系统设置 → 通知”里把它列在 **脚本编辑器** 下。需要在那里允许该应用，否则横幅会被隐藏，而脚本仍然正常退出。
- **即发即弃。** 失败的横幅只记日志并丢弃：没有重试、没有队列，系统抑制通知时也没有应用内兜底。
- **没有节流。** 每个轮次、每次审批请求各一条横幅；长会话就是每轮一条，没有任何合并。
- **轮次即任务单位。** harness 没有持久的“任务”记录，因此“任务完成”指的是一个 agent 轮次关闭。
- **标题与内容各限 160 个字符。** 超出（无论是配置的还是代入后的）都会以 `…` 截断，因为通知中心本来就会裁剪。
- **暂存的文本只存在于当前页面。** 带着未保存的修改离开设置页就会丢弃它们；提示音与开关是立即提交的，不受影响。
- **页面与测试需要设置服务。** 两者都经 `ctx.configForms` 传递，因此没有 `@deepseek-ai/dsh-settings` 的部署没有页面控件，也没有测试按钮；轮次结束与审批横幅本身不受影响。
- **配置写入会固定整条配置。** profile 的 patch 以整条 `config` 为单位，因此页面第一次写入后，该条目的所有 volatile 字段都会出现在 profile 覆盖层里；这是 DSH 0.2.1 配置编辑器的既有语义。

## 重命名本包

包名只出现在三处：`package.json` 的 `"name"`、`tsdown.config.ts` 里的 `ID` 常量（写入 `lib/client.js` 的模块加载器 id），以及 `cordis.patch.yml` 中该行的 `name`。三处要一起改；配置命名空间（`macos-notify`）是 `cordis.patch.yml` 那一行的 `id`，与包名无关，可以保持不变；`src/settings.ts` 的 `SETTINGS_NAMESPACE` 必须与这个 `id` 一致，浏览器半才能找到本插件的表单。

## 模型体验

None（无）。本插件只观察实时 agent 事件，不向模型发送任何内容，也不注册提示词、工具 schema 或上下文。

#### KV Cache effect

它不添加任何模型可见内容，因此既不会增长请求前缀，也不会使其失效。

